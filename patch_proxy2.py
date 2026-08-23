import re

# 1. Update youtube.service.ts
file_yt = 'src/services/youtube.service.ts'
with open(file_yt, 'r', encoding='utf-8') as f:
    code_yt = f.read()

# Replace the fallback logic
old_logic = """const proxyUrl = process.env.YOUTUBE_PROXY || "socks5://38.250.116.74:1080";
            const proxyArg = proxyUrl ? `--proxy "${proxyUrl}"` : "";"""
new_logic = """const proxyUrl = process.env.YOUTUBE_PROXY !== undefined ? process.env.YOUTUBE_PROXY : "socks5://38.250.116.74:1080";
            const proxyArg = (proxyUrl && proxyUrl.trim() !== '') ? `--proxy "${proxyUrl}"` : "";"""

code_yt = code_yt.replace(old_logic, new_logic)

with open(file_yt, 'w', encoding='utf-8') as f:
    f.write(code_yt)


# 2. Update HTML Dashboard placeholder and text
file_html = 'src/panel/views/index.html'
with open(file_html, 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace(
    '<label>Proxy SOCKS5 para YouTube (Bypass AWS)</label>',
    '<label>Proxy SOCKS5 YouTube (Déjalo vacío para apagar)</label>'
)

html = html.replace(
    "document.getElementById('cfg-proxy').value = env.YOUTUBE_PROXY || 'socks5://38.250.116.74:1080';",
    "document.getElementById('cfg-proxy').value = env.YOUTUBE_PROXY !== undefined ? env.YOUTUBE_PROXY : 'socks5://38.250.116.74:1080';"
)

with open(file_html, 'w', encoding='utf-8') as f:
    f.write(html)

print("Proxy toggle patched!")
