import re

file_ts = 'src/services/youtube.service.ts'
with open(file_ts, 'r', encoding='utf-8') as f:
    code = f.read()

# Fix the format string to force H.264 (avc1) for WhatsApp compatibility
old_cmd = 'const command = `yt-dlp ${proxyArg} --max-filesize 100M -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best" --no-warnings -o "${filePath}" "${url}"`;'
new_cmd = 'const command = `yt-dlp ${proxyArg} --max-filesize 100M -f "bestvideo[height<=480][ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<=480][ext=mp4][vcodec^=avc1]/best" --no-warnings -o "${filePath}" "${url}"`;'

code = code.replace(old_cmd, new_cmd)

with open(file_ts, 'w', encoding='utf-8') as f:
    f.write(code)

print("Codec patched!")
