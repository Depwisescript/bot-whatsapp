import 'dotenv/config';

export const config = {
    /** Command prefix (e.g., "!" for "!kick") */
    prefix: process.env.BOT_PREFIX || '!',

    /** Owner phone number (country code + number, no + or spaces) */
    ownerNumber: process.env.OWNER_NUMBER || '',

    /** Node environment */
    nodeEnv: process.env.NODE_ENV || 'development',

    /** Auth session directory */
    authDir: './auth_info',

    /** SQLite database path */
    dbPath: './data/bot.db',

    /** Anti-spam: max messages in window before triggering */
    antiSpamMaxMessages: 5,

    /** Anti-spam: time window in seconds */
    antiSpamWindowSeconds: 10,

    /** Max warnings before auto-kick */
    maxWarnings: 2,
};
