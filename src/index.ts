import { startBot } from './connection';

console.log('🤖 WhatsApp Group Bot v1.0.0');
console.log('────────────────────────────');

startBot().catch((err) => {
    console.error('Fatal error starting bot:', err);
    process.exit(1);
});
