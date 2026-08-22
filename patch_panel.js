const fs = require('fs');
const path = require('path');

const file = 'src/panel/panel.ts';
let code = fs.readFileSync(file, 'utf8');

const newEndpoints = `
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
        if (!envContent) return res.status(400).json({ error: 'No content' });
        const envPath = require('path').resolve(__dirname, '../../../.env');
        try {
            require('fs').writeFileSync(envPath, envContent, 'utf8');
            res.json({ success: true });
            setTimeout(() => process.exit(1), 1000); // Restart to apply changes
        } catch(e) {
            res.status(500).json({ error: 'Could not save .env' });
        }
    });
`;

code = code.replace('// ── Serve the dashboard HTML ─────────────────────────────────', newEndpoints + '\n    // ── Serve the dashboard HTML ─────────────────────────────────');

fs.writeFileSync(file, code);
console.log("Panel endpoints patched");
