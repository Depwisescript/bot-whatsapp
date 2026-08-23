import re

file_html = 'src/panel/views/index.html'
with open(file_html, 'r', encoding='utf-8') as f:
    html = f.read()

# Add CSS for the toggle switch
css_toggle = """
        /* Toggle Switch CSS */
        .switch { position: relative; display: inline-block; width: 40px; height: 20px; vertical-align: middle; margin-left: 10px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--border); transition: .4s; border-radius: 20px; }
        .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background: var(--success); }
        input:checked + .slider:before { transform: translateX(20px); }
"""
html = html.replace('</style>', css_toggle + '\n    </style>')


# Replace the old Proxy input HTML with the new toggle + input
old_proxy = """
                            <div class="form-group">
                                <label>Proxy SOCKS5 YouTube (Déjalo vacío para apagar)</label>
                                <input type="text" id="cfg-proxy" placeholder="socks5://38.250.116.74:1080">
                            </div>
"""

new_proxy = """
                            <div class="form-group">
                                <label style="display: flex; align-items: center; justify-content: space-between;">
                                    <span>Proxy SOCKS5 YouTube (Bypass)</span>
                                    <label class="switch">
                                        <input type="checkbox" id="cfg-proxy-toggle" onchange="toggleProxyInput()">
                                        <span class="slider"></span>
                                    </label>
                                </label>
                                <input type="text" id="cfg-proxy" placeholder="socks5://38.250.116.74:1080" style="display: none; margin-top: 8px;">
                            </div>
"""
html = html.replace(old_proxy.strip(), new_proxy.strip())


# Add the javascript function for the toggle animation
js_toggle_fn = """
        function toggleProxyInput() {
            const isChecked = document.getElementById('cfg-proxy-toggle').checked;
            const input = document.getElementById('cfg-proxy');
            if(isChecked) {
                input.style.display = 'block';
                if(!input.value) input.value = 'socks5://38.250.116.74:1080';
            } else {
                input.style.display = 'none';
            }
        }
"""
html = html.replace('// ── Bot Status Polling ───────────────────────────────────', js_toggle_fn + '\n        // ── Bot Status Polling ───────────────────────────────────')


# Update loadSettings to check the toggle
old_load = "document.getElementById('cfg-proxy').value = env.YOUTUBE_PROXY !== undefined ? env.YOUTUBE_PROXY : 'socks5://38.250.116.74:1080';"
new_load = """
                const pxy = env.YOUTUBE_PROXY !== undefined ? env.YOUTUBE_PROXY : 'socks5://38.250.116.74:1080';
                if(pxy && pxy.trim() !== '') {
                    document.getElementById('cfg-proxy-toggle').checked = true;
                    document.getElementById('cfg-proxy').value = pxy;
                    document.getElementById('cfg-proxy').style.display = 'block';
                } else {
                    document.getElementById('cfg-proxy-toggle').checked = false;
                    document.getElementById('cfg-proxy').value = 'socks5://38.250.116.74:1080';
                    document.getElementById('cfg-proxy').style.display = 'none';
                }
"""
html = html.replace(old_load, new_load)


# Update saveSettings to respect the toggle
old_save = "const proxy = document.getElementById('cfg-proxy').value || '';"
new_save = """
            const proxyToggle = document.getElementById('cfg-proxy-toggle').checked;
            const proxy = proxyToggle ? (document.getElementById('cfg-proxy').value || 'socks5://38.250.116.74:1080') : '';
"""
html = html.replace(old_save, new_save.strip())

with open(file_html, 'w', encoding='utf-8') as f:
    f.write(html)

print("Proxy Toggle Patched successfully!")
