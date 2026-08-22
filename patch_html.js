const fs = require('fs');
const file = 'src/panel/views/index.html';
let html = fs.readFileSync(file, 'utf8');

// Insert Tabs CSS
const css = `
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .tabs-nav { display: flex; gap: 10px; margin-bottom: 24px; overflow-x: auto; padding-bottom: 10px; }
        .tabs-nav button { background: var(--bg-card); color: var(--text-secondary); border: 1px solid var(--border); padding: 10px 20px; border-radius: 8px; cursor: pointer; white-space: nowrap; }
        .tabs-nav button.active { background: var(--accent-gradient); color: #fff; border: none; }
`;
html = html.replace('</style>', css + '\n    </style>');

// Find container to inject tabs
const containerStart = html.indexOf('<div class="container">');
const afterContainer = containerStart + '<div class="container">\n'.length;

const tabsNav = `
            <div class="tabs-nav">
                <button class="active" onclick="switchTab('tab-status')">🤖 Estado</button>
                <button onclick="switchTab('tab-broadcast')">📢 Broadcast</button>
                <button onclick="switchTab('tab-spam')">🚨 Infracciones</button>
                <button onclick="switchTab('tab-files')">📁 Archivos</button>
            </div>
`;

let parts = [
    html.slice(0, afterContainer),
    tabsNav,
    html.slice(afterContainer)
];
html = parts.join('');

// Wrap Status card in tab-status
html = html.replace('<div class="upload-card" id="bot-status-card" style="text-align: center;">', '<div id="tab-status" class="tab-content active">\n<div class="upload-card" id="bot-status-card" style="text-align: center;">');

// Add Broadcast and Spam tabs before the Upload card
const uploadIndex = html.indexOf('<!-- Upload Card -->');

const newTabs = `
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
`;

html = html.slice(0, uploadIndex) + newTabs + html.slice(uploadIndex);

// Close the tab-files div before the end of container
const containerEnd = html.indexOf('</div>\n    </div>\n\n    <div class="toast"');
html = html.slice(0, containerEnd) + '            </div> <!-- End tab-files -->\n' + html.slice(containerEnd);

// Add JS logic
const jsLogic = `
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
            let html = '<table class="files-table"><thead><tr><th>Grupo</th><th>Usuario</th><th>Advertencias</th><th>Fecha Última</th><th>Acción</th></tr></thead><tbody>';
            data.warnings.forEach(w => {
                const userNum = w.user_jid.split('@')[0];
                const date = new Date(w.last_warning).toLocaleString();
                html += \`<tr>
                    <td style="font-size:12px; color:gray;">\${w.group_jid.split('@')[0]}</td>
                    <td class="file-name-cell">+\${userNum}</td>
                    <td>\${w.count}</td>
                    <td>\${date}</td>
                    <td><button class="btn btn-danger" onclick="clearWarning('\${w.group_jid}', '\${w.user_jid}')">Perdonar</button></td>
                </tr>\`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        }

        async function clearWarning(groupJid, userJid) {
            await fetch('/api/dashboard/clear-warnings', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Auth-Token': authToken },
                body: JSON.stringify({ group_jid: groupJid, user_jid: userJid })
            });
            showToast('Advertencias borradas', 'success');
            loadWarnings();
        }
`;

html = html.replace('// ── Bot Status Polling ───────────────────────────────────', jsLogic + '\n        // ── Bot Status Polling ───────────────────────────────────');

// Also update pollStatus to fetch RAM and Uptime
const pollUpdate = `
                const data = await res.json();
                const content = document.getElementById('bot-status-content');
                const canvas = document.getElementById('qr-canvas');

                let statsHtml = '';
                if(data.uptime) {
                    const h = Math.floor(data.uptime / 3600);
                    const m = Math.floor((data.uptime % 3600) / 60);
                    statsHtml = \`<div style="margin-top:16px; font-size:13px; color:var(--text-secondary);">
                        ⏱️ Uptime: \${h}h \${m}m &nbsp; | &nbsp; 🧠 RAM: \${data.memory} MB
                    </div>\`;
                }

                if (data.status === 'connected') {
                    content.innerHTML = '<div style="color: var(--success); font-size: 18px; font-weight: bold;">✅ Conectado y Operativo</div>' + statsHtml;
                    canvas.style.display = 'none';
`;
html = html.replace(/const data = await res\.json\(\);[\s\S]*?canvas\.style\.display = 'none';/, pollUpdate);

// Change API poll URL from /api/status to /api/dashboard/stats
html = html.replace("fetch('/api/status'", "fetch('/api/dashboard/stats'");

fs.writeFileSync(file, html);
console.log("HTML Patched successfully!");
