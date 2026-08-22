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

  CREATE TABLE IF NOT EXISTS group_settings (
    group_jid TEXT PRIMARY KEY,
    welcome_msg TEXT DEFAULT NULL,
    bye_msg TEXT DEFAULT NULL,
    slowmode_seconds INTEGER DEFAULT 0,
    anti_nsfw INTEGER DEFAULT 0,
    levels_enabled INTEGER DEFAULT 1,
    auto_approve INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_levels (
    group_jid TEXT NOT NULL,
    user_jid TEXT NOT NULL,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    messages_count INTEGER DEFAULT 0,
    last_xp_at INTEGER DEFAULT 0,
    PRIMARY KEY (group_jid, user_jid)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_jid TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_jid TEXT NOT NULL,
    target_jid TEXT DEFAULT NULL,
    details TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_jid TEXT NOT NULL,
    user_jid TEXT NOT NULL,
    message TEXT NOT NULL,
    remind_at INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(group_jid, user_jid);
  CREATE INDEX IF NOT EXISTS idx_user_levels ON user_levels(group_jid, level DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_log ON audit_log(group_jid, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_reminders ON reminders(remind_at);
`);

try {
    db.exec('ALTER TABLE group_settings ADD COLUMN auto_approve INTEGER DEFAULT 0');
} catch (e) {
    // Column already exists
}

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
const stmtGetAllWarnings = db.prepare(
    'SELECT group_jid, user_jid, COUNT(*) as count, MAX(created_at) as last_warning FROM warnings GROUP BY group_jid, user_jid ORDER BY count DESC'
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

// Group Settings
const stmtGetGroupSettings = db.prepare(
    'SELECT * FROM group_settings WHERE group_jid = ?'
);
const stmtSetGroupSetting = db.prepare(
    `INSERT INTO group_settings (group_jid) VALUES (?)
     ON CONFLICT(group_jid) DO NOTHING`
);
const stmtUpdateWelcome = db.prepare(
    `INSERT INTO group_settings (group_jid, welcome_msg) VALUES (?, ?)
     ON CONFLICT(group_jid) DO UPDATE SET welcome_msg = ?, updated_at = CURRENT_TIMESTAMP`
);
const stmtUpdateBye = db.prepare(
    `INSERT INTO group_settings (group_jid, bye_msg) VALUES (?, ?)
     ON CONFLICT(group_jid) DO UPDATE SET bye_msg = ?, updated_at = CURRENT_TIMESTAMP`
);
const stmtUpdateSlowmode = db.prepare(
    `INSERT INTO group_settings (group_jid, slowmode_seconds) VALUES (?, ?)
     ON CONFLICT(group_jid) DO UPDATE SET slowmode_seconds = ?, updated_at = CURRENT_TIMESTAMP`
);
const stmtUpdateAntiNsfw = db.prepare(
    `INSERT INTO group_settings (group_jid, anti_nsfw) VALUES (?, ?)
     ON CONFLICT(group_jid) DO UPDATE SET anti_nsfw = ?, updated_at = CURRENT_TIMESTAMP`
);
const stmtUpdateAutoApprove = db.prepare(
    `INSERT INTO group_settings (group_jid, auto_approve) VALUES (?, ?)
     ON CONFLICT(group_jid) DO UPDATE SET auto_approve = ?, updated_at = CURRENT_TIMESTAMP`
);

// User Levels
const stmtGetUserLevel = db.prepare(
    'SELECT * FROM user_levels WHERE group_jid = ? AND user_jid = ?'
);
const stmtUpsertUserXP = db.prepare(
    `INSERT INTO user_levels (group_jid, user_jid, xp, level, messages_count, last_xp_at)
     VALUES (?, ?, ?, 1, 1, ?)
     ON CONFLICT(group_jid, user_jid) DO UPDATE SET
       xp = xp + ?,
       messages_count = messages_count + 1,
       last_xp_at = ?`
);
const stmtSetUserLevel = db.prepare(
    'UPDATE user_levels SET level = ? WHERE group_jid = ? AND user_jid = ?'
);
const stmtGetTopLevels = db.prepare(
    'SELECT * FROM user_levels WHERE group_jid = ? ORDER BY xp DESC LIMIT ?'
);

// Audit Log
const stmtAddAudit = db.prepare(
    'INSERT INTO audit_log (group_jid, action, actor_jid, target_jid, details) VALUES (?, ?, ?, ?, ?)'
);
const stmtGetAuditLogs = db.prepare(
    'SELECT * FROM audit_log WHERE group_jid = ? ORDER BY created_at DESC LIMIT ?'
);
const stmtGetAuditLogsUser = db.prepare(
    'SELECT * FROM audit_log WHERE group_jid = ? AND (actor_jid = ? OR target_jid = ?) ORDER BY created_at DESC LIMIT ?'
);

// Reminders
const stmtAddReminder = db.prepare(
    'INSERT INTO reminders (group_jid, user_jid, message, remind_at) VALUES (?, ?, ?, ?)'
);
const stmtGetDueReminders = db.prepare(
    'SELECT * FROM reminders WHERE remind_at <= ?'
);
const stmtDeleteReminder = db.prepare(
    'DELETE FROM reminders WHERE id = ?'
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

export function getAllWarnings(): Array<{ group_jid: string; user_jid: string; count: number; last_warning: string }> {
    return stmtGetAllWarnings.all() as any;
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

// ── Group Settings ──────────────────────────────────────────────

export interface GroupSettings {
    group_jid: string;
    welcome_msg: string | null;
    bye_msg: string | null;
    slowmode_seconds: number;
    anti_nsfw: number;
    levels_enabled: number;
    auto_approve: number;
}

export function getGroupSettings(groupJid: string): GroupSettings {
    const row = stmtGetGroupSettings.get(groupJid) as GroupSettings | undefined;
    return row || { group_jid: groupJid, welcome_msg: null, bye_msg: null, slowmode_seconds: 0, anti_nsfw: 0, levels_enabled: 1, auto_approve: 0 };
}

export function setWelcomeMsg(groupJid: string, msg: string | null): void {
    stmtUpdateWelcome.run(groupJid, msg, msg);
}

export function setByeMsg(groupJid: string, msg: string | null): void {
    stmtUpdateBye.run(groupJid, msg, msg);
}

export function setSlowmode(groupJid: string, seconds: number): void {
    stmtUpdateSlowmode.run(groupJid, seconds, seconds);
}

export function setAntiNsfw(groupJid: string, enabled: boolean): void {
    const val = enabled ? 1 : 0;
    stmtUpdateAntiNsfw.run(groupJid, val, val);
}

export function setAutoApprove(groupJid: string, enabled: boolean): void {
    const val = enabled ? 1 : 0;
    stmtUpdateAutoApprove.run(groupJid, val, val);
}

// ── User Levels ─────────────────────────────────────────────────

export interface UserLevel {
    group_jid: string;
    user_jid: string;
    xp: number;
    level: number;
    messages_count: number;
    last_xp_at: number;
}

/** XP needed for a given level */
export function xpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.5));
}

/** Add XP to a user, returns { leveled_up, new_level, xp, total_xp } */
export function addUserXP(groupJid: string, userJid: string): { leveled_up: boolean; new_level: number; xp: number } {
    const now = Date.now();
    const existing = stmtGetUserLevel.get(groupJid, userJid) as UserLevel | undefined;

    // Cooldown: only award XP once per 60 seconds
    if (existing && (now - existing.last_xp_at) < 60_000) {
        // Just increment message count, no XP
        db.prepare('UPDATE user_levels SET messages_count = messages_count + 1 WHERE group_jid = ? AND user_jid = ?').run(groupJid, userJid);
        return { leveled_up: false, new_level: existing.level, xp: existing.xp };
    }

    const xpGain = Math.floor(Math.random() * 11) + 10; // 10-20 XP
    stmtUpsertUserXP.run(groupJid, userJid, xpGain, now, xpGain, now);

    const updated = stmtGetUserLevel.get(groupJid, userJid) as UserLevel;
    const neededXP = xpForLevel(updated.level);

    if (updated.xp >= neededXP) {
        const newLevel = updated.level + 1;
        stmtSetUserLevel.run(newLevel, groupJid, userJid);
        return { leveled_up: true, new_level: newLevel, xp: updated.xp };
    }

    return { leveled_up: false, new_level: updated.level, xp: updated.xp };
}

export function getUserLevel(groupJid: string, userJid: string): UserLevel {
    const row = stmtGetUserLevel.get(groupJid, userJid) as UserLevel | undefined;
    return row || { group_jid: groupJid, user_jid: userJid, xp: 0, level: 1, messages_count: 0, last_xp_at: 0 };
}

export function getTopLevels(groupJid: string, limit: number = 10): UserLevel[] {
    return stmtGetTopLevels.all(groupJid, limit) as UserLevel[];
}

// ── Audit Log ───────────────────────────────────────────────────

export interface AuditEntry {
    id: number;
    group_jid: string;
    action: string;
    actor_jid: string;
    target_jid: string | null;
    details: string | null;
    created_at: string;
}

export function addAuditLog(groupJid: string, action: string, actorJid: string, targetJid?: string, details?: string): void {
    stmtAddAudit.run(groupJid, action, actorJid, targetJid || null, details || null);
}

export function getAuditLogs(groupJid: string, limit: number = 10): AuditEntry[] {
    return stmtGetAuditLogs.all(groupJid, limit) as AuditEntry[];
}

export function getAuditLogsForUser(groupJid: string, userJid: string, limit: number = 10): AuditEntry[] {
    return stmtGetAuditLogsUser.all(groupJid, userJid, userJid, limit) as AuditEntry[];
}

// ── Reminders ───────────────────────────────────────────────────

export interface Reminder {
    id: number;
    group_jid: string;
    user_jid: string;
    message: string;
    remind_at: number;
}

export function addReminder(groupJid: string, userJid: string, message: string, remindAtMs: number): void {
    stmtAddReminder.run(groupJid, userJid, message, remindAtMs);
}

export function getDueReminders(): Reminder[] {
    return stmtGetDueReminders.all(Date.now()) as Reminder[];
}

export function deleteReminder(id: number): void {
    stmtDeleteReminder.run(id);
}

// ── Graceful shutdown ───────────────────────────────────────────
export function closeDatabase(): void {
    db.close();
}
