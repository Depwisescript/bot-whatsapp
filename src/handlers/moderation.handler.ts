import { WASocket, proto } from '@whiskeysockets/baileys';
import { config } from '../config';
import { addWarning, getWarningCount } from '../services/db.service';

// ── Anti-Spam: track message timestamps per user ──────────────
const messageTimestamps = new Map<string, number[]>();

// ── Regex for forbidden links ─────────────────────────────────
const FORBIDDEN_LINK_PATTERNS = [
    /chat\.whatsapp\.com\/[A-Za-z0-9]+/i,         // WhatsApp group invite links
    /wa\.me\/[A-Za-z0-9]+/i,                       // WhatsApp short links
    /t\.me\/[A-Za-z0-9_]+/i,                       // Telegram group/channel links
    /telegram\.me\/[A-Za-z0-9_]+/i,                // Telegram alternative links
    /discord\.gg\/[A-Za-z0-9]+/i,                  // Discord invite links
];

// Keywords that indicate sales/promotion combined with contact info
const SALES_KEYWORDS = [
    'vendo', 'venta', 'ventas', 'promoción', 'promocion', 'promo',
    'oferta', 'ofertas', 'negocio', 'contactar', 'contactame',
    'contacteme', 'escribeme', 'precio', 'precios',
    'compra', 'comprar', 'descuento', 'descuentos',
    'interesados', 'disponible', 'dm', 'inbox',
    'mayoreo', 'menudeo', 'al por mayor',
];

// Contact patterns (phone numbers, social media)
const CONTACT_PATTERNS = [
    /\+?\d{8,15}/,                                  // Phone numbers
    /instagram\.com/i,
    /facebook\.com/i,
    /fb\.com/i,
];

/**
 * Result of moderation check
 */
export interface ModerationResult {
    /** Whether the message violates rules */
    violation: boolean;
    /** Type of violation */
    type: 'link' | 'spam' | 'sales' | null;
    /** Reason description */
    reason: string;
}

/**
 * Check a message for rule violations.
 * Returns a ModerationResult indicating if the message should be moderated.
 */
export function checkMessage(body: string, senderJid: string, groupJid: string): ModerationResult {
    // ── Check forbidden links ──
    for (const pattern of FORBIDDEN_LINK_PATTERNS) {
        if (pattern.test(body)) {
            return {
                violation: true,
                type: 'link',
                reason: 'Enlace de grupo/canal no autorizado',
            };
        }
    }

    // ── Check sales/promotion ──
    const lowerBody = body.toLowerCase();
    const hasSalesKeyword = SALES_KEYWORDS.some((kw) => lowerBody.includes(kw));
    const hasContact = CONTACT_PATTERNS.some((pattern) => pattern.test(body));

    if (hasSalesKeyword && hasContact) {
        return {
            violation: true,
            type: 'sales',
            reason: 'Promoción de ventas / publicidad no autorizada',
        };
    }

    // ── Check spam/flood ──
    const key = `${groupJid}:${senderJid}`;
    const now = Date.now();
    const timestamps = messageTimestamps.get(key) || [];

    // Remove timestamps outside the window
    const windowMs = config.antiSpamWindowSeconds * 1000;
    const recent = timestamps.filter((t) => now - t < windowMs);
    recent.push(now);
    messageTimestamps.set(key, recent);

    if (recent.length > config.antiSpamMaxMessages) {
        // Reset to avoid re-triggering instantly
        messageTimestamps.set(key, []);
        return {
            violation: true,
            type: 'spam',
            reason: `Spam/flood detectado (${config.antiSpamMaxMessages}+ mensajes en ${config.antiSpamWindowSeconds}s)`,
        };
    }

    return { violation: false, type: null, reason: '' };
}

/**
 * Handle a moderation violation:
 * - Strike 1: delete message + send warning
 * - Strike 2: delete message + kick user
 */
export async function handleViolation(
    sock: WASocket,
    message: proto.IWebMessageInfo,
    groupJid: string,
    senderJid: string,
    result: ModerationResult
): Promise<void> {
    // Delete the offending message
    try {
        if (message.key) {
            await sock.sendMessage(groupJid, {
                delete: message.key as proto.IMessageKey,
            });
        }
    } catch (err) {
        console.error('Error deleting message:', err);
    }

    // Add warning to DB and get total count
    const warningCount = addWarning(groupJid, senderJid, result.reason);

    if (warningCount >= config.maxWarnings) {
        // ── Strike 2: KICK ──
        try {
            await sock.groupParticipantsUpdate(groupJid, [senderJid], 'remove');
            await sock.sendMessage(groupJid, {
                text: `🚨 @${senderJid.split('@')[0]} ha sido expulsado del grupo.\n\n📋 Razón: ${result.reason}\n⚠️ Advertencias: ${warningCount}/${config.maxWarnings}\n\n_Ha alcanzado el límite de advertencias._`,
                mentions: [senderJid],
            });
        } catch (err) {
            console.error('Error kicking user:', err);
        }
    } else {
        // ── Strike 1: WARNING ──
        await sock.sendMessage(groupJid, {
            text: `⚠️ *ADVERTENCIA* para @${senderJid.split('@')[0]}\n\n📋 Razón: ${result.reason}\n🔢 Advertencias: ${warningCount}/${config.maxWarnings}\n\n⚡ *La próxima infracción resultará en expulsión inmediata.*\n\n_Revisa las reglas con !rules_`,
            mentions: [senderJid],
        });
    }
}

/**
 * Clean up old spam tracking data periodically
 */
export function cleanupSpamTracker(): void {
    const now = Date.now();
    const windowMs = config.antiSpamWindowSeconds * 1000 * 2;

    for (const [key, timestamps] of messageTimestamps) {
        const recent = timestamps.filter((t) => now - t < windowMs);
        if (recent.length === 0) {
            messageTimestamps.delete(key);
        } else {
            messageTimestamps.set(key, recent);
        }
    }
}
