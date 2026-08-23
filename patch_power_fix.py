import re

file_html = 'src/panel/views/index.html'
with open(file_html, 'r', encoding='utf-8') as f:
    html = f.read()

old_btn = '<button class="btn btn-danger" onclick="disconnectWhatsApp()" id="btn-disconnect">🔴 Desvincular Número (Generar nuevo QR)</button>'
new_buttons = """
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button class="btn btn-danger" style="padding: 10px 20px;" onclick="disconnectWhatsApp()" id="btn-disconnect">🔴 Desvincular</button>
                        <button class="btn" style="background: #e6a23c; color: white; padding: 10px 20px; border: none;" onclick="togglePauseBot()" id="btn-pause">⏸️ Pausar Bot</button>
                        <button class="btn" style="background: var(--primary); color: white; padding: 10px 20px; border: none;" onclick="restartBot()" id="btn-restart">🔄 Reiniciar</button>
                    </div>
"""
html = html.replace(old_btn, new_buttons.strip())

with open(file_html, 'w', encoding='utf-8') as f:
    f.write(html)
print("HTML buttons fixed!")
