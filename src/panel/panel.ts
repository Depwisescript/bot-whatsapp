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
