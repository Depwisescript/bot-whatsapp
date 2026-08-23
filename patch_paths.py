import re

file_panel = 'src/panel/panel.ts'
with open(file_panel, 'r', encoding='utf-8') as f:
    code = f.read()

# Fix backup path
code = code.replace("path.resolve(__dirname, '../../../')", "path.resolve(__dirname, '../../')")

with open(file_panel, 'w', encoding='utf-8') as f:
    f.write(code)

print("Paths patched!")
