import { registerCommand, CommandContext } from './index';
import { addWarning, getWarnings, getWarningCount, resetWarnings, addBan, removeBan, getBannedUsers, muteUser, unmuteUser, isMuted, getMutedUntil } from '../services/db.service';
import { config } from '../config';

export function registerAdminCommands(): void {
    // ── !kick @user ──────────────────────────────────────────────
    registerCommand({
        name: 'kick',
        description: 'Expulsar un miembro del grupo',
        usage: '!kick @usuario',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const target = ctx.mentionedJids[0];
            if (!target) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes mencionar al usuario que quieres expulsar.\nUso: !kick @usuario',
                });
                return;
            }

            try {
                await ctx.sock.groupParticipantsUpdate(ctx.groupJid, [target], 'remove');
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: `🚪 @${target.split('@')[0]} ha sido expulsado del grupo.`,
                    mentions: [target],
                });
            } catch (err) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ No pude expulsar al usuario. ¿Soy admin del grupo?',
                });
            }
        },
    });

    // ── !ban @user ───────────────────────────────────────────────
    registerCommand({
        name: 'ban',
        description: 'Expulsar y banear permanentemente a un miembro',
        usage: '!ban @usuario',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const target = ctx.mentionedJids[0];
            if (!target) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes mencionar al usuario.\nUso: !ban @usuario',
                });
                return;
            }

            try {
                addBan(ctx.groupJid, target);
                await ctx.sock.groupParticipantsUpdate(ctx.groupJid, [target], 'remove');
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: `⛔ @${target.split('@')[0]} ha sido baneado permanentemente del grupo.`,
                    mentions: [target],
                });
            } catch (err) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ No pude banear al usuario. ¿Soy admin del grupo?',
                });
            }
        },
    });

    // ── !banlist ─────────────────────────────────────────────────
    registerCommand({
        name: 'banlist',
        description: 'Lista todos los usuarios baneados del grupo',
        usage: '!banlist',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const bans = getBannedUsers(ctx.groupJid);
            if (bans.length === 0) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '✅ No hay usuarios baneados en este grupo.',
                });
                return;
            }

            let text = `🚫 *Lista de Baneados (${bans.length})*\n\n`;
            bans.forEach((b, i) => {
                const number = b.user_jid.split('@')[0];
                text += `${i + 1}. *${number}* (fecha: ${b.banned_at})\n`;
            });

            await ctx.sock.sendMessage(ctx.groupJid, { text });
        },
    });

    // ── !mute @user Xm/Xh ────────────────────────────────────────
    registerCommand({
        name: 'mute',
        description: 'Silenciar a un usuario temporalmente',
        usage: '!mute @usuario 30m (m=minutos, h=horas)',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const target = ctx.mentionedJids[0];
            const timeRaw = ctx.args[1];

            if (!target || !timeRaw) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Uso correcto: !mute @usuario 30m\nFormatos de tiempo: 30m (minutos), 2h (horas)',
                });
                return;
            }

            let ms = 0;
            if (timeRaw.endsWith('m')) {
                ms = parseInt(timeRaw) * 60 * 1000;
            } else if (timeRaw.endsWith('h')) {
                ms = parseInt(timeRaw) * 60 * 60 * 1000;
            } else {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Formato de tiempo inválido. Usa "m" (minutos) o "h" (horas). Ej: 30m',
                });
                return;
            }

            if (isNaN(ms) || ms <= 0) return;

            const mutedUntil = Date.now() + ms;
            muteUser(ctx.groupJid, target, mutedUntil);

            await ctx.sock.sendMessage(ctx.groupJid, {
                text: `🔇 @${target.split('@')[0]} ha sido silenciado por ${timeRaw}.\nCualquier mensaje que envíe será eliminado automáticamente.`,
                mentions: [target],
            });
        },
    });

    // ── !unmute @user ────────────────────────────────────────────
    registerCommand({
        name: 'unmute',
        description: 'Quitar silencio a un usuario',
        usage: '!unmute @usuario',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const target = ctx.mentionedJids[0];
            if (!target) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes mencionar al usuario.\nUso: !unmute @usuario',
                });
                return;
            }

            unmuteUser(ctx.groupJid, target);
            await ctx.sock.sendMessage(ctx.groupJid, {
                text: `🔊 @${target.split('@')[0]} ya no está silenciado y puede hablar de nuevo.`,
                mentions: [target],
            });
        },
    });

    // ── !warn @user [razón] ──────────────────────────────────────
    registerCommand({
        name: 'warn',
        description: 'Dar una advertencia a un miembro',
        usage: '!warn @usuario [razón]',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const target = ctx.mentionedJids[0];
            if (!target) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes mencionar al usuario.\nUso: !warn @usuario [razón]',
                });
                return;
            }

            const reason = ctx.args.slice(1).join(' ') || 'Sin razón especificada';
            const warningCount = addWarning(ctx.groupJid, target, reason);

            if (warningCount >= config.maxWarnings) {
                // Auto-kick on max warnings
                try {
                    await ctx.sock.groupParticipantsUpdate(ctx.groupJid, [target], 'remove');
                    await ctx.sock.sendMessage(ctx.groupJid, {
                        text: `🚨 @${target.split('@')[0]} ha alcanzado ${warningCount}/${config.maxWarnings} advertencias.\n🚪 Expulsado automáticamente del grupo.`,
                        mentions: [target],
                    });
                    resetWarnings(ctx.groupJid, target);
                } catch (err) {
                    await ctx.sock.sendMessage(ctx.groupJid, {
                        text: '❌ No pude expulsar al usuario.',
                    });
                }
            } else {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: `⚠️ @${target.split('@')[0]} ha recibido una advertencia (${warningCount}/${config.maxWarnings}).\nRazón: ${reason}\n\n⚡ La próxima advertencia resultará en expulsión.`,
                    mentions: [target],
                });
            }
        },
    });

    // ── !warnings @user ──────────────────────────────────────────
    registerCommand({
        name: 'warnings',
        description: 'Ver las advertencias de un usuario',
        usage: '!warnings @usuario',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const target = ctx.mentionedJids[0];
            if (!target) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes mencionar al usuario.\nUso: !warnings @usuario',
                });
                return;
            }

            const warnings = getWarnings(ctx.groupJid, target);
            if (warnings.length === 0) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: `✅ @${target.split('@')[0]} no tiene advertencias.`,
                    mentions: [target],
                });
                return;
            }

            let text = `📋 Advertencias de @${target.split('@')[0]} (${warnings.length}/${config.maxWarnings}):\n\n`;
            warnings.forEach((w, i) => {
                text += `${i + 1}. ${w.reason} — ${w.created_at}\n`;
            });

            await ctx.sock.sendMessage(ctx.groupJid, {
                text,
                mentions: [target],
            });
        },
    });

    // ── !resetwarn @user ─────────────────────────────────────────
    registerCommand({
        name: 'resetwarn',
        description: 'Resetear las advertencias de un usuario',
        usage: '!resetwarn @usuario',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const target = ctx.mentionedJids[0];
            if (!target) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes mencionar al usuario.\nUso: !resetwarn @usuario',
                });
                return;
            }

            resetWarnings(ctx.groupJid, target);
            await ctx.sock.sendMessage(ctx.groupJid, {
                text: `✅ Advertencias de @${target.split('@')[0]} reseteadas.`,
                mentions: [target],
            });
        },
    });

    // ── !promote @user ───────────────────────────────────────────
    registerCommand({
        name: 'promote',
        description: 'Promover a un miembro a admin',
        usage: '!promote @usuario',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const target = ctx.mentionedJids[0];
            if (!target) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes mencionar al usuario.\nUso: !promote @usuario',
                });
                return;
            }

            try {
                await ctx.sock.groupParticipantsUpdate(ctx.groupJid, [target], 'promote');
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: `👑 @${target.split('@')[0]} ahora es admin del grupo.`,
                    mentions: [target],
                });
            } catch (err) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ No pude promover al usuario.',
                });
            }
        },
    });

    // ── !demote @user ────────────────────────────────────────────
    registerCommand({
        name: 'demote',
        description: 'Quitar admin a un miembro',
        usage: '!demote @usuario',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const target = ctx.mentionedJids[0];
            if (!target) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes mencionar al usuario.\nUso: !demote @usuario',
                });
                return;
            }

            try {
                await ctx.sock.groupParticipantsUpdate(ctx.groupJid, [target], 'demote');
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: `📉 @${target.split('@')[0]} ya no es admin del grupo.`,
                    mentions: [target],
                });
            } catch (err) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ No pude quitar admin al usuario.',
                });
            }
        },
    });
    // ── !unban @user o número ────────────────────────────────────
    registerCommand({
        name: 'unban',
        description: 'Quitar el ban permanente a un miembro',
        usage: '!unban @usuario o !unban número (ej: 54911...)',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            let target = ctx.mentionedJids[0];

            // Si no hay mención, intentar usar el número proporcionado en texto
            if (!target && ctx.args.length > 0) {
                let number = ctx.args[0].replace(/[^0-9]/g, '');
                if (number) {
                    target = `${number}@s.whatsapp.net`;
                }
            }

            if (!target) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes mencionar al usuario o escribir su número completo.\nUso: !unban @usuario o !unban 346XXXXXXX',
                });
                return;
            }

            try {
                removeBan(ctx.groupJid, target);

                // Si fue por número y no está en el grupo para mencionar, mostramos el número limpio
                const displayName = target.split('@')[0];
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: `✅ El número ${displayName} ha sido desbaneado.\nYa puede volver a unirse al grupo usando el enlace de invitación.`,
                });
            } catch (err) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ Hubo un error al intentar desbanear al usuario.',
                });
            }
        },
    });

    // ── !del ─────────────────────────────────────────────────────
    registerCommand({
        name: 'del',
        description: 'Eliminar un mensaje respondiendo a él',
        usage: '!del (respondiendo al mensaje)',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            if (!ctx.quotedMessageId || !ctx.quotedParticipant) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes responder a un mensaje específico con !del para eliminarlo.',
                });
                return;
            }

            try {
                const botJid = ctx.sock.user?.id ? ctx.sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';
                await ctx.sock.sendMessage(ctx.groupJid, {
                    delete: {
                        remoteJid: ctx.groupJid,
                        fromMe: ctx.quotedParticipant === botJid,
                        id: ctx.quotedMessageId,
                        participant: ctx.quotedParticipant
                    }
                });
            } catch (err) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ No pude eliminar el mensaje. ¿Tengo permisos de administrador?',
                });
            }
        },
    });

    // ── !setarchivo [nombre] ────────────────────────────────────
    registerCommand({
        name: 'setarchivo',
        description: 'Subir un archivo compartido (responde a un documento)',
        usage: '!setarchivo [nombre] (respondiendo a un archivo)',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const name = ctx.args[0];
            if (!name) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes especificar un nombre para el archivo.\nUso: Responde a un documento con *!setarchivo vpn_config*',
                });
                return;
            }

            if (!ctx.quotedMessage) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes *responder a un documento/imagen* con este comando.\n\n📋 *Pasos:*\n1. Envía el archivo al grupo\n2. Responde a ese mensaje con: *!setarchivo ' + name + '*',
                });
                return;
            }

            // Detect the media type from quoted message
            const quotedMsg = ctx.quotedMessage;
            const mediaMsg = quotedMsg.documentMessage || quotedMsg.imageMessage || 
                           quotedMsg.videoMessage || quotedMsg.audioMessage;

            if (!mediaMsg) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ El mensaje citado no contiene un archivo descargable (documento, imagen, video o audio).',
                });
                return;
            }

            await ctx.sock.sendMessage(ctx.groupJid, {
                text: '⏳ Descargando archivo...',
            });

            try {
                const { downloadMediaMessage } = await import('@whiskeysockets/baileys');

                // Build a minimal message structure for downloadMediaMessage
                const msgType = quotedMsg.documentMessage ? 'documentMessage' 
                    : quotedMsg.imageMessage ? 'imageMessage'
                    : quotedMsg.videoMessage ? 'videoMessage'
                    : 'audioMessage';

                const fakeMsg = {
                    key: ctx.message.key,
                    message: { [msgType]: mediaMsg },
                };

                const buffer = await downloadMediaMessage(
                    fakeMsg as any,
                    'buffer',
                    {},
                    {
                        logger: undefined as any,
                        reuploadRequest: ctx.sock.updateMediaMessage,
                    }
                );

                const originalName = (quotedMsg.documentMessage?.fileName) || `${name}.bin`;
                const mimeType = mediaMsg.mimetype || 'application/octet-stream';

                const { saveSharedFile } = await import('../services/file.service');
                const savedFile = saveSharedFile(
                    name,
                    originalName,
                    mimeType,
                    buffer as Buffer,
                    ctx.groupJid,
                    ctx.senderJid
                );

                const sizeKB = Math.round(savedFile.size / 1024);
                const sizeMB = (savedFile.size / (1024 * 1024)).toFixed(2);
                const sizeStr = savedFile.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: `✅ *Archivo guardado exitosamente*\n\n📄 *Nombre:* ${savedFile.name}\n📎 *Original:* ${savedFile.original_name}\n📦 *Tamaño:* ${sizeStr}\n\n👥 Cualquier miembro puede descargarlo con:\n*!archivo ${savedFile.name}*`,
                });
            } catch (err) {
                console.error('Error downloading/saving file:', err);
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ Error al descargar o guardar el archivo. Intenta de nuevo.',
                });
            }
        },
    });

    // ── !delarchivo [nombre] ────────────────────────────────────
    registerCommand({
        name: 'delarchivo',
        description: 'Eliminar un archivo compartido',
        usage: '!delarchivo [nombre]',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const name = ctx.args[0];
            if (!name) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes especificar el nombre del archivo a eliminar.\nUso: !delarchivo vpn_config',
                });
                return;
            }

            const { deleteSharedFile } = await import('../services/file.service');
            const deleted = deleteSharedFile(name, ctx.groupJid);

            if (deleted) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: `🗑️ Archivo *${name}* eliminado exitosamente.`,
                });
            } else {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: `❌ No se encontró un archivo con el nombre *${name}*.`,
                });
            }
        },
    });

    // ── !archivos ───────────────────────────────────────────────
    registerCommand({
        name: 'archivos',
        description: 'Listar todos los archivos compartidos',
        usage: '!archivos',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const { listSharedFiles } = await import('../services/file.service');
            const files = listSharedFiles(ctx.groupJid);

            if (files.length === 0) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '📭 No hay archivos compartidos en este grupo.\n\nUsa *!setarchivo [nombre]* respondiendo a un archivo para agregar uno.',
                });
                return;
            }

            let text = `📁 *Archivos Compartidos (${files.length})*\n\n`;
            files.forEach((f, i) => {
                const sizeKB = Math.round(f.size / 1024);
                const sizeMB = (f.size / (1024 * 1024)).toFixed(1);
                const sizeStr = f.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
                text += `${i + 1}. 📄 *${f.name}* (${sizeStr})\n   📎 ${f.original_name}\n   📅 ${f.created_at}\n\n`;
            });

            text += `💡 Descarga: *!archivo [nombre]*\n🗑️ Eliminar: *!delarchivo [nombre]*`;

            await ctx.sock.sendMessage(ctx.groupJid, { text });
        },
    });
}
