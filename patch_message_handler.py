import re

file_msg = 'src/handlers/message.handler.ts'
with open(file_msg, 'r', encoding='utf-8') as f:
    code_msg = f.read()

target = "sock.ev.on('messages.upsert', async ({ messages, type }) => {"
new_logic = target + "\n        if (globalPaused) return;"

code_msg = code_msg.replace(target, new_logic)

with open(file_msg, 'w', encoding='utf-8') as f:
    f.write(code_msg)
print("Handler fixed!")
