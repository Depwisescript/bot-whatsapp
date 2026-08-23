import re

# 1. Update connection.ts
file_conn = 'src/connection.ts'
with open(file_conn, 'r', encoding='utf-8') as f:
    code_conn = f.read()

code_conn = code_conn.replace(
    'export let globalSock: any = null;',
    'export let globalSock: any = null;\nexport let globalPaused = false;\nexport function setPaused(v: boolean) { globalPaused = v; }'
)
with open(file_conn, 'w', encoding='utf-8') as f:
    f.write(code_conn)


# 2. Update message.handler.ts
file_msg = 'src/handlers/message.handler.ts'
with open(file_msg, 'r', encoding='utf-8') as f:
    code_msg = f.read()

code_msg = code_msg.replace(
    "import { config } from '../config';",
    "import { config } from '../config';\nimport { globalPaused } from '../connection';"
)
code_msg = code_msg.replace(
    "export async function handleMessages(sock: WASocket, messages: proto.IWebMessageInfo[]) {",
    "export async function handleMessages(sock: WASocket, messages: proto.IWebMessageInfo[]) {\n    if (globalPaused) return;"
)
with open(file_msg, 'w', encoding='utf-8') as f:
    f.write(code_msg)


# 3. Update panel.ts
file_panel = 'src/panel/panel.ts'
with open(file_panel, 'r', encoding='utf-8') as f:
    code_panel = f.read()

code_panel = code_panel.replace(
    "import { globalStatus, globalQR, globalSock } from '../connection';",
    "import { globalStatus, globalQR, globalSock, globalPaused, setPaused } from '../connection';"
)
code_panel = code_panel.replace(
    "status: globalStatus,",
    "status: globalPaused ? 'paused' : globalStatus,"
)
power_endpoints = """
    app.post('/api/dashboard/power/pause', authMiddleware, (_req, res) => {
        setPaused(!globalPaused);
        res.json({ paused: globalPaused });
    });
    
    app.post('/api/dashboard/power/restart', authMiddleware, (_req, res) => {
        res.json({ success: true });
        setTimeout(() => process.exit(1), 1000);
    });
"""
code_panel = code_panel.replace(
    "app.post('/api/dashboard/broadcast'",
    power_endpoints + "\n    app.post('/api/dashboard/broadcast'"
)
with open(file_panel, 'w', encoding='utf-8') as f:
    f.write(code_panel)


# 4. Update index.html
file_html = 'src/panel/views/index.html'
with open(file_html, 'r', encoding='utf-8') as f:
    html = f.read()

buttons = """
                    <div style="margin-top: 24px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button class="btn" style="background: var(--accent); color: white; padding: 10px 20px;" onclick="disconnectWhatsApp()">🔴 Desvincular Número</button>
                        <button class="btn" style="background: #e6a23c; color: white; padding: 10px 20px;" onclick="togglePauseBot()" id="btn-pause">⏸️ Pausar Bot</button>
                        <button class="btn" style="background: var(--primary); color: white; padding: 10px 20px;" onclick="restartBot()" id="btn-restart">🔄 Reiniciar</button>
                    </div>
"""
html = html.replace(
    '<button class="btn btn-danger" style="margin-top: 24px; width: 100%; max-width: 400px;" onclick="disconnectWhatsApp()">🔴 Desvincular Número (Generar nuevo QR)</button>',
    buttons
)

html = html.replace(
    "content.innerHTML = '<div style=\"color: var(--success); font-size: 18px; font-weight: bold;\">✅ Conectado y Operativo</div>' + statsHtml;",
    "content.innerHTML = '<div style=\"color: var(--success); font-size: 18px; font-weight: bold;\">✅ Conectado y Operativo</div>' + statsHtml;\n                    document.getElementById('btn-pause').innerHTML = '⏸️ Pausar Bot';"
)

html = html.replace(
    "} else if (data.status === 'qr' && data.qr) {",
    """} else if (data.status === 'paused') {
                    content.innerHTML = '<div style="color: #e6a23c; font-size: 18px; font-weight: bold;">⏸️ Bot Pausado (Ignorando mensajes)</div>' + statsHtml;
                    canvas.style.display = 'none';
                    document.getElementById('btn-pause').innerHTML = '▶️ Reanudar Bot';
                } else if (data.status === 'qr' && data.qr) {"""
)

js_power = """
        async function togglePauseBot() {
            try {
                const res = await fetch('/api/dashboard/power/pause', { method: 'POST', headers: { 'X-Auth-Token': authToken }});
                const data = await res.json();
                if(res.ok) {
                    showToast(data.paused ? 'Bot pausado' : 'Bot reanudado', 'success');
                    pollStatus();
                }
            } catch(e) {}
        }
        
        async function restartBot() {
            if(!confirm('¿Estás seguro de que deseas reiniciar todo el servicio? El panel también se desconectará por unos segundos.')) return;
            try {
                const res = await fetch('/api/dashboard/power/restart', { method: 'POST', headers: { 'X-Auth-Token': authToken }});
                if(res.ok) {
                    showToast('Reiniciando sistema...', 'success');
                    setTimeout(() => window.location.reload(), 4000);
                }
            } catch(e) {}
        }
"""

html = html.replace(
    '// ── Bot Status Polling ───────────────────────────────────',
    js_power + '\n        // ── Bot Status Polling ───────────────────────────────────'
)

with open(file_html, 'w', encoding='utf-8') as f:
    f.write(html)

print("Power buttons patched!")
