import Database from 'better-sqlite3';
import { config } from '../config';
import * as fs from 'fs';
import * as path from 'path';

// Ensure data directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(config.dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_jid TEXT NOT NULL,
    user_jid TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT 'auto-moderation',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS banned_users (
    group_jid TEXT NOT NULL,
    user_jid TEXT NOT NULL,
    banned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_jid, user_jid)
  );

  CREATE TABLE IF NOT EXISTS muted_users (
    group_jid TEXT NOT NULL,
    user_jid TEXT NOT NULL,
    muted_until INTEGER NOT NULL,
    muted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_jid, user_jid)
  );

  CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(group_jid, user_jid);
`);

// ── Prepared Statements ──────────────────────────────────────────

// Warnings
const stmtAddWarning = db.prepare(
    'INSERT INTO warnings (group_jid, user_jid, reason) VALUES (?, ?, ?)'
);
const stmtGetWarningCount = db.prepare(
    'SELECT COUNT(*) as count FROM warnings WHERE group_jid = ? AND user_jid = ?'
);
const stmtGetWarnings = db.prepare(
    'SELECT id, reason, created_at FROM warnings WHERE group_jid = ? AND user_jid = ? ORDER BY created_at DESC'
);
const stmtResetWarnings = db.prepare(
    'DELETE FROM warnings WHERE group_jid = ? AND user_jid = ?'
);

// Bans
const stmtAddBan = db.prepare(
    'INSERT OR IGNORE INTO banned_users (group_jid, user_jid) VALUES (?, ?)'
);
const stmtIsBanned = db.prepare(
    'SELECT 1 FROM banned_users WHERE group_jid = ? AND user_jid = ?'
);
const stmtRemoveBan = db.prepare(
    'DELETE FROM banned_users WHERE group_jid = ? AND user_jid = ?'
);
const stmtGetBannedUsers = db.prepare(
    'SELECT user_jid, banned_at FROM banned_users WHERE group_jid = ? ORDER BY banned_at DESC'
);

// Mutes
const stmtMuteUser = db.prepare(
    'INSERT OR REPLACE INTO muted_users (group_jid, user_jid, muted_until) VALUES (?, ?, ?)'
);
const stmtUnmuteUser = db.prepare(
    'DELETE FROM muted_users WHERE group_jid = ? AND user_jid = ?'
);
const stmtIsMuted = db.prepare(
    'SELECT muted_until FROM muted_users WHERE group_jid = ? AND user_jid = ?'
);
const stmtCleanExpiredMutes = db.prepare(
    'DELETE FROM muted_users WHERE muted_until <= ?'
);

// ── Exported functions ───────────────────────────────────────────

// Warnings
export function addWarning(groupJid: string, userJid: string, reason: string = 'auto-moderation'): number {
    stmtAddWarning.run(groupJid, userJid, reason);
    const result = stmtGetWarningCount.get(groupJid, userJid) as { count: number };
    return result.count;
}

export function getWarningCount(groupJid: string, userJid: string): number {
    const result = stmtGetWarningCount.get(groupJid, userJid) as { count: number };
    return result.count;
}

export function getWarnings(groupJid: string, userJid: string): Array<{ id: number; reason: string; created_at: string }> {
    return stmtGetWarnings.all(groupJid, userJid) as Array<{ id: number; reason: string; created_at: string }>;
}

export function resetWarnings(groupJid: string, userJid: string): void {
    stmtResetWarnings.run(groupJid, userJid);
}

// Bans
export function addBan(groupJid: string, userJid: string): void {
    stmtAddBan.run(groupJid, userJid);
}

export function isBanned(groupJid: string, userJid: string): boolean {
    return !!stmtIsBanned.get(groupJid, userJid);
}

export function removeBan(groupJid: string, userJid: string): void {
    stmtRemoveBan.run(groupJid, userJid);
}

export function getBannedUsers(groupJid: string): Array<{ user_jid: string; banned_at: string }> {
    return stmtGetBannedUsers.all(groupJid) as Array<{ user_jid: string; banned_at: string }>;
}

// Mutes
export function muteUser(groupJid: string, userJid: string, mutedUntilMs: number): void {
    stmtMuteUser.run(groupJid, userJid, mutedUntilMs);
}

export function unmuteUser(groupJid: string, userJid: string): void {
    stmtUnmuteUser.run(groupJid, userJid);
}

export function isMuted(groupJid: string, userJid: string): boolean {
    const result = stmtIsMuted.get(groupJid, userJid) as { muted_until: number } | undefined;
    if (!result) return false;
    if (result.muted_until <= Date.now()) {
        // Expired, auto-cleanup
        stmtUnmuteUser.run(groupJid, userJid);
        return false;
    }
    return true;
}

export function getMutedUntil(groupJid: string, userJid: string): number | null {
    const result = stmtIsMuted.get(groupJid, userJid) as { muted_until: number } | undefined;
    if (!result || result.muted_until <= Date.now()) return null;
    return result.muted_until;
}

export function cleanExpiredMutes(): void {
    stmtCleanExpiredMutes.run(Date.now());
}
