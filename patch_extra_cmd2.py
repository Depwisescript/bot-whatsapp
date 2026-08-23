import re

file_ts = 'src/commands/extra.commands.ts'
with open(file_ts, 'r', encoding='utf-8') as f:
    code = f.read()

# Fix video catch
old_video = """                } else {
                    await ctx.sock.sendMessage(ctx.groupJid, { text: '❌ Hubo un error al descargar el video. Quizá es demasiado pesado para procesarlo en el servidor.' });
                }"""
new_video = """                } else if (err.message && (err.message.includes('demasiado largo') || err.message.includes('transmisiones en vivo'))) {
                    await ctx.sock.sendMessage(ctx.groupJid, { text: `❌ ${err.message}` });
                } else {
                    await ctx.sock.sendMessage(ctx.groupJid, { text: '❌ Hubo un error al descargar el video. Quizá es demasiado pesado para procesarlo en el servidor.' });
                }"""
code = code.replace(old_video, new_video)

# Fix audio catch
old_audio = """                } else {
                    await ctx.sock.sendMessage(ctx.groupJid, { text: '❌ Hubo un error al descargar el audio. Inténtalo más tarde.' });
                }"""
new_audio = """                } else if (err.message && (err.message.includes('demasiado largo') || err.message.includes('transmisiones en vivo'))) {
                    await ctx.sock.sendMessage(ctx.groupJid, { text: `❌ ${err.message}` });
                } else {
                    await ctx.sock.sendMessage(ctx.groupJid, { text: '❌ Hubo un error al descargar el audio. Inténtalo más tarde.' });
                }"""
code = code.replace(old_audio, new_audio)

with open(file_ts, 'w', encoding='utf-8') as f:
    f.write(code)

print("extra.commands.ts patched for descriptive errors!")
