import re

file = 'src/panel/views/index.html'
with open(file, 'r', encoding='utf-8') as f:
    html = f.read()

# Add disconnect button to Status tab
disconnect_btn = """
                <div style="margin-top: 20px;">
                    <button class="btn btn-danger" onclick="disconnectWhatsApp()" id="btn-disconnect">🔴 Desvincular Número (Generar nuevo QR)</button>
                </div>
"""
html = html.replace('</canvas>\n            </div>', f'</canvas>\n{disconnect_btn}            </div>')

# Add settings tab button
settings_btn = """<button onclick="switchTab('tab-settings')">⚙️ Configuración</button>\n                <button onclick="switchTab('tab-files')">"""
html = html.replace("<button onclick=\"switchTab('tab-files')\">", settings_btn)

# Add Settings Tab content
settings_tab = """
            <!-- Tab Settings -->
            <div id="tab-settings" class="tab-content">
                <div class="upload-card">
                    <h2>⚙️ Configuración (.env)</h2>
                    <p style="color:var(--text-secondary); margin-bottom: 16px;">Edita las credenciales, apis, y configuración principal. El bot se reiniciará automáticamente al guardar.</p>
                    <div class="form-group">
                        <textarea id="env-editor" rows="18" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:10px; color:#fff; padding:12px; font-family: monospace; white-space: pre;"></textarea>
                    </div>
                    <button class="btn btn-primary" onclick="saveSettings()" id="btn-save-settings">💾 Guardar y Reiniciar</button>
                </div>
            </div>

            <!-- Tab Files -->
"""
html = html.replace('<!-- Tab Files -->', settings_tab)

# Add JS functions
js_logic = """
        async function disconnectWhatsApp() {
            if(!confirm('¿Estás seguro que quieres desvincular el bot? Deberás escanear un nuevo código QR para reconectarlo.')) return;
            const btn = document.getElementById('btn-disconnect');
            btn.innerHTML = 'Desvinculando...'; btn.disabled = true;
            try {
                await fetch('/api/dashboard/disconnect', { method: 'POST', headers: { 'X-Auth-Token': authToken } });
                showToast('Desvinculado. El panel se actualizará pronto.', 'success');
            } catch(e) {}
            btn.innerHTML = '🔴 Desvincular Número'; btn.disabled = false;
        }

        async function loadSettings() {
            const res = await fetch('/api/dashboard/settings', { headers: { 'X-Auth-Token': authToken }});
            const data = await res.json();
            if(data.env) {
                document.getElementById('env-editor').value = data.env;
            }
        }

        async function saveSettings() {
            const content = document.getElementById('env-editor').value;
            if(!content) return;
            const btn = document.getElementById('btn-save-settings');
            btn.innerHTML = 'Guardando...'; btn.disabled = true;
            try {
                const res = await fetch('/api/dashboard/settings', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Auth-Token': authToken },
                    body: JSON.stringify({ envContent: content })
                });
                if(res.ok) {
                    showToast('Guardado con éxito. Reiniciando bot...', 'success');
                    setTimeout(() => window.location.reload(), 3000);
                } else showToast('Error al guardar', 'error');
            } catch(e) { showToast('Error', 'error'); }
            btn.innerHTML = '💾 Guardar y Reiniciar'; btn.disabled = false;
        }
"""

html = html.replace('if(tabId === \'tab-spam\') loadWarnings();', 'if(tabId === \'tab-spam\') loadWarnings();\n            if(tabId === \'tab-settings\') loadSettings();')
html = html.replace('// ── Bot Status Polling ───────────────────────────────────', js_logic + '\n        // ── Bot Status Polling ───────────────────────────────────')

with open(file, 'w', encoding='utf-8') as f:
    f.write(html)

print("HTML Settings Patched successfully!")
