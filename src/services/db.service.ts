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

  CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(group_jid, user_jid);
`);

// Prepared statements
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

const stmtAddBan = db.prepare(
    'INSERT OR IGNORE INTO banned_users (group_jid, user_jid) VALUES (?, ?)'
);

const stmtIsBanned = db.prepare(
    'SELECT 1 FROM banned_users WHERE group_jid = ? AND user_jid = ?'
);

const stmtRemoveBan = db.prepare(
    'DELETE FROM banned_users WHERE group_jid = ? AND user_jid = ?'
);

// Exported functions
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

export function addBan(groupJid: string, userJid: string): void {
    stmtAddBan.run(groupJid, userJid);
}

export function isBanned(groupJid: string, userJid: string): boolean {
    return !!stmtIsBanned.get(groupJid, userJid);
}

export function removeBan(groupJid: string, userJid: string): void {
    stmtRemoveBan.run(groupJid, userJid);
}
