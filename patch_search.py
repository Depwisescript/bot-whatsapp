import re

file_ts = 'src/services/youtube.service.ts'
with open(file_ts, 'r', encoding='utf-8') as f:
    code = f.read()

# Make searchYouTube throw instead of return null on error
code = code.replace("""    } catch (err) {
        console.error('Error in searchYouTube:', err);
        return null;
    }""", """    } catch (err) {
        console.error('Error in searchYouTube:', err);
        throw err;
    }""")

# Add check for livestream
old_check = """        if (first.seconds && first.seconds > 1200) {
            throw new Error('El video es demasiado largo (máximo 20 minutos). ¡Pobre VPS! 🐢');
        }"""
        
new_check = """        if (first.seconds && first.seconds > 1200) {
            throw new Error('El video es demasiado largo (máximo 20 minutos). ¡Pobre VPS! 🐢');
        }
        
        if (first.seconds === 0 || first.type === 'live' || (first.duration && first.duration.timestamp === '0:00')) {
            throw new Error('No puedo descargar transmisiones en vivo (Live Streams).');
        }"""

code = code.replace(old_check, new_check)

with open(file_ts, 'w', encoding='utf-8') as f:
    f.write(code)

print("youtube.service.ts patched!")
