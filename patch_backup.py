import re

# 1. Update panel.ts
file_ts = 'src/panel/panel.ts'
with open(file_ts, 'r', encoding='utf-8') as f:
    code_ts = f.read()

endpoint_code = """
    app.get('/api/dashboard/backup', authMiddleware, (_req, res) => {
        try {
            const { execSync } = require('child_process');
            const path = require('path');
            const fs = require('fs');
            
            const rootDir = path.resolve(__dirname, '../../../');
            const backupFile = path.resolve('/tmp', `backup-${Date.now()}.tar.gz`);
            
            // Execute tar directly
            execSync(`cd "${rootDir}" && tar -czf "${backupFile}" .env data/bot.db auth_info 2>/dev/null`);
            
            res.download(backupFile, 'bot-backup.tar.gz', () => {
                try { fs.unlinkSync(backupFile); } catch(e) {}
            });
        } catch (error) {
            console.error('Backup error:', error);
            res.status(500).json({ error: 'Error generating backup' });
        }
    });

    // --- End Dashboard API ---
"""
code_ts = code_ts.replace("    app.post('/api/dashboard/settings'", endpoint_code + "\n    app.post('/api/dashboard/settings'")

with open(file_ts, 'w', encoding='utf-8') as f:
    f.write(code_ts)


# 2. Update index.html
file_html = 'src/panel/views/index.html'
with open(file_html, 'r', encoding='utf-8') as f:
    html = f.read()

button_html = """
                    <div style="margin-top: 24px; text-align: center; display: flex; justify-content: center; gap: 15px;">
                        <button class="btn btn-primary" style="padding: 14px 40px; font-size: 16px;" onclick="saveSettings()" id="btn-save-settings">💾 Guardar Configuración y Reiniciar</button>
                        <button class="btn btn-danger" style="padding: 14px 20px; font-size: 16px; background-color: var(--accent); border: none;" onclick="downloadBackup()" id="btn-backup">📦 Descargar Backup (Migración)</button>
                    </div>
"""
html = html.replace(
"""
                    <div style="margin-top: 24px; text-align: center;">
                        <button class="btn btn-primary" style="padding: 14px 40px; font-size: 16px;" onclick="saveSettings()" id="btn-save-settings">💾 Guardar Configuración y Reiniciar</button>
                    </div>
""", button_html)


js_backup_fn = """
        async function downloadBackup() {
            const btn = document.getElementById('btn-backup');
            btn.innerHTML = 'Generando...'; btn.disabled = true;
            try {
                const res = await fetch('/api/dashboard/backup', { headers: { 'X-Auth-Token': authToken }});
                if(!res.ok) throw new Error();
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `wa-bot-backup.tar.gz`;
                a.click();
                window.URL.revokeObjectURL(url);
                showToast('Backup descargado correctamente', 'success');
            } catch(e) {
                showToast('Error al generar el backup', 'error');
            }
            btn.innerHTML = '📦 Descargar Backup (Migración)'; btn.disabled = false;
        }
"""
html = html.replace('// ── Bot Status Polling ───────────────────────────────────', js_backup_fn + '\n        // ── Bot Status Polling ───────────────────────────────────')

with open(file_html, 'w', encoding='utf-8') as f:
    f.write(html)

print("Backup endpoint patched!")
