import re

file_ts = 'src/commands/extra.commands.ts'
with open(file_ts, 'r', encoding='utf-8') as f:
    code = f.read()

# Fix extra.commands.ts for video and audio
new_code_video = """
            } catch (err: any) {
                console.error('Error in !video:', err);
                if (err.message === 'FILE_TOO_LARGE') {
                    await ctx.sock.sendMessage(ctx.groupJid, { text: '❌ El video es demasiado pesado (más de 100MB) para enviarlo por WhatsApp. Intenta con uno más corto.' });
                } else {
                    await ctx.sock.sendMessage(ctx.groupJid, { text: '❌ Hubo un error al descargar el video. Quizá es demasiado pesado para procesarlo en el servidor.' });
                }
            }"""

code = code.replace("""
            } catch (err) {
                console.error('Error in !video:', err);
                await ctx.sock.sendMessage(ctx.groupJid, { text: '❌ Hubo un error al descargar el video. Quizá es demasiado pesado para procesarlo en el servidor.' });
            }""", new_code_video)


new_code_audio = """
            } catch (err: any) {
                console.error('Error in !audio:', err);
                if (err.message === 'FILE_TOO_LARGE') {
                    await ctx.sock.sendMessage(ctx.groupJid, { text: '❌ El audio original pesa más de 50MB. Intenta con una pista más corta.' });
                } else {
                    await ctx.sock.sendMessage(ctx.groupJid, { text: '❌ Hubo un error al descargar el audio. Inténtalo más tarde.' });
                }
            }"""
            
code = code.replace("""
            } catch (err) {
                console.error('Error in !audio:', err);
                await ctx.sock.sendMessage(ctx.groupJid, { text: '❌ Hubo un error al descargar el audio. Inténtalo más tarde.' });
            }""", new_code_audio)

with open(file_ts, 'w', encoding='utf-8') as f:
    f.write(code)

print("extra.commands.ts patched!")
