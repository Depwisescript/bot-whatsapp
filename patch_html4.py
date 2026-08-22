import re

file = 'src/panel/views/index.html'
with open(file, 'r', encoding='utf-8') as f:
    html = f.read()

# Replace Settings Tab UI
old_settings = """
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
"""

new_settings = """
            <!-- Tab Settings -->
            <div id="tab-settings" class="tab-content">
                <div class="upload-card">
                    <h2>⚙️ Configuración del Sistema</h2>
                    <p style="color:var(--text-secondary); margin-bottom: 24px;">Configura tu bot de forma fácil. Al guardar, el bot se reiniciará automáticamente.</p>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <!-- Panel Principal -->
                        <div style="background: var(--bg-card); padding: 16px; border-radius: 12px; border: 1px solid var(--border);">
                            <h3 style="margin-top:0; font-size: 16px; color: var(--accent);">📱 General</h3>
                            <div class="form-group">
                                <label>Prefijo del Bot (Ej: ! o .)</label>
                                <input type="text" id="cfg-prefix" maxlength="1">
                            </div>
                            <div class="form-group">
                                <label>Número del Propietario (Owner)</label>
                                <input type="text" id="cfg-owner" placeholder="51999888777">
                            </div>
                            <div class="form-group">
                                <label>Máximo de Advertencias (Spam)</label>
                                <input type="number" id="cfg-warnings" min="1" max="10">
                            </div>
                            <div class="form-group">
                                <label>Mensaje de Auto-respuesta (Privado)</label>
                                <textarea id="cfg-autoreply" rows="4" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; color:#fff; padding:8px;"></textarea>
                            </div>
                        </div>

                        <!-- Panel APIs -->
                        <div style="background: var(--bg-card); padding: 16px; border-radius: 12px; border: 1px solid var(--border);">
                            <h3 style="margin-top:0; font-size: 16px; color: var(--accent);">🤖 Inteligencia Artificial</h3>
                            <div class="form-group">
                                <label>Gemini API Key (Google)</label>
                                <input type="password" id="cfg-gemini" placeholder="AIzaSy...">
                            </div>
                            <div class="form-group">
                                <label>OpenAI API Key (Opcional / Groq)</label>
                                <input type="password" id="cfg-openai" placeholder="sk-...">
                            </div>
                            <div class="form-group">
                                <label>OpenAI Base URL (Para Groq, etc)</label>
                                <input type="text" id="cfg-openaibase" placeholder="https://api.openai.com/v1">
                            </div>
                        </div>

                        <!-- Panel Web -->
                        <div style="background: var(--bg-card); padding: 16px; border-radius: 12px; border: 1px solid var(--border); grid-column: 1 / -1;">
                            <h3 style="margin-top:0; font-size: 16px; color: var(--accent);">🔒 Credenciales de este Panel</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div class="form-group">
                                    <label>Usuario del Panel</label>
                                    <input type="text" id="cfg-paneluser">
                                </div>
                                <div class="form-group">
                                    <label>Contraseña del Panel</label>
                                    <input type="password" id="cfg-panelpass">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top: 24px; text-align: center;">
                        <button class="btn btn-primary" style="padding: 14px 40px; font-size: 16px;" onclick="saveSettings()" id="btn-save-settings">💾 Guardar Configuración y Reiniciar</button>
                    </div>
                </div>
            </div>
"""

html = html.replace(old_settings.strip(), new_settings.strip())

# Replace JS logic for settings
old_js = """
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

new_js = """
        async function loadSettings() {
            const res = await fetch('/api/dashboard/settings', { headers: { 'X-Auth-Token': authToken }});
            const data = await res.json();
            if(data.env) {
                const lines = data.env.split('\\n');
                const env = {};
                lines.forEach(l => {
                    const idx = l.indexOf('=');
                    if (idx > -1 && !l.trim().startsWith('#')) {
                        const key = l.substring(0, idx).trim();
                        let val = l.substring(idx+1).trim();
                        if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
                        else if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
                        env[key] = val;
                    }
                });
                
                document.getElementById('cfg-prefix').value = env.BOT_PREFIX || '!';
                document.getElementById('cfg-owner').value = env.OWNER_NUMBER || '';
                document.getElementById('cfg-warnings').value = env.MAX_WARNINGS || '4';
                document.getElementById('cfg-autoreply').value = (env.AUTO_REPLY_MSG || '').replace(/\\\\n/g, '\\n');
                document.getElementById('cfg-gemini').value = env.GEMINI_API_KEY || '';
                document.getElementById('cfg-openai').value = env.OPENAI_API_KEY || '';
                document.getElementById('cfg-openaibase').value = env.OPENAI_BASE_URL || '';
                document.getElementById('cfg-paneluser').value = env.PANEL_USER || 'admin';
                document.getElementById('cfg-panelpass').value = env.PANEL_PASS || '';
            }
        }

        async function saveSettings() {
            const btn = document.getElementById('btn-save-settings');
            
            const prefix = document.getElementById('cfg-prefix').value || '!';
            const owner = document.getElementById('cfg-owner').value || '';
            const warnings = document.getElementById('cfg-warnings').value || '4';
            const autoreply = document.getElementById('cfg-autoreply').value.replace(/\\n/g, '\\\\n');
            const gemini = document.getElementById('cfg-gemini').value || '';
            const openai = document.getElementById('cfg-openai').value || '';
            const baseurl = document.getElementById('cfg-openaibase').value || '';
            const pUser = document.getElementById('cfg-paneluser').value || 'admin';
            const pPass = document.getElementById('cfg-panelpass').value || '';

            let envContent = `# WhatsApp Group Bot Configuration\\n\\n`;
            envContent += `BOT_PREFIX=${prefix}\\n`;
            envContent += `MAX_WARNINGS=${warnings}\\n`;
            envContent += `AUTO_REPLY_MSG="${autoreply}"\\n\\n`;
            envContent += `GEMINI_API_KEY='${gemini}'\\n`;
            envContent += `OPENAI_API_KEY=${openai}\\n`;
            if (baseurl) envContent += `OPENAI_BASE_URL=${baseurl}\\n`;
            envContent += `OPENAI_MODEL=openai/gpt-oss-120b\\n`;
            envContent += `OWNER_NUMBER=${owner}\\n\\n`;
            envContent += `NODE_ENV=development\\n`;
            envContent += `PANEL_PORT=3001\\n`;
            envContent += `PANEL_USER=${pUser}\\n`;
            envContent += `PANEL_PASS=${pPass}\\n`;

            btn.innerHTML = 'Guardando...'; btn.disabled = true;
            try {
                const res = await fetch('/api/dashboard/settings', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Auth-Token': authToken },
                    body: JSON.stringify({ envContent })
                });
                if(res.ok) {
                    showToast('Guardado con éxito. Reiniciando bot...', 'success');
                    setTimeout(() => window.location.reload(), 3000);
                } else showToast('Error al guardar', 'error');
            } catch(e) { showToast('Error', 'error'); }
            btn.innerHTML = '💾 Guardar Configuración y Reiniciar'; btn.disabled = false;
        }
"""

html = html.replace(old_js.strip(), new_js.strip())

with open(file, 'w', encoding='utf-8') as f:
    f.write(html)

print("HTML Modern Settings Patched successfully!")
