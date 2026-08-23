import re

file_ts = 'src/services/ai.service.ts'
with open(file_ts, 'r', encoding='utf-8') as f:
    code = f.read()

# Fix ai.service.ts return value on tool failure
old_code = """                    // Si la herramienta ya envió el archivo o mensaje, no necesitamos que la IA responda más.
                    if (call.name === 'send_file_to_whatsapp' || call.name === 'download_youtube_media') {
                        if (options?.jid && options?.sender) {
                            chatSessions.delete(`${options.jid}_${options.sender}`);
                        }
                        return '¡Listo! ✅'; // El bot enviará este mensaje confirmando la acción
                    }"""

new_code = """                    // Si la herramienta ya envió el archivo o mensaje, no necesitamos que la IA responda más.
                    if (call.name === 'send_file_to_whatsapp' || call.name === 'download_youtube_media') {
                        if (options?.jid && options?.sender) {
                            chatSessions.delete(`${options.jid}_${options.sender}`);
                        }
                        if (functionResponse && !functionResponse.success) {
                            return `❌ ${functionResponse.error || 'Hubo un error al procesar tu solicitud.'}`;
                        }
                        return '¡Listo! ✅'; // El bot enviará este mensaje confirmando la acción
                    }"""

code = code.replace(old_code, new_code)

with open(file_ts, 'w', encoding='utf-8') as f:
    f.write(code)

print("AI patched!")
