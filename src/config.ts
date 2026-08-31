import 'dotenv/config';

export const config = {
    /** Command prefix (e.g., "!" for "!kick") */
    prefix: process.env.BOT_PREFIX || '!',

    /** Owner phone number (country code + number, no + or spaces) */
    ownerNumber: process.env.OWNER_NUMBER || '',

    /** Mensaje de respuesta automática para mensajes privados (DMs) */
    autoReplyMsg: process.env.AUTO_REPLY_MSG || 'Hola 👋\nEste es un bot de administración de grupos.\n\nPara ventas o consultas directas, por favor contáctame a mi número principal:\n📱 wa.me/51956815890',

    /** Gemini API Key for answering queries */
    geminiApiKeys: (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(k => k.length > 0),
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',

    /** Custom API Key (OpenAI, Groq, DeepSeek, etc) */
    openAiApiKey: process.env.OPENAI_API_KEY || '',

    /** Custom API Base URL */
    openAiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',

    /** Custom Model Name */
    openAiModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',

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
    maxWarnings: parseInt(process.env.MAX_WARNINGS || '4', 10),

    /** Banned words (comma-separated in .env, e.g. "puta,mierda,hdp") */
    bannedWords: (process.env.BANNED_WORDS || '')
        .split(',')
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean),

    /** Group metadata cache TTL in milliseconds (5 minutes) */
    metadataCacheTTL: 5 * 60 * 1000,

    /** Bot start time for uptime tracking */
    startTime: Date.now(),

    /** Files directory for shared files */
    filesDir: './data/files',

    /** Panel web port */
    panelPort: parseInt(process.env.PANEL_PORT || '3001', 10),

    /** Panel admin username */
    panelUser: process.env.PANEL_USER || 'admin',

    /** Panel admin password */
    panelPass: process.env.PANEL_PASS || '',

    /** Proxy SOCKS5 para yt-dlp */
    youtubeProxy: process.env.YOUTUBE_PROXY || 'socks5://38.250.116.74:1080',
};
