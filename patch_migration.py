import re

file_ts = 'src/panel/panel.ts'
with open(file_ts, 'r', encoding='utf-8') as f:
    code_ts = f.read()

restore_endpoint = """
    app.post('/api/dashboard/restore', authMiddleware, upload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No se recibió el archivo' });
        
        try {
            const { execSync } = require('child_process');
            const path = require('path');
            const fs = require('fs');
            
            const tempFile = path.resolve('/tmp', `restore-${Date.now()}.tar.gz`);
            fs.writeFileSync(tempFile, req.file.buffer);
            
            const rootDir = path.resolve(__dirname, '../../../');
            execSync(`tar -xzf "${tempFile}" -C "${rootDir}"`);
            
            try { fs.unlinkSync(tempFile); } catch(e) {}
            
            res.json({ success: true });
            
            setTimeout(() => {
                process.exit(1);
            }, 2000);
        } catch (error) {
            console.error('Restore error:', error);
            res.status(500).json({ error: 'Error al restaurar el backup' });
        }
    });
"""

code_ts = code_ts.replace("    // --- End Dashboard API ---", restore_endpoint + "\n    // --- End Dashboard API ---")
with open(file_ts, 'w', encoding='utf-8') as f:
    f.write(code_ts)


file_html = 'src/panel/views/index.html'
with open(file_html, 'r', encoding='utf-8') as f:
    html = f.read()

# Remove the old backup button from Settings tab
old_button_html = """
                        <button class="btn btn-danger" style="padding: 14px 20px; font-size: 16px; background-color: var(--accent); border: none;" onclick="downloadBackup()" id="btn-backup">📦 Descargar Backup (Migración)</button>
"""
html = html.replace(old_button_html, "")

# Remove gap from the div if it's there
html = html.replace('gap: 15px;', '')


# Add the new Migration tab button
html = html.replace(
    '<button class="tab-btn" onclick="openTab(\'tab-files\', this)">📁 Archivos</button>',
    '<button class="tab-btn" onclick="openTab(\'tab-files\', this)">📁 Archivos</button>\n                <button class="tab-btn" onclick="openTab(\'tab-migration\', this)" style="background:var(--accent);">📦 Backup / Migración</button>'
)

# Add the Migration tab content
migration_tab = """
            <!-- Tab Migration -->
            <div id="tab-migration" class="tab-content">
                <div class="upload-card">
                    <h2>📦 Sistema de Respaldo y Migración</h2>
                    <p style="color:var(--text-secondary); margin-bottom: 24px;">Exporta tu bot actual para moverlo a otra VPS, o sube un backup anterior para restaurarlo. Se guardarán credenciales, configuraciones, usuarios y tu sesión de WhatsApp activa.</p>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        
                        <!-- Panel Exportar -->
                        <div style="background: var(--bg-card); padding: 24px; border-radius: 12px; border: 1px solid var(--border); text-align: center;">
                            <h3 style="margin-top:0; font-size: 18px; color: var(--success);">1. Exportar Datos</h3>
                            <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 20px;">Descarga un archivo .tar.gz con toda tu información actual.</p>
                            <button class="btn btn-primary" style="padding: 14px 30px; font-size: 15px; width: 100%; background: var(--success);" onclick="downloadBackup()" id="btn-backup-2">Descargar Backup Seguro</button>
                        </div>

                        <!-- Panel Importar -->
                        <div style="background: var(--bg-card); padding: 24px; border-radius: 12px; border: 1px solid var(--border); text-align: center;">
                            <h3 style="margin-top:0; font-size: 18px; color: var(--accent);">2. Restaurar Datos</h3>
                            <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 20px;">Sube un archivo wa-bot-backup.tar.gz para sobreescribir este bot.</p>
                            <input type="file" id="restore-file" accept=".gz,.tar" style="display: none;" onchange="handleRestoreSelect()">
                            <button class="btn btn-danger" style="padding: 14px 30px; font-size: 15px; width: 100%; background: var(--accent); border: none;" onclick="document.getElementById('restore-file').click()" id="btn-restore-select">Subir Backup y Restaurar</button>
                            <div id="restore-status" style="margin-top: 10px; font-size: 13px; color: var(--text-secondary);"></div>
                        </div>

                    </div>
                </div>
            </div>
"""

html = html.replace('<!-- Tab Settings -->', migration_tab + '\n            <!-- Tab Settings -->')

# Update backup JS and add restore JS
js_migration = """
        async function downloadBackup() {
            const btn = document.getElementById('btn-backup-2');
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
            btn.innerHTML = 'Descargar Backup Seguro'; btn.disabled = false;
        }

        async function handleRestoreSelect() {
            const file = document.getElementById('restore-file').files[0];
            if(!file) return;
            
            const btn = document.getElementById('btn-restore-select');
            const status = document.getElementById('restore-status');
            
            if(!confirm('⚠️ ADVERTENCIA: Restaurar un backup sobreescribirá TODA tu configuración actual, base de datos y sesión de WhatsApp. El bot se reiniciará. ¿Estás seguro de continuar?')) {
                document.getElementById('restore-file').value = '';
                return;
            }

            btn.disabled = true;
            status.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;"></span> Subiendo y Restaurando...';

            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch('/api/dashboard/restore', {
                    method: 'POST',
                    headers: { 'X-Auth-Token': authToken },
                    body: formData
                });
                if(res.ok) {
                    status.innerHTML = '<span style="color:var(--success);">✅ Backup restaurado con éxito. Reiniciando panel...</span>';
                    setTimeout(() => {
                        window.location.reload();
                    }, 4000);
                } else {
                    const data = await res.json();
                    status.innerHTML = `<span style="color:var(--accent);">❌ Error: ${data.error || 'Fallo al restaurar'}</span>`;
                    btn.disabled = false;
                }
            } catch(e) {
                status.innerHTML = '<span style="color:var(--accent);">❌ Error de conexión</span>';
                btn.disabled = false;
            }
            
            document.getElementById('restore-file').value = '';
        }
"""

html = html.replace('async function downloadBackup() {', 'async function old_downloadBackup() {')
html = html.replace('// ── Bot Status Polling ───────────────────────────────────', js_migration + '\n        // ── Bot Status Polling ───────────────────────────────────')

with open(file_html, 'w', encoding='utf-8') as f:
    f.write(html)

print("Migration patch applied!")
