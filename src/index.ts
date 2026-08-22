import { startBot } from './connection';
import { startPanel } from './panel/panel';

console.log('🤖 WhatsApp Group Bot v1.0.0');
console.log('────────────────────────────');

// Start the web panel independent of WhatsApp connection
startPanel();

startBot().catch((err) => {
    console.error('Fatal error starting bot:', err);
    process.exit(1);
});
