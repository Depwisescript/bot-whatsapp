import re

file_ts = 'src/services/youtube.service.ts'
with open(file_ts, 'r', encoding='utf-8') as f:
    code = f.read()

# Fix typescript error
old_check = "if (first.seconds === 0 || first.type === 'live' || (first.duration && first.duration.timestamp === '0:00'))"
new_check = "if (first.seconds === 0 || (first as any).type === 'live' || (first.duration && first.duration.timestamp === '0:00') || first.url.includes('live'))"
code = code.replace(old_check, new_check)

with open(file_ts, 'w', encoding='utf-8') as f:
    f.write(code)

print("youtube.service.ts patched for TS!")
