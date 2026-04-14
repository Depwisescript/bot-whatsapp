import { WASocket, proto, GroupMetadata } from '@whiskeysockets/baileys';
import { config } from '../config';
import { getCommand, CommandContext } from '../commands/index';
import { checkMessage, handleViolation } from './moderation.handler';
import { isMuted } from '../services/db.service';
import { generateAIResponse } from '../services/ai.service';

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
                // Now supports standard numbers AND @lid (WhatsApp Privacy linked IDs)
                if (remoteJid.endsWith('@s.whatsapp.net') || remoteJid.endsWith('@lid')) {
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

                // ── Auto AI: respond when bot is replied to or @mentioned ──
                if (!body.startsWith(config.prefix)) {
                    const botId = sock.user?.id;
                    if (botId) {
                        const botNumber = botId.split(':')[0];
                        const botJidNorm = botNumber + '@s.whatsapp.net';
                        const botLid = (sock.user as any)?.lid || '';

                        // Extract contextInfo from any message type
                        const msg = message.message;
                        const ctxInfo = msg?.extendedTextMessage?.contextInfo
                            || msg?.imageMessage?.contextInfo
                            || msg?.videoMessage?.contextInfo
                            || msg?.documentMessage?.contextInfo
                            || msg?.audioMessage?.contextInfo;

                        const quotedSender = ctxInfo?.participant || '';

                        // Debug: log to see actual JID formats
                        if (quotedSender) {
                            console.log(`[AUTO-AI DEBUG] botId=${botId} botLid=${botLid} quotedSender=${quotedSender}`);
                        }

                        // Check if replying to a bot message
                        // Support: standard JID, device suffix, and LID format
                        const quotedSenderNumber = quotedSender.split(':')[0].split('@')[0];
                        const isReplyToBot = !!quotedSender && (
                            quotedSender === botJidNorm ||
                            quotedSender.startsWith(botNumber + ':') ||
                            quotedSenderNumber === botNumber ||
                            (botLid && (quotedSender === botLid || quotedSender.startsWith(botLid.split(':')[0] + ':')))
                        );

                        // Check if bot is @mentioned
                        const mentions = ctxInfo?.mentionedJid || [];
                        const isMentioningBot = mentions.some(jid => {
                            const jidNumber = jid.split(':')[0].split('@')[0];
                            return jid === botJidNorm || jid.startsWith(botNumber + ':') || jidNumber === botNumber
                                || (botLid && (jid === botLid || jid.startsWith(botLid.split(':')[0] + ':')));
                        });

                        if (isReplyToBot || isMentioningBot) {
                            console.log(`[AUTO-AI] Triggered! replyToBot=${isReplyToBot} mentioned=${isMentioningBot}`);
                            let prompt = body;

                            // Remove @mention from prompt text
                            if (isMentioningBot) {
                                prompt = prompt.replace(new RegExp(`@${botNumber}\\s*`, 'g'), '').trim();
                                // Also remove LID-based mention if present
                                if (botLid) {
                                    const lidNumber = botLid.split(':')[0].split('@')[0];
                                    prompt = prompt.replace(new RegExp(`@${lidNumber}\\s*`, 'g'), '').trim();
                                }
                            }

                            const quotedBody = getMessageBodyFromMsg(ctxInfo?.quotedMessage);

                            if (prompt || quotedBody) {
                                await sock.sendPresenceUpdate('composing', groupJid);
                                try {
                                    const response = await generateAIResponse(
                                        prompt || 'Responde a este mensaje de forma breve y útil.',
                                        quotedBody
                                    );
                                    await sock.sendMessage(groupJid, { text: response });
                                } catch (err) {
                                    await sock.sendMessage(groupJid, {
                                        text: '❌ Error al contactar la IA.',
                                    });
                                } finally {
                                    await sock.sendPresenceUpdate('paused', groupJid);
                                }
                            }
                            continue;
                        }
                    }
                    continue; // Not a command and not targeting the bot
                }

                // ── Command processing ──

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
                    quotedMessage: contextInfo?.quotedMessage || null,
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
