import re
file_panel = 'src/panel/panel.ts'
with open(file_panel, 'r', encoding='utf-8') as f:
    code_panel = f.read()

code_panel = code_panel.replace(
    "import { globalQR, globalStatus, globalSock } from '../connection';",
    "import { globalQR, globalStatus, globalSock, globalPaused, setPaused } from '../connection';"
)

with open(file_panel, 'w', encoding='utf-8') as f:
    f.write(code_panel)
print("Import fixed!")
