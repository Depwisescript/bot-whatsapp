import { WASocket } from '@whiskeysockets/baileys';
import { isBanned } from '../services/db.service';
import { countSharedFiles } from '../services/file.service';
import { invalidateGroupCache } from './message.handler';

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
                        } catch (err) {
                            console.error('Error auto-kicking banned user:', err);
                        }
                        break;
                    }

                    // Welcome message
                    let welcomeText = `👋 ¡Bienvenido/a @${jid.split('@')[0]}!\n\n📜 Recuerda revisar las reglas del grupo con *!rules*\n\n⚠️ *Sistema de moderación activo:*\n• 1ra infracción → Advertencia\n• 2da infracción → Expulsión\n\n📥 *Descarga tu archivo:*\n• *!entel* — Archivo Entel\n• *!bitel* — Archivo Bitel`;

                    welcomeText += `\n\n¡Disfruta tu estancia! 🎉`;

                    await sock.sendMessage(groupJid, {
                        text: welcomeText,
                        mentions: [jid],
                    });
                    break;
                }

                case 'remove': {
                    // No goodbye message
                    break;
                }

                case 'promote':
                case 'demote': {
                    // Invalidate metadata cache so message handler updates admin check
                    invalidateGroupCache(groupJid);
                    break;
                }

                default:
                    break;
            }
        }
    });
}
