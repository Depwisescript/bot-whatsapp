import re

file_html = 'src/panel/views/index.html'
with open(file_html, 'r', encoding='utf-8') as f:
    html = f.read()

# Fix the button
old_button = '<button onclick="switchTab(\'tab-files\')">📁 Archivos</button>'
new_button = '<button onclick="switchTab(\'tab-files\')">📁 Archivos</button>\n                <button onclick="switchTab(\'tab-migration\')">📦 Migración</button>'
html = html.replace(old_button, new_button)

with open(file_html, 'w', encoding='utf-8') as f:
    f.write(html)

print("Fixed tabs!")
