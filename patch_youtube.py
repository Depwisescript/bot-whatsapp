import re

with open("src/services/ai.service.ts", "r") as f:
    text = f.read()

# Add parameter to declaration
old_params = """            query: { type: SchemaType.STRING, description: 'Término de búsqueda o URL de YouTube.' },
            type: { type: SchemaType.STRING, description: 'Tipo de descarga: "audio" o "video".' }
        },
        required: ['query', 'type']"""

new_params = """            query: { type: SchemaType.STRING, description: 'Término de búsqueda o URL de YouTube.' },
            type: { type: SchemaType.STRING, description: 'Tipo de descarga: "audio" o "video".' },
            as_document: { type: SchemaType.BOOLEAN, description: 'Si es true, se enviará como archivo/documento en lugar de nota de voz/video normal. Úsalo SI EL USUARIO PIDE EXPLÍCITAMENTE un archivo o documento.' }
        },
        required: ['query', 'type']"""
text = text.replace(old_params, new_params)


# Add logic in execution
old_exec = """                                    try {
                                        if (dl.sizeMB > 50) {
                                            await options.sock.sendMessage(options.jid, {
                                                document: { url: dl.filePath },
                                                mimetype: isAudio ? 'audio/mpeg' : 'video/mp4',
                                                fileName: `${result.title}.${isAudio ? 'mp3' : 'mp4'}`,
                                                caption: `🎧 *${result.title}* (${result.duration})\\nCanal: ${result.author}\\n_Enviado como documento por su gran tamaño._`
                                            });
                                        } else {
                                            if (isAudio) {
                                                await options.sock.sendMessage(options.jid, {
                                                    audio: { url: dl.filePath },
                                                    mimetype: 'audio/mp4',
                                                    ptt: false
                                                });
                                                await options.sock.sendMessage(options.jid, { text: `🎧 *${result.title}* (${result.duration})\\nCanal: ${result.author}` });
                                            } else {"""

new_exec = """                                    try {
                                        const sendAsDocument = callArgs.as_document === true || dl.sizeMB > 50;
                                        if (sendAsDocument) {
                                            await options.sock.sendMessage(options.jid, {
                                                document: { url: dl.filePath },
                                                mimetype: isAudio ? 'audio/mpeg' : 'video/mp4',
                                                fileName: `${result.title}.${isAudio ? 'mp3' : 'mp4'}`,
                                                caption: `🎧 *${result.title}* (${result.duration})\\nCanal: ${result.author}` + (dl.sizeMB > 50 ? '\\n_Enviado como documento por su gran tamaño._' : '')
                                            });
                                        } else {
                                            if (isAudio) {
                                                await options.sock.sendMessage(options.jid, {
                                                    audio: { url: dl.filePath },
                                                    mimetype: 'audio/mp4',
                                                    ptt: false
                                                });
                                                await options.sock.sendMessage(options.jid, { text: `🎧 *${result.title}* (${result.duration})\\nCanal: ${result.author}` });
                                            } else {"""
text = text.replace(old_exec, new_exec)

with open("src/services/ai.service.ts", "w") as f:
    f.write(text)
