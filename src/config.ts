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

    /** Banned words (comma-separated in .env, e.g. "puta,mierda,hdp") */
    bannedWords: (process.env.BANNED_WORDS || '')
        .split(',')
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean),

    /** Group metadata cache TTL in milliseconds (5 minutes) */
    metadataCacheTTL: 5 * 60 * 1000,

    /** Bot start time for uptime tracking */
    startTime: Date.now(),
};
