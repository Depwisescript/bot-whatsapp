import { registerCommand, CommandContext, getAllCommands } from './index';
import { config } from '../config';

export function registerGeneralCommands(): void {
    // ── !help ────────────────────────────────────────────────────
    registerCommand({
        name: 'help',
        description: 'Mostrar lista de comandos disponibles',
        usage: '!help',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const commands = getAllCommands();

            let text = '🤖 *Comandos del Bot*\n\n';

            // Admin commands
            const adminCmds = commands.filter((c) => c.adminOnly);
            if (adminCmds.length > 0) {
                text += '👑 *Comandos Admin:*\n';
                adminCmds.forEach((cmd) => {
                    text += `  • *${config.prefix}${cmd.name}* — ${cmd.description}\n    _${cmd.usage}_\n`;
                });
                text += '\n';
            }

            // General commands
            const generalCmds = commands.filter((c) => !c.adminOnly);
            if (generalCmds.length > 0) {
                text += '📌 *Comandos Generales:*\n';
                generalCmds.forEach((cmd) => {
                    text += `  • *${config.prefix}${cmd.name}* — ${cmd.description}\n    _${cmd.usage}_\n`;
                });
            }

            await ctx.sock.sendMessage(ctx.groupJid, { text });
        },
    });

    // ── !rules ───────────────────────────────────────────────────
    registerCommand({
        name: 'rules',
        description: 'Mostrar las reglas del grupo',
        usage: '!rules',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const text = `📜 *Reglas del Grupo*\n
1️⃣ No enviar enlaces de otros grupos de WhatsApp
2️⃣ No hacer publicidad ni promocionar ventas
3️⃣ No hacer spam (mensajes repetidos/flood)
4️⃣ Respetar a todos los miembros
5️⃣ No enviar contenido inapropiado

⚠️ *Sistema de advertencias:*
• 1ra infracción → Advertencia + eliminación del mensaje
• 2da infracción → Expulsión inmediata del grupo

_Los admins están exentos de la moderación automática._`;

            await ctx.sock.sendMessage(ctx.groupJid, { text });
        },
    });

    // ── !info ────────────────────────────────────────────────────
    registerCommand({
        name: 'info',
        description: 'Mostrar información del grupo',
        usage: '!info',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            try {
                const metadata = await ctx.sock.groupMetadata(ctx.groupJid);

                const admins = metadata.participants
                    .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
                    .map((p) => `@${p.id.split('@')[0]}`)
                    .join(', ');

                const adminJids = metadata.participants
                    .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
                    .map((p) => p.id);

                const text = `ℹ️ *Información del Grupo*\n
📛 *Nombre:* ${metadata.subject}
👥 *Miembros:* ${metadata.participants.length}
👑 *Admins:* ${admins}
📅 *Creado:* ${new Date((metadata.creation || 0) * 1000).toLocaleDateString('es')}`;

                await ctx.sock.sendMessage(ctx.groupJid, {
                    text,
                    mentions: adminJids,
                });
            } catch (err) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ No pude obtener la información del grupo.',
                });
            }
        },
    });
}
