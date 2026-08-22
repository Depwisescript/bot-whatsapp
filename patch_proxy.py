import re

# 1. Update youtube.service.ts
file_yt = 'src/services/youtube.service.ts'
with open(file_yt, 'r', encoding='utf-8') as f:
    code_yt = f.read()

code_yt = code_yt.replace(
    'const proxyArg = \'--proxy "socks5://38.250.116.74:1080"\';',
    'const proxyUrl = process.env.YOUTUBE_PROXY || "socks5://38.250.116.74:1080";\n            const proxyArg = proxyUrl ? `--proxy "${proxyUrl}"` : "";'
)
with open(file_yt, 'w', encoding='utf-8') as f:
    f.write(code_yt)


# 2. Update config.ts
file_cfg = 'src/config.ts'
with open(file_cfg, 'r', encoding='utf-8') as f:
    code_cfg = f.read()

code_cfg = code_cfg.replace(
    "panelPass: process.env.PANEL_PASS || '',",
    "panelPass: process.env.PANEL_PASS || '',\n\n    /** Proxy SOCKS5 para yt-dlp */\n    youtubeProxy: process.env.YOUTUBE_PROXY || 'socks5://38.250.116.74:1080',"
)
with open(file_cfg, 'w', encoding='utf-8') as f:
    f.write(code_cfg)


# 3. Update HTML Dashboard
file_html = 'src/panel/views/index.html'
with open(file_html, 'r', encoding='utf-8') as f:
    html = f.read()

new_general_html = """
                            <div class="form-group">
                                <label>Mensaje de Auto-respuesta (Privado)</label>
                                <textarea id="cfg-autoreply" rows="4" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; color:#fff; padding:8px;"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Proxy SOCKS5 para YouTube (Bypass AWS)</label>
                                <input type="text" id="cfg-proxy" placeholder="socks5://38.250.116.74:1080">
                            </div>
"""
html = html.replace("""
                            <div class="form-group">
                                <label>Mensaje de Auto-respuesta (Privado)</label>
                                <textarea id="cfg-autoreply" rows="4" style="width:100%; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; color:#fff; padding:8px;"></textarea>
                            </div>
""", new_general_html)

# Add proxy to loadSettings
html = html.replace(
    "document.getElementById('cfg-autoreply').value = (env.AUTO_REPLY_MSG || '').replace(/\\\\\\\\n/g, '\\\\n');",
    "document.getElementById('cfg-autoreply').value = (env.AUTO_REPLY_MSG || '').replace(/\\\\\\\\n/g, '\\\\n');\n                document.getElementById('cfg-proxy').value = env.YOUTUBE_PROXY || 'socks5://38.250.116.74:1080';"
)

# Add proxy to saveSettings
html = html.replace(
    "const autoreply = document.getElementById('cfg-autoreply').value.replace(/\\\\n/g, '\\\\\\\\n');",
    "const autoreply = document.getElementById('cfg-autoreply').value.replace(/\\\\n/g, '\\\\\\\\n');\n            const proxy = document.getElementById('cfg-proxy').value || '';"
)

html = html.replace(
    "envContent += `OPENAI_MODEL=openai/gpt-oss-120b\\n`;",
    "envContent += `OPENAI_MODEL=openai/gpt-oss-120b\\n`;\n            envContent += `YOUTUBE_PROXY=${proxy}\\n`;"
)

with open(file_html, 'w', encoding='utf-8') as f:
    f.write(html)

print("Proxy integrated to Settings!")
