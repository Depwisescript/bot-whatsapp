import { registerCommand, CommandContext } from './index';
import { addWarning, getWarnings, getWarningCount, resetWarnings, addBan, removeBan } from '../services/db.service';
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
}
