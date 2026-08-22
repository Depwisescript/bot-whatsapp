import re

file = 'src/panel/views/index.html'
with open(file, 'r', encoding='utf-8') as f:
    html = f.read()

# Insert Tabs CSS
css = """
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .tabs-nav { display: flex; gap: 10px; margin-bottom: 24px; overflow-x: auto; padding-bottom: 10px; }
        .tabs-nav button { background: var(--bg-card); color: var(--text-secondary); border: 1px solid var(--border); padding: 10px 20px; border-radius: 8px; cursor: pointer; white-space: nowrap; }
        .tabs-nav button.active { background: var(--accent-gradient); color: #fff; border: none; }
"""
html = html.replace('</style>', css + '\n    </style>')

# Find container to inject tabs
container_idx = html.find('<div class="container">') + len('<div class="container">\n')

tabs_nav = """
            <div class="tabs-nav">
                <button class="active" onclick="switchTab('tab-status')">🤖 Estado</button>
                <button onclick="switchTab('tab-broadcast')">📢 Difusión</button>
                <button onclick="switchTab('tab-spam')">🚨 Infracciones</button>
                <button onclick="switchTab('tab-files')">📁 Archivos</button>
            </div>
"""

html = html[:container_idx] + tabs_nav + html[container_idx:]

# Wrap Status card
html = html.replace('<div class="upload-card" id="bot-status-card" style="text-align: center;">', '<div id="tab-status" class="tab-content active">\n<div class="upload-card" id="bot-status-card" style="text-align: center;">')

upload_idx = html.find('<!-- Upload Card -->')

new_tabs = """
            </div> <!-- End tab-status -->

            <!-- Tab Broadcast -->
            <div id="tab-broadcast" class="tab-content">
                <div class="upload-card">
                    <h2>📢 Enviar Mensaje a Todos los Grupos</h2>
                    <div class="form-group">
                        <label>Mensaje (Soporta negritas con *texto*)</label>
                        <textarea id="broadcast-msg" rows="4" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:10px; color:#fff; padding:12px; font-family:inherit;"></textarea>
                    </div>
                    <button class="btn btn-primary" onclick="sendBroadcast()" id="btn-broadcast">🚀 Enviar Broadcast</button>
                </div>
            </div>

            <!-- Tab Spam -->
            <div id="tab-spam" class="tab-content">
                <div class="files-card">
                    <h2>🚨 Usuarios con Advertencias</h2>
                    <div id="spam-container">
                        <div class="empty-state"><div class="spinner"></div></div>
                    </div>
                </div>
            </div>

            <!-- Tab Files -->
            <div id="tab-files" class="tab-content">
"""

html = html[:upload_idx] + new_tabs + html[upload_idx:]

container_end = html.find('</div>\n    </div>\n\n    <div class="toast"')
html = html[:container_end] + '            </div> <!-- End tab-files -->\n' + html[container_end:]

js_logic = """
        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tabs-nav button').forEach(el => el.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            event.currentTarget.classList.add('active');
            
            if(tabId === 'tab-spam') loadWarnings();
        }

        async function sendBroadcast() {
            const msg = document.getElementById('broadcast-msg').value;
            if(!msg) return showToast('Escribe un mensaje', 'error');
            const btn = document.getElementById('btn-broadcast');
            btn.innerHTML = 'Enviando...'; btn.disabled = true;
            try {
                const res = await fetch('/api/dashboard/broadcast', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Auth-Token': authToken },
                    body: JSON.stringify({ message: msg })
                });
                const data = await res.json();
                if(res.ok) {
                    showToast('Mensaje enviado a ' + data.count + ' grupos', 'success');
                    document.getElementById('broadcast-msg').value = '';
                } else showToast(data.error || 'Error', 'error');
            } catch(e) { showToast('Error', 'error'); }
            btn.innerHTML = '🚀 Enviar Broadcast'; btn.disabled = false;
        }

        async function loadWarnings() {
            const res = await fetch('/api/dashboard/warnings', { headers: { 'X-Auth-Token': authToken }});
            const data = await res.json();
            const container = document.getElementById('spam-container');
            if(!data.warnings || data.warnings.length === 0) {
                container.innerHTML = '<div class="empty-state">✅ No hay infracciones recientes.</div>';
                return;
            }
            let h = '<table class="files-table"><thead><tr><th>Grupo</th><th>Usuario</th><th>Advertencias</th><th>Acción</th></tr></thead><tbody>';
            data.warnings.forEach(w => {
                const userNum = w.user_jid.split('@')[0];
                h += `<tr>
                    <td style="font-size:12px; color:gray;">${w.group_jid.split('@')[0]}</td>
                    <td class="file-name-cell">+${userNum}</td>
                    <td>${w.count}</td>
                    <td><button class="btn btn-danger" onclick="clearWarning('${w.group_jid}', '${w.user_jid}')">Perdonar</button></td>
                </tr>`;
            });
            h += '</tbody></table>';
            container.innerHTML = h;
        }

        async function clearWarning(groupJid, userJid) {
            await fetch('/api/dashboard/clear-warnings', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Auth-Token': authToken },
                body: JSON.stringify({ group_jid: groupJid, user_jid: userJid })
            });
            showToast('Advertencias borradas', 'success');
            loadWarnings();
        }
"""

html = html.replace('// ── Bot Status Polling ───────────────────────────────────', js_logic + '\n        // ── Bot Status Polling ───────────────────────────────────')

poll_update = """
                const data = await res.json();
                const content = document.getElementById('bot-status-content');
                const canvas = document.getElementById('qr-canvas');

                let statsHtml = '';
                if(data.uptime) {
                    const h = Math.floor(data.uptime / 3600);
                    const m = Math.floor((data.uptime % 3600) / 60);
                    statsHtml = `<div style="margin-top:16px; font-size:13px; color:var(--text-secondary);">⏱️ Uptime: ${h}h ${m}m &nbsp; | &nbsp; 🧠 RAM: ${data.memory} MB</div>`;
                }

                if (data.status === 'connected') {
                    content.innerHTML = '<div style="color: var(--success); font-size: 18px; font-weight: bold;">✅ Conectado y Operativo</div>' + statsHtml;
                    canvas.style.display = 'none';
"""

html = re.sub(r"const data = await res\.json\(\);.*?canvas\.style\.display = 'none';", poll_update, html, flags=re.DOTALL)
html = html.replace("fetch('/api/status'", "fetch('/api/dashboard/stats'")

with open(file, 'w', encoding='utf-8') as f:
    f.write(html)

print("HTML Patched successfully!")
