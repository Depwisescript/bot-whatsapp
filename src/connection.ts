import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { config } from './config';
import { initCommands } from './commands/index';
import { setupMessageHandler } from './handlers/message.handler';
import { setupGroupHandler } from './handlers/group.handler';
import { cleanupSpamTracker } from './handlers/moderation.handler';

const logger = pino({ level: 'silent' });

// Initialize commands once
initCommands();

// Cleanup spam tracker every 60 seconds
setInterval(cleanupSpamTracker, 60_000);

export async function startBot(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: true,
        logger,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: true,
    });

    // Persist credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Connection state handler
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📱 Escanea el código QR con tu teléfono WhatsApp\n');
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

            if (statusCode === DisconnectReason.loggedOut) {
                console.log('❌ Sesión cerrada. Elimina la carpeta auth_info/ y escanea el QR nuevamente.');
                process.exit(1);
            }

            // Reconnect on any other disconnect reason
            console.log(`⚡ Reconectando... (razón: ${statusCode || 'desconocida'})`);
            setTimeout(startBot, 3000);
        }

        if (connection === 'open') {
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
}
