import { WASocket, proto, GroupMetadata } from '@whiskeysockets/baileys';
import { config } from '../config';
import { getCommand, CommandContext } from '../commands/index';
import { checkMessage, handleViolation } from './moderation.handler';
import { isMuted } from '../services/db.service';

// ── Group metadata cache ─────────────────────────────────────────
interface CachedMetadata {
    data: GroupMetadata;
    timestamp: number;
}
const metadataCache = new Map<string, CachedMetadata>();

/**
 * Get group metadata with caching (5 min TTL).
 */
export async function getCachedGroupMetadata(sock: WASocket, groupJid: string): Promise<GroupMetadata> {
    const cached = metadataCache.get(groupJid);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < config.metadataCacheTTL) {
        return cached.data;
    }

    const metadata = await sock.groupMetadata(groupJid);
    metadataCache.set(groupJid, { data: metadata, timestamp: now });
    return metadata;
}

/**
 * Force refresh the cache for a specific group (used after promote/demote).
 */
export function invalidateGroupCache(groupJid: string): void {
    metadataCache.delete(groupJid);
}

/**
 * Extract the text body from an IMessage.
 */
function getMessageBodyFromMsg(msg: proto.IMessage | null | undefined): string {
    if (!msg) return '';

    return (
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption ||
        msg.documentMessage?.caption ||
        ''
    );
}

/**
 * Extract the text body from a WebMessageInfo (handles different message types).
 */
function getMessageBody(message: proto.IWebMessageInfo): string {
    return getMessageBodyFromMsg(message.message);
}

/**
 * Get mentioned JIDs from a message, including the sender of a quoted message if present.
 */
function getMentionedJids(message: proto.IWebMessageInfo): string[] {
    const msg = message.message;
    if (!msg) return [];

    const jids = [...(msg.extendedTextMessage?.contextInfo?.mentionedJid || [])];
    const quotedParticipant = msg.extendedTextMessage?.contextInfo?.participant;
    
    // Si se está respondiendo a un mensaje, agregar al autor del mensaje a los mencionados
    if (quotedParticipant && !jids.includes(quotedParticipant)) {
        jids.push(quotedParticipant);
    }

    return jids;
}

/**
 * Check if a JID is a group admin (uses cache).
 */
async function isGroupAdmin(sock: WASocket, groupJid: string, userJid: string): Promise<boolean> {
    try {
        const metadata = await getCachedGroupMetadata(sock, groupJid);
        const participant = metadata.participants.find((p) => p.id === userJid);
        return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch {
        return false;
    }
}

/**
 * Check if a JID is the bot itself.
 */
function isBotMessage(sock: WASocket, message: proto.IWebMessageInfo): boolean {
    const botJid = sock.user?.id;
    if (!botJid) return false;

    const senderJid = message.key?.participant || message.key?.remoteJid || '';
    // Normalize JIDs for comparison (remove device suffix)
    const normalizedBot = botJid.split(':')[0] + '@s.whatsapp.net';
    const normalizedSender = senderJid.split(':')[0].split('@')[0] + '@s.whatsapp.net';

    return normalizedBot === normalizedSender;
}

// Cache for DM autoreply cooldown to prevent spamming
const dmCooldownCache = new Set<string>();

/**
 * Set up the message handler.
 */
export function setupMessageHandler(sock: WASocket): void {
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const message of messages) {
            try {
                // Ignore bot's own messages
                if (message.key.fromMe || isBotMessage(sock, message)) continue;

                const remoteJid = message.key.remoteJid;
                if (!remoteJid) continue;

                // Extract message body early to ignore background/protocol messages
                const body = getMessageBody(message);

                // ── Auto-reply for Direct Messages (DMs) ──
                if (remoteJid.endsWith('@s.whatsapp.net')) {
                    // Ignore empty messages (protocol messages, typing indicators, key syncs)
                    if (!body) continue;

                    // Solo responder si no está en cooldown
                    if (!dmCooldownCache.has(remoteJid) && config.autoReplyMsg) {
                        dmCooldownCache.add(remoteJid);
                        await sock.sendMessage(remoteJid, { text: config.autoReplyMsg });
                        
                        // Cooldown de 1 hora para no hacer spam si sigue escribiendo
                        setTimeout(() => dmCooldownCache.delete(remoteJid), 60 * 60 * 1000);
                    }
                    continue; // No procesar comandos ni moderación en DMs
                }

                // Only process group messages
                if (!remoteJid.endsWith('@g.us')) continue;

                const groupJid = remoteJid;
                const senderJid = message.key.participant || '';
                if (!senderJid) continue;

                // Check if sender is admin
                const isAdmin = await isGroupAdmin(sock, groupJid, senderJid);
                const isOwner = config.ownerNumber
                    ? senderJid.includes(config.ownerNumber)
                    : false;

                // ── Mute check: delete messages from muted users ──
                if (!isAdmin && !isOwner && isMuted(groupJid, senderJid)) {
                    try {
                        if (message.key) {
                            await sock.sendMessage(groupJid, {
                                delete: message.key as proto.IMessageKey,
                            });
                        }
                    } catch { /* ignore delete errors for muted */ }
                    continue;
                }

                // Skip empty-body messages (images without caption, stickers, etc.)
                if (!body) continue;

                // ── Auto-moderation (skip for admins and owner) ──
                if (!isAdmin && !isOwner) {
                    const moderationResult = checkMessage(body, senderJid, groupJid);

                    if (moderationResult.violation) {
                        await handleViolation(sock, message, groupJid, senderJid, moderationResult);
                        continue; // Don't process as command
                    }
                }

                // ── Command processing ──
                if (!body.startsWith(config.prefix)) continue;

                const args = body
                    .slice(config.prefix.length)
                    .trim()
                    .split(/\s+/);
                const commandName = args.shift()?.toLowerCase();

                if (!commandName) continue;

                const command = getCommand(commandName);
                if (!command) continue;

                // Check admin-only permission
                if (command.adminOnly && !isAdmin && !isOwner) {
                    await sock.sendMessage(groupJid, {
                        text: '🔒 Este comando solo puede ser usado por admins del grupo.',
                    });
                    continue;
                }

                // Build context and execute
                const contextInfo = message.message?.extendedTextMessage?.contextInfo;
                const ctx: CommandContext = {
                    sock,
                    message,
                    groupJid,
                    senderJid,
                    args,
                    body,
                    mentionedJids: getMentionedJids(message),
                    quotedMessageId: contextInfo?.stanzaId || undefined,
                    quotedParticipant: contextInfo?.participant || undefined,
                    quotedMessageBody: getMessageBodyFromMsg(contextInfo?.quotedMessage),
                    isAdmin,
                    isOwner,
                };

                await command.execute(ctx);
            } catch (err) {
                console.error('Error processing message:', err);
            }
        }
    });
}
