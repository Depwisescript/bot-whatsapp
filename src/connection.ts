import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import { config } from './config';
import { initCommands } from './commands/index';
import { setupMessageHandler } from './handlers/message.handler';
import { setupGroupHandler } from './handlers/group.handler';
import { cleanupSpamTracker } from './handlers/moderation.handler';
import { startPanel } from './panel/panel';
import { closeDatabase, getDueReminders, deleteReminder } from './services/db.service';

const logger = pino({ level: 'silent' });

// Initialize commands once
initCommands();

// Cleanup spam tracker every 60 seconds
setInterval(cleanupSpamTracker, 60_000);

// Start the admin panel (only once)
let panelStarted = false;

// ── Reminder Worker ──────────────────────────────────────────────
let reminderInterval: NodeJS.Timeout | null = null;

function startReminderWorker(sock: any) {
    if (reminderInterval) clearInterval(reminderInterval);
    
    reminderInterval = setInterval(async () => {
        try {
            const due = getDueReminders();
            for (const rem of due) {
                await sock.sendMessage(rem.group_jid, {
                    text: `⏰ *RECORDATORIO*\n\nHola @${rem.user_jid.split('@')[0]}, me pediste que te recordara esto:\n\n📝 "${rem.message}"`,
                    mentions: [rem.user_jid]
                });
                deleteReminder(rem.id);
            }
        } catch (err) {
            console.error('Error in reminder worker:', err);
        }
    }, 60_000); // Check every minute
}

export let globalQR = '';
export let globalStatus = 'connecting'; // 'connecting', 'qr', 'connected', 'disconnected'
export let globalSock: any = null;
export let globalPaused = false;
export function setPaused(v: boolean) { globalPaused = v; } // Exposed for panel interaction

export async function startBot(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: true,
    });
    
    globalSock = sock;

    // Persist credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Connection state handler
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            globalQR = qr;
            globalStatus = 'qr';
            console.log('\n📱 Escanea el código QR con tu teléfono WhatsApp:\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            globalStatus = 'disconnected';
            globalQR = '';
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

            if (statusCode === DisconnectReason.loggedOut) {
                console.log('❌ Sesión cerrada. Limpiando credenciales para generar nuevo QR...');
                try {
                    const fs = require('fs');
                    fs.rmSync(config.authDir, { recursive: true, force: true });
                } catch (e) {}
                setTimeout(startBot, 2000);
            } else {
                // Reconnect on any other disconnect reason
                console.log(`⚡ Reconectando... (razón: ${statusCode || 'desconocida'})`);
                setTimeout(startBot, 3000);
            }
        }

        if (connection === 'open') {
            globalQR = '';
            globalStatus = 'connected';
            console.log('');
            console.log('╔══════════════════════════════════════╗');
            console.log('║  ✅ Bot conectado exitosamente       ║');
            console.log('║  📋 Comandos listos con prefijo: ' + config.prefix + '   ║');
            console.log('║  🛡️  Auto-moderación activa          ║');
            console.log('╚══════════════════════════════════════╝');
            console.log('');
        }
    });

    // Set up event handlers
    setupMessageHandler(sock);
    setupGroupHandler(sock);
    
    // Start background workers
    startReminderWorker(sock);

    // ── Graceful Shutdown ─────────────────────────────────────────
    const shutdown = () => {
        console.log('\n🛑 Cerrando bot de forma segura...');
        if (reminderInterval) clearInterval(reminderInterval);
        closeDatabase();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
