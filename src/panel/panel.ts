import express from 'express';
import multer from 'multer';
import * as path from 'path';
import { config } from '../config';
import {
    saveSharedFile,
    listAllSharedFiles,
    deleteSharedFileById,
    getFilesDir,
} from '../services/file.service';
import { globalQR, globalStatus, globalSock } from '../connection';


const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB max

/**
 * Start the admin panel web server.
 */
export function startPanel(): void {
    if (!config.panelPass) {
        console.log('⚠️  Panel desactivado: Define PANEL_PASS en .env para habilitarlo');
        return;
    }

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // ── Simple session via cookie ────────────────────────────────
    const sessions = new Set<string>();

    function generateToken(): string {
        return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
        const token = req.headers['x-auth-token'] as string || (req as any).cookies?.token;
        if (token && sessions.has(token)) {
            next();
        } else {
            res.status(401).json({ error: 'No autorizado' });
        }
    }

    // ── Login ────────────────────────────────────────────────────
    app.post('/api/login', (req: express.Request, res: express.Response) => {
        const { user, pass } = req.body;
        if (user === config.panelUser && pass === config.panelPass) {
            const token = generateToken();
            sessions.add(token);
            res.json({ token });
        } else {
            res.status(401).json({ error: 'Credenciales inválidas' });
        }
    });

    // ── Upload file ──────────────────────────────────────────────
    app.post('/api/upload', authMiddleware, upload.single('file'), (req: express.Request, res: express.Response) => {
        try {
            if (!req.file) {
                res.status(400).json({ error: 'No se envió ningún archivo' });
                return;
            }

            const name = req.body.name || req.file.originalname.split('.')[0];
            const groupJid = req.body.group_jid || 'global';

            const saved = saveSharedFile(
                name,
                req.file.originalname,
                req.file.mimetype,
                req.file.buffer,
                groupJid,
                'panel'
            );

            res.json({ success: true, file: saved });
        } catch (err: any) {
            res.status(500).json({ error: err.message || 'Error al subir archivo' });
        }
    });

    // ── List files ───────────────────────────────────────────────
    app.get('/api/files', authMiddleware, (_req: express.Request, res: express.Response) => {
        const files = listAllSharedFiles();
        res.json({ files });
    });

    // ── Delete file ──────────────────────────────────────────────
    app.delete('/api/files/:id', authMiddleware, (req: express.Request, res: express.Response) => {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) {
            res.status(400).json({ error: 'ID inválido' });
            return;
        }

        const deleted = deleteSharedFileById(id);
        if (deleted) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Archivo no encontrado' });
        }
    });

    // ── Bot Status ───────────────────────────────────────────────
    app.get('/api/status', authMiddleware, (_req: express.Request, res: express.Response) => {
        res.json({
            status: globalStatus,
            qr: globalQR
        });
    });

    // ── Health Check ─────────────────────────────────────────────
    app.get('/api/health', (_req: express.Request, res: express.Response) => {
        res.json({
            status: 'ok',
            uptime: Math.floor((Date.now() - config.startTime) / 1000),
            timestamp: Date.now()
        });
    });

    // ── Dashboard API ────────────────────────────────────────────
    app.get('/api/dashboard/stats', authMiddleware, (_req, res) => {
        res.json({
            status: globalStatus,
            qr: globalQR,
            uptime: Math.floor((Date.now() - config.startTime) / 1000),
            memory: Math.round(process.memoryUsage().rss / 1024 / 1024)
        });
    });

    app.get('/api/dashboard/groups', authMiddleware, async (_req, res) => {
        if (!globalSock) { res.json({ groups: [] }); return; }
        try {
            const groups = await globalSock.groupFetchAllParticipating();
            const groupList = Object.values(groups).map((g: any) => ({
                id: g.id,
                subject: g.subject,
                participants: g.participants?.length || 0
            }));
            res.json({ groups: groupList });
        } catch(e) { res.status(500).json({ error: 'Failed to fetch groups' }); }
    });

    app.get('/api/dashboard/warnings', authMiddleware, (_req, res) => {
        res.json({ warnings: require('../services/db.service').getAllWarnings() });
    });

    app.post('/api/dashboard/broadcast', authMiddleware, async (req, res) => {
        if (!globalSock) { res.status(400).json({ error: 'Bot not connected' }); return; }
        const { message } = req.body;
        if (!message) { res.status(400).json({ error: 'No message provided' }); return; }
        try {
            const groups = await globalSock.groupFetchAllParticipating();
            let count = 0;
            for (const jid in groups) {
                await globalSock.sendMessage(jid, { text: message });
                count++;
            }
            res.json({ success: true, count });
        } catch(e) { res.status(500).json({ error: 'Broadcast failed' }); }
    });

    app.post('/api/dashboard/clear-warnings', authMiddleware, (req, res) => {
        const { group_jid, user_jid } = req.body;
        if(group_jid && user_jid) {
            require('../services/db.service').resetWarnings(group_jid, user_jid);
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Missing JIDs' });
        }
    });

    
    app.post('/api/dashboard/disconnect', authMiddleware, async (req, res) => {
        if (globalSock) {
            try {
                await globalSock.logout();
            } catch(e) {}
        }
        try {
            const fs = require('fs');
            fs.rmSync(config.authDir, { recursive: true, force: true });
        } catch(e) {}
        res.json({ success: true });
        setTimeout(() => process.exit(1), 1000); // Let PM2 restart the bot
    });

    app.get('/api/dashboard/settings', authMiddleware, (req, res) => {
        const envPath = require('path').resolve(__dirname, '../../.env');
        try {
            const content = require('fs').readFileSync(envPath, 'utf8');
            res.json({ env: content });
        } catch(e) {
            res.status(500).json({ error: 'Could not read .env' });
        }
    });

    app.post('/api/dashboard/settings', authMiddleware, (req, res) => {
        const { envContent } = req.body;
        if (!envContent) { res.status(400).json({ error: 'No content' }); return; }
        const envPath = require('path').resolve(__dirname, '../../.env');
        try {
            require('fs').writeFileSync(envPath, envContent, 'utf8');
            res.json({ success: true });
            setTimeout(() => process.exit(1), 1000); // Restart to apply changes
        } catch(e) {
            res.status(500).json({ error: 'Could not save .env' });
        }
    });

    // ── Serve the dashboard HTML ─────────────────────────────────
    app.get('/', (_req: express.Request, res: express.Response) => {
        res.sendFile(path.resolve(__dirname, 'views', 'index.html'));
    });

    // ── Start server ─────────────────────────────────────────────
    app.listen(config.panelPort, '0.0.0.0', () => {
        console.log('');
        console.log(`🌐 Panel Admin activo en: http://0.0.0.0:${config.panelPort}`);
        console.log(`   Usuario: ${config.panelUser}`);
        console.log('');
    });
}
