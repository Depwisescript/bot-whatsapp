import Database from 'better-sqlite3';
import { config } from '../config';
import * as fs from 'fs';
import * as path from 'path';

// ── Files storage directory ──────────────────────────────────────
const filesDir = path.resolve('./data/files');
if (!fs.existsSync(filesDir)) {
    fs.mkdirSync(filesDir, { recursive: true });
}

// ── Database connection (reuse the same DB) ──────────────────────
const db = new Database(config.dbPath);

// Create shared_files table
db.exec(`
  CREATE TABLE IF NOT EXISTS shared_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    size INTEGER NOT NULL DEFAULT 0,
    file_path TEXT NOT NULL,
    group_jid TEXT NOT NULL DEFAULT 'global',
    uploaded_by TEXT NOT NULL DEFAULT 'panel',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Drop the old unique index to allow multiple files per category/name
db.exec(`DROP INDEX IF EXISTS idx_shared_files_name_group;`);

// ── Prepared Statements ──────────────────────────────────────────
const stmtSaveFile = db.prepare(
    `INSERT INTO shared_files (name, original_name, mime_type, size, file_path, group_jid, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const stmtGetFiles = db.prepare(
    'SELECT * FROM shared_files WHERE name = ? AND (group_jid = ? OR group_jid = \'global\') ORDER BY created_at ASC'
);
const stmtGetFilesGlobal = db.prepare(
    'SELECT * FROM shared_files WHERE name = ? ORDER BY created_at ASC'
);
const stmtDeleteFile = db.prepare(
    'DELETE FROM shared_files WHERE name = ? AND (group_jid = ? OR group_jid = \'global\')'
);
const stmtListFiles = db.prepare(
    'SELECT * FROM shared_files WHERE group_jid = ? OR group_jid = \'global\' ORDER BY created_at DESC'
);
const stmtListAllFiles = db.prepare(
    'SELECT * FROM shared_files ORDER BY created_at DESC'
);
const stmtCountFiles = db.prepare(
    'SELECT COUNT(*) as count FROM shared_files WHERE group_jid = ? OR group_jid = \'global\''
);
const stmtGetSingleFile = db.prepare(
    'SELECT * FROM shared_files WHERE group_jid = ? OR group_jid = \'global\' LIMIT 1'
);
const stmtDeleteById = db.prepare(
    'DELETE FROM shared_files WHERE id = ?'
);
const stmtGetById = db.prepare(
    'SELECT * FROM shared_files WHERE id = ?'
);

// ── Types ────────────────────────────────────────────────────────
export interface SharedFile {
    id: number;
    name: string;
    original_name: string;
    mime_type: string;
    size: number;
    file_path: string;
    group_jid: string;
    uploaded_by: string;
    created_at: string;
}

// ── Exported Functions ───────────────────────────────────────────

/**
 * Save a file to disk and register it in the database.
 */
export function saveSharedFile(
    name: string,
    originalName: string,
    mimeType: string,
    buffer: Buffer,
    groupJid: string = 'global',
    uploadedBy: string = 'panel'
): SharedFile {
    // Sanitize the name for filesystem
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    
    // Determine extension from original name
    const ext = path.extname(originalName) || getExtFromMime(mimeType);
    const fileName = `${safeName}${ext}`;
    const filePath = path.join(filesDir, fileName);

    // Write file to disk
    fs.writeFileSync(filePath, buffer);

    // Insert into DB
    const result = stmtSaveFile.run(safeName, originalName, mimeType, buffer.length, filePath, groupJid, uploadedBy);
    const newId = result.lastInsertRowid as number;

    return (stmtGetById.get(newId) as SharedFile)!;
}

/**
 * Get shared files by name and optional group.
 */
export function getSharedFiles(name: string, groupJid: string = 'global'): SharedFile[] {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    return stmtGetFiles.all(safeName, groupJid) as SharedFile[];
}

/**
 * Get shared files by name (any group).
 */
export function getSharedFilesGlobal(name: string): SharedFile[] {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    return stmtGetFilesGlobal.all(safeName) as SharedFile[];
}

/**
 * Delete ALL shared files by name (used carefully now, prefer deleteById).
 */
export function deleteSharedFile(name: string, groupJid: string = 'global'): boolean {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const files = getSharedFiles(safeName, groupJid);
    if (files.length > 0) {
        // Remove from disk
        files.forEach(file => {
            try {
                if (fs.existsSync(file.file_path)) {
                    fs.unlinkSync(file.file_path);
                }
            } catch { /* ignore */ }
        });
        stmtDeleteFile.run(safeName, groupJid);
        return true;
    }
    return false;
}

/**
 * Delete a shared file by its database ID.
 */
export function deleteSharedFileById(id: number): boolean {
    const file = stmtGetById.get(id) as SharedFile | undefined;
    if (file) {
        try {
            if (fs.existsSync(file.file_path)) {
                fs.unlinkSync(file.file_path);
            }
        } catch { /* ignore */ }
        stmtDeleteById.run(id);
        return true;
    }
    return false;
}

/**
 * List all shared files for a group (includes global).
 */
export function listSharedFiles(groupJid: string): SharedFile[] {
    return stmtListFiles.all(groupJid) as SharedFile[];
}

/**
 * List ALL shared files across all groups.
 */
export function listAllSharedFiles(): SharedFile[] {
    return stmtListAllFiles.all() as SharedFile[];
}

/**
 * Count shared files for a group.
 */
export function countSharedFiles(groupJid: string): number {
    const result = stmtCountFiles.get(groupJid) as { count: number };
    return result.count;
}

/**
 * Get the single file for a group (when only 1 exists).
 */
export function getSingleFile(groupJid: string): SharedFile | null {
    return (stmtGetSingleFile.get(groupJid) as SharedFile) || null;
}

/**
 * Read the file buffer from disk.
 */
export function readFileBuffer(filePath: string): Buffer | null {
    try {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath);
        }
    } catch { /* ignore */ }
    return null;
}

/**
 * Get the files storage directory path.
 */
export function getFilesDir(): string {
    return filesDir;
}

// ── Helpers ──────────────────────────────────────────────────────
function getExtFromMime(mime: string): string {
    const mimeMap: Record<string, string> = {
        'application/pdf': '.pdf',
        'application/zip': '.zip',
        'application/x-rar-compressed': '.rar',
        'application/vnd.android.package-archive': '.apk',
        'application/octet-stream': '.bin',
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'video/mp4': '.mp4',
        'audio/mpeg': '.mp3',
        'text/plain': '.txt',
        'application/json': '.json',
    };
    return mimeMap[mime] || '.bin';
}
