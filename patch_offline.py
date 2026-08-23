import re

# 1. Add force offline logic to connection.ts
file_conn = 'src/connection.ts'
with open(file_conn, 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    'export let globalPaused = false;',
    'export let globalPaused = false;\nexport let globalForceOffline = false;\nexport function setForceOffline(v: boolean) { globalForceOffline = v; }'
)

code = code.replace(
    'setTimeout(startBot, 2000);',
    'if(!globalForceOffline) setTimeout(startBot, 2000);'
)
code = code.replace(
    'setTimeout(startBot, 3000);',
    'if(!globalForceOffline) setTimeout(startBot, 3000);'
)

with open(file_conn, 'w', encoding='utf-8') as f:
    f.write(code)

# 2. Add API endpoints
file_panel = 'src/panel/panel.ts'
with open(file_panel, 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    "globalPaused, setPaused",
    "globalPaused, setPaused, globalForceOffline, setForceOffline"
)

code = code.replace(
    "status: globalPaused ? 'paused' : globalStatus,",
    "status: globalForceOffline ? 'offline' : (globalPaused ? 'paused' : globalStatus),"
)

new_endpoints = """
    app.post('/api/dashboard/power/offline', authMiddleware, (_req, res) => {
        setForceOffline(true);
        if(globalSock) {
            try { globalSock.ws.close(); } catch(e) {}
        }
        res.json({ offline: true });
    });
    
    app.post('/api/dashboard/power/online', authMiddleware, (_req, res) => {
        setForceOffline(false);
        res.json({ success: true });
        setTimeout(() => process.exit(1), 1000); // PM2 will restart and connect automatically
    });
"""

code = code.replace(
    "app.post('/api/dashboard/power/restart'",
    new_endpoints + "\n    app.post('/api/dashboard/power/restart'"
)

with open(file_panel, 'w', encoding='utf-8') as f:
    f.write(code)

# 3. Add to UI
file_html = 'src/panel/views/index.html'
with open(file_html, 'r', encoding='utf-8') as f:
    html = f.read()

btns = """
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button class="btn btn-danger" style="padding: 10px 20px;" onclick="disconnectWhatsApp()" id="btn-disconnect">🔴 Desvincular</button>
                        <button class="btn" style="background: #e6a23c; color: white; padding: 10px 20px; border: none;" onclick="togglePauseBot()" id="btn-pause">⏸️ Pausar Bot</button>
                        <button class="btn" style="background: #4b5563; color: white; padding: 10px 20px; border: none;" onclick="toggleOfflineBot()" id="btn-offline">🔌 Apagar Offline</button>
                        <button class="btn" style="background: var(--primary); color: white; padding: 10px 20px; border: none;" onclick="restartBot()" id="btn-restart">🔄 Reiniciar</button>
                    </div>
"""

html = html.replace(
    '<button class="btn" style="background: var(--primary); color: white; padding: 10px 20px; border: none;" onclick="restartBot()" id="btn-restart">🔄 Reiniciar</button>\n                    </div>',
    '<button class="btn" style="background: #4b5563; color: white; padding: 10px 20px; border: none;" onclick="toggleOfflineBot()" id="btn-offline">🔌 Apagar Offline</button>\n                        <button class="btn" style="background: var(--primary); color: white; padding: 10px 20px; border: none;" onclick="restartBot()" id="btn-restart">🔄 Reiniciar</button>\n                    </div>'
)

html = html.replace(
    "} else if (data.status === 'paused') {",
    """} else if (data.status === 'offline') {
                    content.innerHTML = '<div style="color: #4b5563; font-size: 18px; font-weight: bold;">🔌 Bot Apagado (Desconectado de WA)</div>' + statsHtml;
                    canvas.style.display = 'none';
                    document.getElementById('btn-offline').innerHTML = '⚡ Encender Bot';
                    document.getElementById('btn-offline').style.background = '#10b981';
                } else if (data.status === 'paused') {"""
)

js = """
        async function toggleOfflineBot() {
            const isApagado = document.getElementById('btn-offline').innerText.includes('Encender');
            if(!isApagado) {
                if(!confirm('¿Apagar la conexión a WhatsApp? El bot aparecerá desconectado.')) return;
                try {
                    await fetch('/api/dashboard/power/offline', { method: 'POST', headers: { 'X-Auth-Token': authToken }});
                    showToast('Conexión cerrada', 'success');
                    pollStatus();
                } catch(e) {}
            } else {
                showToast('Encendiendo bot...', 'success');
                try {
                    await fetch('/api/dashboard/power/online', { method: 'POST', headers: { 'X-Auth-Token': authToken }});
                    setTimeout(() => window.location.reload(), 4000);
                } catch(e) {}
            }
        }
"""
html = html.replace(
    "async function restartBot() {",
    js + "\n        async function restartBot() {"
)

with open(file_html, 'w', encoding='utf-8') as f:
    f.write(html)
print("Offline logic patched!")
