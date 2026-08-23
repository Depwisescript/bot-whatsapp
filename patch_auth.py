import re
file_panel = 'src/panel/panel.ts'
with open(file_panel, 'r', encoding='utf-8') as f:
    code = f.read()

old_auth = """    function generateToken(): string {
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
    });"""

new_auth = """    function generateToken(): string {
        return Buffer.from(config.panelUser + ':' + config.panelPass).toString('base64');
    }

    function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
        const token = req.headers['x-auth-token'] as string || (req as any).cookies?.token;
        if (token && token === generateToken()) {
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
            res.json({ token });
        } else {
            res.status(401).json({ error: 'Credenciales inválidas' });
        }
    });"""

code = code.replace(old_auth, new_auth)
with open(file_panel, 'w', encoding='utf-8') as f:
    f.write(code)
print("Auth patched!")
