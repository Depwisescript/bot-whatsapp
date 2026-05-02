import { registerCommand, CommandContext } from './index';
import { generateAIResponse } from '../services/ai.service';
import {
    addUserXP, getUserLevel, getTopLevels, xpForLevel,
    addReminder, addAuditLog, getAuditLogs, getAuditLogsForUser,
    getGroupSettings, setWelcomeMsg, setByeMsg, setSlowmode,
    getWarningCount,
} from '../services/db.service';
import { config } from '../config';

// ── Level title mapping ──────────────────────────────────────────
function getLevelTitle(level: number): string {
    if (level >= 50) return '👑 Leyenda';
    if (level >= 40) return '💎 Diamante';
    if (level >= 30) return '🏆 Oro';
    if (level >= 20) return '⚡ Platino';
    if (level >= 15) return '🔥 Experto';
    if (level >= 10) return '⭐ Veterano';
    if (level >= 7) return '🌟 Avanzado';
    if (level >= 5) return '📗 Intermedio';
    if (level >= 3) return '📘 Activo';
    return '📕 Novato';
}

function createProgressBar(current: number, max: number, length: number = 10): string {
    const filled = Math.round((current / max) * length);
    const empty = length - filled;
    return '█'.repeat(Math.min(filled, length)) + '░'.repeat(Math.max(empty, 0));
}

export function registerExtraCommands(): void {

    // ── !level ──────────────────────────────────────────────────
    registerCommand({
        name: 'level',
        description: 'Ver tu nivel y XP actual',
        usage: '!level o !level @usuario',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const target = ctx.mentionedJids[0] || ctx.senderJid;
            const data = getUserLevel(ctx.groupJid, target);
            const needed = xpForLevel(data.level);
            const title = getLevelTitle(data.level);
            const bar = createProgressBar(data.xp, needed);

            const text = `📊 *Perfil de Nivel*\n\n` +
                `👤 @${target.split('@')[0]}\n` +
                `🏅 *Nivel:* ${data.level} — ${title}\n` +
                `✨ *XP:* ${data.xp}/${needed}\n` +
                `${bar}\n` +
                `💬 *Mensajes:* ${data.messages_count}\n`;

            await ctx.sock.sendMessage(ctx.groupJid, { text, mentions: [target] });
        },
    });

    // ── !top / !ranking ─────────────────────────────────────────
    registerCommand({
        name: 'top',
        description: 'Ver ranking de los más activos del grupo',
        usage: '!top',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const top = getTopLevels(ctx.groupJid, 10);

            if (top.length === 0) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '📊 Aún no hay datos de nivel. ¡Empiecen a chatear!',
                });
                return;
            }

            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
            let text = `🏆 *RANKING DEL GRUPO*\n\n`;
            const mentions: string[] = [];

            top.forEach((u, i) => {
                const title = getLevelTitle(u.level);
                text += `${medals[i] || '•'} @${u.user_jid.split('@')[0]} — Lv.${u.level} ${title} (${u.xp} XP)\n`;
                mentions.push(u.user_jid);
            });

            await ctx.sock.sendMessage(ctx.groupJid, { text, mentions });
        },
    });

    // ── !perfil @user ───────────────────────────────────────────
    registerCommand({
        name: 'perfil',
        description: 'Ver perfil completo de un usuario',
        usage: '!perfil @usuario',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const target = ctx.mentionedJids[0] || ctx.senderJid;
            const level = getUserLevel(ctx.groupJid, target);
            const warnings = getWarningCount(ctx.groupJid, target);
            const needed = xpForLevel(level.level);
            const title = getLevelTitle(level.level);
            const bar = createProgressBar(level.xp, needed);

            const text = `👤 *Perfil de @${target.split('@')[0]}*\n\n` +
                `🏅 *Nivel:* ${level.level} — ${title}\n` +
                `✨ *XP:* ${level.xp}/${needed}\n` +
                `${bar}\n` +
                `💬 *Mensajes:* ${level.messages_count}\n` +
                `⚠️ *Advertencias:* ${warnings}/${config.maxWarnings}\n`;

            await ctx.sock.sendMessage(ctx.groupJid, { text, mentions: [target] });
        },
    });

    // ── !remind ─────────────────────────────────────────────────
    registerCommand({
        name: 'remind',
        description: 'Programar un recordatorio',
        usage: '!remind 30m Revisar el grupo',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const timeRaw = ctx.args[0];
            const message = ctx.args.slice(1).join(' ');

            if (!timeRaw || !message) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Uso: !remind [tiempo] [mensaje]\nEjemplos:\n• !remind 30m Revisar las reglas\n• !remind 2h Reunión\n• !remind 1d Evento mañana',
                });
                return;
            }

            let ms = 0;
            if (timeRaw.endsWith('m')) ms = parseInt(timeRaw) * 60_000;
            else if (timeRaw.endsWith('h')) ms = parseInt(timeRaw) * 3600_000;
            else if (timeRaw.endsWith('d')) ms = parseInt(timeRaw) * 86400_000;
            else {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Formato inválido. Usa m (minutos), h (horas), d (días).\nEj: 30m, 2h, 1d',
                });
                return;
            }

            if (isNaN(ms) || ms <= 0 || ms > 7 * 86400_000) {
                await ctx.sock.sendMessage(ctx.groupJid, { text: '⚠️ Tiempo inválido (máx: 7 días).' });
                return;
            }

            addReminder(ctx.groupJid, ctx.senderJid, message, Date.now() + ms);

            await ctx.sock.sendMessage(ctx.groupJid, {
                text: `⏰ Recordatorio programado!\n\n📝 "${message}"\n⏱️ En: ${timeRaw}\n👤 Para: @${ctx.senderJid.split('@')[0]}`,
                mentions: [ctx.senderJid],
            });
        },
    });

    // ── !setwelcome ─────────────────────────────────────────────
    registerCommand({
        name: 'setwelcome',
        description: 'Personalizar mensaje de bienvenida',
        usage: '!setwelcome Hola {user}, bienvenido a {group}!',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const msg = ctx.args.join(' ');

            if (!msg) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Uso: !setwelcome [mensaje]\n\nVariables disponibles:\n• {user} — Nombre del nuevo miembro\n• {group} — Nombre del grupo\n• {members} — Cantidad de miembros\n\nPara desactivar: !setwelcome off',
                });
                return;
            }

            if (msg.toLowerCase() === 'off') {
                setWelcomeMsg(ctx.groupJid, null);
                await ctx.sock.sendMessage(ctx.groupJid, { text: '✅ Mensaje de bienvenida personalizado desactivado.' });
            } else {
                setWelcomeMsg(ctx.groupJid, msg);
                addAuditLog(ctx.groupJid, 'SET_WELCOME', ctx.senderJid, undefined, msg.substring(0, 100));
                await ctx.sock.sendMessage(ctx.groupJid, { text: `✅ Mensaje de bienvenida actualizado:\n\n${msg}` });
            }
        },
    });

    // ── !setbye ─────────────────────────────────────────────────
    registerCommand({
        name: 'setbye',
        description: 'Personalizar mensaje de despedida',
        usage: '!setbye Adiós {user}!',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const msg = ctx.args.join(' ');

            if (!msg) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Uso: !setbye [mensaje]\nVariables: {user}, {group}\nPara desactivar: !setbye off',
                });
                return;
            }

            if (msg.toLowerCase() === 'off') {
                setByeMsg(ctx.groupJid, null);
                await ctx.sock.sendMessage(ctx.groupJid, { text: '✅ Mensaje de despedida desactivado.' });
            } else {
                setByeMsg(ctx.groupJid, msg);
                await ctx.sock.sendMessage(ctx.groupJid, { text: `✅ Mensaje de despedida actualizado:\n\n${msg}` });
            }
        },
    });

    // ── !slowmode ───────────────────────────────────────────────
    registerCommand({
        name: 'slowmode',
        description: 'Activar/desactivar modo lento',
        usage: '!slowmode 30s / !slowmode off',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const arg = ctx.args[0];

            if (!arg) {
                const settings = getGroupSettings(ctx.groupJid);
                const status = settings.slowmode_seconds > 0
                    ? `Activo (${settings.slowmode_seconds}s)` : 'Desactivado';
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: `🐌 *Modo Lento:* ${status}\n\nUso: !slowmode 30s / !slowmode 1m / !slowmode off`,
                });
                return;
            }

            if (arg.toLowerCase() === 'off') {
                setSlowmode(ctx.groupJid, 0);
                addAuditLog(ctx.groupJid, 'SLOWMODE_OFF', ctx.senderJid);
                await ctx.sock.sendMessage(ctx.groupJid, { text: '✅ Modo lento desactivado.' });
                return;
            }

            let seconds = 0;
            if (arg.endsWith('s')) seconds = parseInt(arg);
            else if (arg.endsWith('m')) seconds = parseInt(arg) * 60;
            else seconds = parseInt(arg);

            if (isNaN(seconds) || seconds <= 0) {
                await ctx.sock.sendMessage(ctx.groupJid, { text: '⚠️ Tiempo inválido. Ej: 30s, 1m, 5m' });
                return;
            }

            setSlowmode(ctx.groupJid, seconds);
            addAuditLog(ctx.groupJid, 'SLOWMODE_ON', ctx.senderJid, undefined, `${seconds}s`);
            await ctx.sock.sendMessage(ctx.groupJid, {
                text: `🐌 Modo lento activado: *${seconds} segundos* entre mensajes por usuario.`,
            });
        },
    });

    // ── !logs ───────────────────────────────────────────────────
    registerCommand({
        name: 'logs',
        description: 'Ver registro de acciones de moderación',
        usage: '!logs o !logs @usuario',
        adminOnly: true,
        execute: async (ctx: CommandContext) => {
            const target = ctx.mentionedJids[0];
            let logs;

            if (target) {
                logs = getAuditLogsForUser(ctx.groupJid, target, 10);
            } else {
                logs = getAuditLogs(ctx.groupJid, 15);
            }

            if (logs.length === 0) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '📋 No hay registros de moderación.',
                });
                return;
            }

            let text = `📋 *Registro de Moderación* (${logs.length})\n\n`;
            logs.forEach((log, i) => {
                const actor = log.actor_jid.split('@')[0];
                const target = log.target_jid ? `→ ${log.target_jid.split('@')[0]}` : '';
                text += `${i + 1}. *${log.action}* por ${actor} ${target}\n`;
                if (log.details) text += `   📝 ${log.details}\n`;
                text += `   🕐 ${log.created_at}\n\n`;
            });

            await ctx.sock.sendMessage(ctx.groupJid, { text });
        },
    });

    // ── !dado ───────────────────────────────────────────────────
    registerCommand({
        name: 'dado',
        description: 'Tirar un dado (1-6)',
        usage: '!dado',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
            const result = Math.floor(Math.random() * 6);
            await ctx.sock.sendMessage(ctx.groupJid, {
                text: `🎲 ${faces[result]} — *${result + 1}*`,
            });
        },
    });

    // ── !moneda ─────────────────────────────────────────────────
    registerCommand({
        name: 'moneda',
        description: 'Lanzar una moneda (Cara o Cruz)',
        usage: '!moneda',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const result = Math.random() < 0.5;
            const emoji = result ? '🪙' : '💿';
            const text = result ? 'CARA' : 'CRUZ';
            await ctx.sock.sendMessage(ctx.groupJid, {
                text: `${emoji} — *¡${text}!*`,
            });
        },
    });

    // ── !traducir ───────────────────────────────────────────────
    registerCommand({
        name: 'traducir',
        description: 'Traducir texto a otro idioma con IA',
        usage: '!traducir en Hello world (o responder a un mensaje)',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const lang = ctx.args[0];
            const text = ctx.args.slice(1).join(' ') || ctx.quotedMessageBody;

            if (!lang || !text) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Uso: !traducir [idioma] [texto]\n\nEjemplos:\n• !traducir en Hola mundo\n• !traducir pt Buenos días\n• !traducir fr Te quiero\n\nTambién puedes responder a un mensaje.',
                });
                return;
            }

            const langMap: Record<string, string> = {
                en: 'inglés', es: 'español', pt: 'portugués', fr: 'francés',
                de: 'alemán', it: 'italiano', ja: 'japonés', ko: 'coreano',
                zh: 'chino', ru: 'ruso', ar: 'árabe', hi: 'hindi',
            };
            const targetLang = langMap[lang.toLowerCase()] || lang;

            await ctx.sock.sendPresenceUpdate('composing', ctx.groupJid);
            try {
                const response = await generateAIResponse(
                    `Traduce el siguiente texto a ${targetLang}. Solo responde con la traducción, sin explicaciones:\n\n"${text}"`
                );
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: `🌍 *Traducción (${targetLang}):*\n\n${response}`,
                });
            } catch {
                await ctx.sock.sendMessage(ctx.groupJid, { text: '❌ Error al traducir.' });
            } finally {
                await ctx.sock.sendPresenceUpdate('paused', ctx.groupJid);
            }
        },
    });

    // ── !clima ──────────────────────────────────────────────────
    registerCommand({
        name: 'clima',
        description: 'Ver el clima actual de una ciudad',
        usage: '!clima Lima',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const city = ctx.args.join(' ');

            if (!city) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Uso: !clima [ciudad]\nEjemplo: !clima Lima',
                });
                return;
            }

            try {
                const response = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
                if (!response.ok) throw new Error('City not found');

                const data = await response.json() as any;
                const current = data.current_condition?.[0];
                const area = data.nearest_area?.[0];

                if (!current) throw new Error('No data');

                const cityName = area?.areaName?.[0]?.value || city;
                const country = area?.country?.[0]?.value || '';
                const temp = current.temp_C;
                const feels = current.FeelsLikeC;
                const humidity = current.humidity;
                const wind = current.windspeedKmph;
                const desc = current.lang_es?.[0]?.value || current.weatherDesc?.[0]?.value || 'N/A';

                const text = `🌤️ *Clima en ${cityName}, ${country}*\n\n` +
                    `🌡️ *Temperatura:* ${temp}°C (Sensación: ${feels}°C)\n` +
                    `📝 *Estado:* ${desc}\n` +
                    `💧 *Humedad:* ${humidity}%\n` +
                    `💨 *Viento:* ${wind} km/h`;

                await ctx.sock.sendMessage(ctx.groupJid, { text });
            } catch {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ No se pudo obtener el clima. Verifica el nombre de la ciudad.',
                });
            }
        },
    });

    // ── !poll ───────────────────────────────────────────────────
    registerCommand({
        name: 'poll',
        description: 'Crear una encuesta',
        usage: '!poll Pregunta | Opción1 | Opción2 | Opción3',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const fullText = ctx.args.join(' ');
            const parts = fullText.split('|').map(p => p.trim()).filter(Boolean);

            if (parts.length < 3) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Uso: !poll Pregunta | Opción1 | Opción2\n\nEjemplo:\n!poll ¿Qué día nos reunimos? | Lunes | Martes | Miércoles',
                });
                return;
            }

            const question = parts[0];
            const options = parts.slice(1);

            if (options.length > 12) {
                await ctx.sock.sendMessage(ctx.groupJid, { text: '⚠️ Máximo 12 opciones.' });
                return;
            }

            await ctx.sock.sendMessage(ctx.groupJid, {
                poll: {
                    name: question,
                    values: options,
                    selectableCount: 1,
                },
            });
        },
    });

    // ── !sticker ────────────────────────────────────────────────
    registerCommand({
        name: 'sticker',
        description: 'Convertir imagen a sticker',
        usage: '!sticker (responde a una imagen)',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const quotedMsg = ctx.quotedMessage;
            const imageMsg = quotedMsg?.imageMessage || ctx.message.message?.imageMessage;

            if (!imageMsg) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes responder a una *imagen* con !sticker\nO enviar una imagen con el caption !sticker',
                });
                return;
            }

            try {
                const { downloadMediaMessage } = await import('@whiskeysockets/baileys');

                const msgType = 'imageMessage';
                const fakeMsg = {
                    key: ctx.message.key,
                    message: { [msgType]: imageMsg },
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

                // Try to use sharp for better quality, fallback to raw
                try {
                    const sharp = (await import('sharp')).default;
                    const webpBuffer = await sharp(buffer as Buffer)
                        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                        .webp({ quality: 80 })
                        .toBuffer();

                    await ctx.sock.sendMessage(ctx.groupJid, {
                        sticker: webpBuffer,
                    });
                } catch {
                    // Fallback: send as-is (Baileys will try to convert)
                    await ctx.sock.sendMessage(ctx.groupJid, {
                        sticker: buffer as Buffer,
                    });
                }
            } catch (err) {
                console.error('Error creating sticker:', err);
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ Error al crear el sticker. Intenta con otra imagen.',
                });
            }
        },
    });

    // ── !toimg ──────────────────────────────────────────────────
    registerCommand({
        name: 'toimg',
        description: 'Convertir sticker a imagen',
        usage: '!toimg (responde a un sticker)',
        adminOnly: false,
        execute: async (ctx: CommandContext) => {
            const quotedMsg = ctx.quotedMessage;
            const stickerMsg = quotedMsg?.stickerMessage;

            if (!stickerMsg) {
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '⚠️ Debes responder a un *sticker* con !toimg',
                });
                return;
            }

            try {
                const { downloadMediaMessage } = await import('@whiskeysockets/baileys');

                const fakeMsg = {
                    key: ctx.message.key,
                    message: { stickerMessage: stickerMsg },
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

                try {
                    const sharp = (await import('sharp')).default;
                    const pngBuffer = await sharp(buffer as Buffer)
                        .png()
                        .toBuffer();

                    await ctx.sock.sendMessage(ctx.groupJid, {
                        image: pngBuffer,
                        caption: '🖼️ Sticker convertido a imagen',
                    });
                } catch {
                    await ctx.sock.sendMessage(ctx.groupJid, {
                        image: buffer as Buffer,
                        caption: '🖼️ Sticker convertido a imagen',
                    });
                }
            } catch (err) {
                console.error('Error converting sticker:', err);
                await ctx.sock.sendMessage(ctx.groupJid, {
                    text: '❌ Error al convertir el sticker.',
                });
            }
        },
    });
}
