import re

file_panel = 'src/panel/panel.ts'
with open(file_panel, 'r', encoding='utf-8') as f:
    code = f.read()

new_endpoint = """
    app.get('/api/dashboard/bandwidth', authMiddleware, (_req, res) => {
        try {
            const { execSync } = require('child_process');
            const output = execSync('vnstat --json').toString();
            res.json(JSON.parse(output));
        } catch (error) {
            res.json({ error: 'No vnstat data' });
        }
    });
"""

code = code.replace(
    "app.get('/api/dashboard/warnings'",
    new_endpoint + "\n    app.get('/api/dashboard/warnings'"
)

with open(file_panel, 'w', encoding='utf-8') as f:
    f.write(code)

file_html = 'src/panel/views/index.html'
with open(file_html, 'r', encoding='utf-8') as f:
    html = f.read()

# Add a small bandwidth section inside the Status tab
status_ui = """
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button class="btn btn-danger" style="padding: 10px 20px;" onclick="disconnectWhatsApp()" id="btn-disconnect">🔴 Desvincular</button>
                        <button class="btn" style="background: #e6a23c; color: white; padding: 10px 20px; border: none;" onclick="togglePauseBot()" id="btn-pause">⏸️ Pausar Bot</button>
                        <button class="btn" style="background: #4b5563; color: white; padding: 10px 20px; border: none;" onclick="toggleOfflineBot()" id="btn-offline">🔌 Apagar Offline</button>
                        <button class="btn" style="background: var(--primary); color: white; padding: 10px 20px; border: none;" onclick="restartBot()" id="btn-restart">🔄 Reiniciar</button>
                    </div>
"""

new_status_ui = status_ui + """
                    <div style="margin-top: 25px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 12px;">
                        <h4 style="margin-top:0; margin-bottom: 10px; font-size: 14px; color: #a0aabf;">📊 Tráfico de Red AWS (Mensual)</h4>
                        <div id="bandwidth-stats" style="display: flex; justify-content: space-around; font-size: 13px; font-weight: bold;">
                            <div style="color: #10b981;">▼ Entrada: <span id="bw-rx">Calculando...</span></div>
                            <div style="color: #ef4444;">▲ Salida: <span id="bw-tx">Calculando...</span></div>
                            <div style="color: var(--primary);">Σ Total: <span id="bw-total">Calculando...</span></div>
                        </div>
                    </div>
"""

html = html.replace(status_ui, new_status_ui)

js_poll = """
        function pollStatus() {
            fetch('/api/dashboard/stats', { headers: { 'X-Auth-Token': authToken }})
                .then(r => r.json())
                .then(data => {
"""

new_js_poll = """
        function pollStatus() {
            fetch('/api/dashboard/bandwidth', { headers: { 'X-Auth-Token': authToken }})
                .then(r => r.json())
                .then(data => {
                    if(!data.error && data.interfaces && data.interfaces.length > 0) {
                        const iface = data.interfaces[0];
                        
                        // Try to find current month data
                        const now = new Date();
                        const currentMonth = now.getMonth() + 1;
                        const currentYear = now.getFullYear();
                        
                        let monthData = null;
                        if(iface.traffic && iface.traffic.month) {
                            monthData = iface.traffic.month.find(m => m.date.year === currentYear && m.date.month === currentMonth);
                        }
                        
                        // Fallback to total if no month data yet
                        const rxBytes = monthData ? monthData.rx : iface.traffic.total.rx;
                        const txBytes = monthData ? monthData.tx : iface.traffic.total.tx;
                        
                        const formatBytes = (bytes) => {
                            if(bytes === 0) return '0 B';
                            const k = 1024;
                            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                            const i = Math.floor(Math.log(bytes) / Math.log(k));
                            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                        };
                        
                        document.getElementById('bw-rx').innerText = formatBytes(rxBytes);
                        document.getElementById('bw-tx').innerText = formatBytes(txBytes);
                        document.getElementById('bw-total').innerText = formatBytes(rxBytes + txBytes);
                    }
                }).catch(() => {});

            fetch('/api/dashboard/stats', { headers: { 'X-Auth-Token': authToken }})
                .then(r => r.json())
                .then(data => {
"""

html = html.replace(js_poll, new_js_poll)

with open(file_html, 'w', encoding='utf-8') as f:
    f.write(html)
print("Bandwidth patched!")
