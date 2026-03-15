import { WASocket, proto } from '@whiskeysockets/baileys';
import { config } from '../config';
import { getCommand, CommandContext } from '../commands/index';
import { checkMessage, handleViolation } from './moderation.handler';

/**
 * Extract the text body from a message (handles different message types).
 */
function getMessageBody(message: proto.IWebMessageInfo): string {
    const msg = message.message;
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
 * Get mentioned JIDs from a message.
 */
function getMentionedJids(message: proto.IWebMessageInfo): string[] {
    const msg = message.message;
    if (!msg) return [];

    return (
        msg.extendedTextMessage?.contextInfo?.mentionedJid || []
    );
}

/**
 * Check if a JID is a group admin.
 */
async function isGroupAdmin(sock: WASocket, groupJid: string, userJid: string): Promise<boolean> {
    try {
        const metadata = await sock.groupMetadata(groupJid);
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

                // Only process group messages
                const remoteJid = message.key.remoteJid;
                if (!remoteJid || !remoteJid.endsWith('@g.us')) continue;

                const groupJid = remoteJid;
                const senderJid = message.key.participant || '';
                if (!senderJid) continue;

                const body = getMessageBody(message);
                if (!body) continue;

                // Check if sender is admin
                const isAdmin = await isGroupAdmin(sock, groupJid, senderJid);
                const isOwner = config.ownerNumber
                    ? senderJid.includes(config.ownerNumber)
                    : false;

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
                const ctx: CommandContext = {
                    sock,
                    message,
                    groupJid,
                    senderJid,
                    args,
                    body,
                    mentionedJids: getMentionedJids(message),
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
