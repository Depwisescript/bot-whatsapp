import { registerCommand, CommandContext, getAllCommands } from './index';
import { config } from '../config';
import { getWarnings, getWarningCount, isBanned } from '../services/db.service';
import { generateAIResponse, generateAIImage } from '../services/ai.service';
import * as os from 'os';

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
                    text += `  • *${config.prefix}${cmd.name}* — ${cmd.description}\n`;
                });
                text += '\n';
            }

            // General commands
            const generalCmds = commands.filter((c) => !c.adminOnly);
            if (generalCmds.length > 0) {
                text += '📌 *Comandos Generales:*\n';
                generalCmds.forEach((cmd) => {
                    text += `  • *${config.prefix}${cmd.name}* — ${cmd.description}\n`;
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

    // ── !link ────────────────────────────────────────────────────
    registerCommand({
        name: 'link',
        description: 'Obtener el enlace de invitación del grupo',
        usage: '!link',
        adminOnly: true, // Only admins should generate the link to avoid spam 
        execute: async (ctx: CommandContext) => {
            try {
                const code = await ctx.sock.groupInviteCode(ctx.groupJid);
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: `🔗 *Enlace de Invitación:*\nhttps://chat.whatsapp.com/${code}`,
                });
            } catch (err) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ No pude obtener el enlace. Asegúrate de que soy administrador del grupo.',
                });
            }
        },
    });

    // ── !tagall ──────────────────────────────────────────────────
    registerCommand({
        name: 'tagall',
        description: 'Mencionar a todos los miembros del grupo',
        usage: '!tagall [mensaje opcional]',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            try {
                const metadata = await ctx.sock.groupMetadata(ctx.groupJid);
                const participants = metadata.participants.map(p => p.id);
                
                const customMessage = ctx.args.join(' ');
                let text = `📢 *ATENCIÓN A TODOS*\n\n`;
                if (customMessage) {
                    text += `${customMessage}\n\n`;
                }
                
                // Add invisible mentions trick or just list them
                participants.forEach(jid => {
                    text += `@${jid.split('@')[0]} `;
                });

                await ctx.sock.sendMessage(ctx.groupJid, {
                    text,
                    mentions: participants,
                });
            } catch (err) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ Hubo un error al intentar mencionar a todos.',
                });
            }
        },
    });

    // ── !status ──────────────────────────────────────────────────
    registerCommand({
        name: 'status',
        description: 'Mostrar estado y estadísticas del bot',
        usage: '!status',
        adminOnly: true, // Visible to group admins, or owner
        execute: async (ctx: CommandContext) => {
            const uptimeMs = Date.now() - config.startTime;
            const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((uptimeMs / 1000 / 60) % 60);

            const uptimeStr = `${days}d ${hours}h ${minutes}m`;
            const memUsage = Math.round(process.memoryUsage().rss / 1024 / 1024);
            const freeMem = Math.round(os.freemem() / 1024 / 1024);
            const totalMem = Math.round(os.totalmem() / 1024 / 1024);

            const text = `📊 *Estado del Bot (v1.1)*\n
⏱️ *Uptime:* ${uptimeStr}
💻 *Memoria RAM (Bot):* ${memUsage} MB
🖥️ *Memoria Libre (VPS):* ${freeMem} / ${totalMem} MB
🟢 *Entorno:* ${config.nodeEnv}

🛡️ *Auto-Moderación:* Activa
⚡ *Caché Groups:* Activo (5m TTL)`;

            await ctx.sock.sendMessage(ctx.groupJid, { text });
        },
    });

    // ── !ia ──────────────────────────────────────────────────────
    registerCommand({
        name: 'ia',
        description: 'Hablar con la inteligencia artificial (Gemini)',
        usage: '!ia [tu pregunta] (también puedes responder a un mensaje con !ia)',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const prompt = ctx.args.join(' ');

            if (!prompt && !ctx.quotedMessageBody) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes escribir una pregunta o responder a un mensaje.\nUso: !ia ¿Qué es la física cuántica?',
                });
                return;
            }

            // Optional loading placeholder (simulating "typing")
            await ctx.sock.presenceSubscribe(ctx.groupJid);
            await ctx.sock.sendPresenceUpdate('composing', ctx.groupJid);

            try {
                const response = await generateAIResponse(
                    prompt || "Explícame de qué trata o qué significa este mensaje citado de forma breve.",
                    ctx.quotedMessageBody
                );

                await ctx.sock.sendMessage(ctx.groupJid, { text: response });
            } catch (err) {
                await ctx.sock.sendMessage(ctx.groupJid, { text: '❌ Ocurrió un error al contactar al cerebro de IA.' });
            } finally {
                await ctx.sock.sendPresenceUpdate('paused', ctx.groupJid);
            }
        },
    });

    // ── !imagine ──────────────────────────────────────────────────
    registerCommand({
        name: 'imagine',
        description: 'Generar una imagen usando Inteligencia Artificial',
        usage: '!imagine [descripción de la imagen]',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const prompt = ctx.args.join(' ');

            if (!prompt) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes escribir qué quieres que dibuje.\nUso: !imagine un gato con sombrero viajando en el espacio',
                });
                return;
            }

            // Optional loading placeholder
            await ctx.sock.sendMessage(ctx.groupJid, { text: '🎨 Generando imagen, por favor espera un momento...' });
            await ctx.sock.sendPresenceUpdate('composing', ctx.groupJid);

            try {
                const imageBuffer = await generateAIImage(prompt);

                if (imageBuffer) {
                    await ctx.sock.sendMessage(ctx.groupJid, {
                        image: imageBuffer,
                        caption: `✨ *Imagen generada:* "${prompt}"\n🤖 Por Depwise AI`
                    });
                } else {
                    await ctx.sock.sendMessage(ctx.groupJid, {
                        text: '❌ No se pudo generar la imagen. El servidor de IA está saturado, por favor intenta de nuevo.'
                    });
                }
            } catch (err) {
                await ctx.sock.sendMessage(ctx.groupJid, { text: '❌ Ocurrió un error al intentar crear la imagen.' });
            } finally {
                await ctx.sock.sendPresenceUpdate('paused', ctx.groupJid);
            }
        },
    });

    // ── !archivo [nombre] ───────────────────────────────────────
    registerCommand({
        name: 'archivo',
        description: 'Descargar un archivo compartido del grupo',
        usage: '!archivo [nombre] (o solo !archivo si hay uno)',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const { listSharedFiles, getSharedFile, getSingleFile, readFileBuffer, countSharedFiles } = await import('../services/file.service');

            const name = ctx.args[0];

            // If no name provided, check if there's only one file
            if (!name) {
                const fileCount = countSharedFiles(ctx.groupJid);

                if (fileCount === 0) {
                    await ctx.sock.sendMessage(ctx.groupJid, {
                        text: '📭 No hay archivos disponibles en este grupo.',
                    });
                    return;
                }

                if (fileCount === 1) {
                    // Auto-send the only file
                    const file = getSingleFile(ctx.groupJid);
                    if (file) {
                        const buffer = readFileBuffer(file.file_path);
                        if (buffer) {
                            await ctx.sock.sendMessage(ctx.groupJid, {
                                document: buffer,
                                mimetype: file.mime_type,
                                fileName: file.original_name,
                                caption: `📥 *${file.name}* — ${file.original_name}`,
                            });
                            return;
                        }
                    }
                    await ctx.sock.sendMessage(ctx.groupJid, {
                        text: '❌ Error al leer el archivo del servidor.',
                    });
                    return;
                }

                // Multiple files, show list
                const files = listSharedFiles(ctx.groupJid);
                let text = `📁 *Archivos Disponibles (${files.length})*\n\n`;
                files.forEach((f, i) => {
                    text += `${i + 1}. 📄 *${f.name}*\n`;
                });
                text += `\n💡 Usa: *!archivo [nombre]* para descargar`;

                await ctx.sock.sendMessage(ctx.groupJid, { text });
                return;
            }

            // Get specific file by name
            const file = getSharedFile(name, ctx.groupJid);
            if (!file) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: `❌ No se encontró un archivo con el nombre *${name}*.\nUsa *!archivo* para ver la lista.`,
                });
                return;
            }

            const buffer = readFileBuffer(file.file_path);
            if (!buffer) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ El archivo existe en la base de datos pero no se pudo leer del disco.',
                });
                return;
            }

            await ctx.sock.sendMessage(ctx.groupJid, {
                document: buffer,
                mimetype: file.mime_type,
                fileName: file.original_name,
                caption: `📥 *${file.name}* — ${file.original_name}`,
            });
        },
    });

    // ── !entel ──────────────────────────────────────────────────
    registerCommand({
        name: 'entel',
        description: 'Descargar archivo de configuración Entel',
        usage: '!entel',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const { getSharedFile, getSharedFileGlobal, readFileBuffer } = await import('../services/file.service');

            const file = getSharedFile('entel', ctx.groupJid) || getSharedFileGlobal('entel');
            if (!file) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '📭 Aún no se ha subido el archivo de *Entel*.\n\n👑 _Un admin puede subirlo respondiendo a un archivo con:_\n*!setarchivo entel*',
                });
                return;
            }

            const buffer = readFileBuffer(file.file_path);
            if (!buffer) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ Error al leer el archivo de Entel del servidor.',
                });
                return;
            }

            await ctx.sock.sendMessage(ctx.groupJid, {
                document: buffer,
                mimetype: file.mime_type,
                fileName: file.original_name,
                caption: `📥 *Entel* — ${file.original_name}\n📱 Archivo de configuración Entel`,
            });
        },
    });

    // ── !bitel ──────────────────────────────────────────────────
    registerCommand({
        name: 'bitel',
        description: 'Descargar archivo de configuración Bitel',
        usage: '!bitel',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const { getSharedFile, getSharedFileGlobal, readFileBuffer } = await import('../services/file.service');

            const file = getSharedFile('bitel', ctx.groupJid) || getSharedFileGlobal('bitel');
            if (!file) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '📭 Aún no se ha subido el archivo de *Bitel*.\n\n👑 _Un admin puede subirlo respondiendo a un archivo con:_\n*!setarchivo bitel*',
                });
                return;
            }

            const buffer = readFileBuffer(file.file_path);
            if (!buffer) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ Error al leer el archivo de Bitel del servidor.',
                });
                return;
            }

            await ctx.sock.sendMessage(ctx.groupJid, {
                document: buffer,
                mimetype: file.mime_type,
                fileName: file.original_name,
                caption: `📥 *Bitel* — ${file.original_name}\n📱 Archivo de configuración Bitel`,
            });
        },
    });
}
