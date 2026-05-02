import { WASocket } from '@whiskeysockets/baileys';
import { isBanned, getGroupSettings, addAuditLog } from '../services/db.service';
import { countSharedFiles } from '../services/file.service';
import { invalidateGroupCache } from './message.handler';

/**
 * Replace {user}, {group}, {members} variables in welcome/bye messages.
 */
function replaceVars(template: string, userJid: string, groupName: string, memberCount: number): string {
    return template
        .replace(/\{user\}/g, `@${userJid.split('@')[0]}`)
        .replace(/\{group\}/g, groupName)
        .replace(/\{members\}/g, String(memberCount));
}

/**
 * Handle group participant updates (join/leave/promote/demote).
 */
export function setupGroupHandler(sock: WASocket): void {
    sock.ev.on('group-participants.update', async (update) => {
        const { id: groupJid, participants, action } = update;

        for (const participant of participants) {
            const jid = typeof participant === 'string' ? participant : (participant as any).id;

            switch (action) {
                case 'add': {
                    // Check if user is banned
                    if (isBanned(groupJid, jid)) {
                        console.log(`Banned user ${jid} tried to join ${groupJid}, kicking...`);
                        try {
                            await sock.groupParticipantsUpdate(groupJid, [jid], 'remove');
                            await sock.sendMessage(groupJid, {
                                text: `⛔ @${jid.split('@')[0]} está baneado de este grupo y ha sido expulsado automáticamente.`,
                                mentions: [jid],
                            });
                            addAuditLog(groupJid, 'AUTO_KICK_BANNED', 'bot', jid);
                        } catch (err) {
                            console.error('Error auto-kicking banned user:', err);
                        }
                        break;
                    }

                    // Check for custom welcome message
                    const settings = getGroupSettings(groupJid);

                    let welcomeText: string;

                    if (settings.welcome_msg) {
                        // Custom welcome
                        try {
                            const metadata = await sock.groupMetadata(groupJid);
                            welcomeText = replaceVars(settings.welcome_msg, jid, metadata.subject, metadata.participants.length);
                        } catch {
                            welcomeText = replaceVars(settings.welcome_msg, jid, 'el grupo', 0);
                        }
                    } else {
                        // Default welcome
                        welcomeText = `👋 ¡Bienvenido/a @${jid.split('@')[0]}!\n\n📜 Recuerda revisar las reglas del grupo con *!rules*\n\n⚠️ *Sistema de moderación activo:*\n• 1ra infracción → Advertencia\n• 2da infracción → Expulsión\n\n📥 *Descarga tu archivo o app:*\n• *!entel* — Archivo Entel\n• *!bitel* — Archivo Bitel\n• *!injector* — Aplicación Injector\n\n¡Disfruta tu estancia! 🎉`;
                    }

                    await sock.sendMessage(groupJid, {
                        text: welcomeText,
                        mentions: [jid],
                    });
                    break;
                }

                case 'remove': {
                    // Send goodbye message if configured
                    const byeSettings = getGroupSettings(groupJid);
                    if (byeSettings.bye_msg) {
                        try {
                            const metadata = await sock.groupMetadata(groupJid);
                            const byeText = replaceVars(byeSettings.bye_msg, jid, metadata.subject, metadata.participants.length);
                            await sock.sendMessage(groupJid, {
                                text: byeText,
                                mentions: [jid],
                            });
                        } catch { /* ignore */ }
                    }
                    break;
                }

                case 'promote': {
                    invalidateGroupCache(groupJid);
                    addAuditLog(groupJid, 'PROMOTE', 'system', jid);
                    break;
                }

                case 'demote': {
                    invalidateGroupCache(groupJid);
                    addAuditLog(groupJid, 'DEMOTE', 'system', jid);
                    break;
                }

                default:
                    break;
            }
        }
    });
}
