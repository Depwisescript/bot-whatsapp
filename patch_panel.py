import re

file = 'src/panel/panel.ts'
with open(file, 'r', encoding='utf-8') as f:
    code = f.read()

new_endpoints = """
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
        const envPath = require('path').resolve(__dirname, '../../../.env');
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
        const envPath = require('path').resolve(__dirname, '../../../.env');
        try {
            require('fs').writeFileSync(envPath, envContent, 'utf8');
            res.json({ success: true });
            setTimeout(() => process.exit(1), 1000); // Restart to apply changes
        } catch(e) {
            res.status(500).json({ error: 'Could not save .env' });
        }
    });
"""

code = code.replace('// ── Serve the dashboard HTML ─────────────────────────────────', new_endpoints + '\n    // ── Serve the dashboard HTML ─────────────────────────────────')

with open(file, 'w', encoding='utf-8') as f:
    f.write(code)

print("Panel endpoints patched")
