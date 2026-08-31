import re

with open("src/services/ai.service.ts", "r") as f:
    text = f.read()

# 1. Add to prompt
old_prompt = "Si te piden descargar o enviar un video/audio de internet o YouTube, usa DE INMEDIATO la herramienta download_youtube_media. NO digas que lo vas a hacer sin llamar a la herramienta. Llama a la herramienta y el sistema lo enviará automáticamente.`;"
new_prompt = "Si te piden descargar o enviar un video/audio de internet o YouTube, usa DE INMEDIATO la herramienta download_youtube_media. NO digas que lo vas a hacer sin llamar a la herramienta. Llama a la herramienta y el sistema lo enviará automáticamente.\\nSi te piden descargar una aplicación o APK, usa la herramienta download_apk_from_aptoide.`;"
text = text.replace(old_prompt, new_prompt)

# 2. Add FunctionDeclaration
old_tool_decl = """const downloadYoutubeTool: FunctionDeclaration = {"""
new_tool_decl = """const downloadApkTool: FunctionDeclaration = {
    name: 'download_apk_from_aptoide',
    description: 'Busca y descarga el archivo .apk de una aplicación desde Aptoide y lo envía por WhatsApp. Límite: 200MB. Úsalo cuando el usuario pida descargar una APK o aplicación que no está en el servidor local.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            query: { type: SchemaType.STRING, description: 'Nombre de la aplicación a descargar.' }
        },
        required: ['query']
    }
};

const downloadYoutubeTool: FunctionDeclaration = {"""
text = text.replace(old_tool_decl, new_tool_decl)

# 3. Add to tools array
old_tools_array = "tools: [{ functionDeclarations: [generateImageTool, runTerminalCommandTool, executeInternalCommandTool, sendFileTool, downloadYoutubeTool, toggleFeatureTool, readFileTool] }]"
new_tools_array = "tools: [{ functionDeclarations: [generateImageTool, runTerminalCommandTool, executeInternalCommandTool, sendFileTool, downloadYoutubeTool, toggleFeatureTool, readFileTool, downloadApkTool] }]"
text = text.replace(old_tools_array, new_tools_array)

# 4. Add execution logic
old_exec_logic = """                    else if (call.name === 'download_youtube_media') {"""
new_exec_logic = """                    else if (call.name === 'download_apk_from_aptoide') {
                        if (options?.sock && options?.jid) {
                            let filePath = '';
                            try {
                                const { searchAndDownloadApk, deleteTempApk } = require('./apk.service');
                                await options.sock.sendMessage(options.jid, { text: `🔍 Buscando y descargando *${callArgs.query}* desde Aptoide...` });
                                
                                const result = await searchAndDownloadApk(callArgs.query as string);
                                filePath = result.filePath;
                                
                                await options.sock.sendMessage(options.jid, { text: `✅ APK encontrada: *${result.title}* (${result.sizeMB.toFixed(2)} MB). Enviando...` });
                                
                                const fileBuffer = require('fs').readFileSync(filePath);
                                await options.sock.sendMessage(options.jid, {
                                    document: fileBuffer,
                                    mimetype: 'application/vnd.android.package-archive',
                                    fileName: `${result.title}.apk`,
                                    caption: `Aquí tienes tu APK descargada desde Aptoide. 📦✨`
                                });
                                
                                functionResponse = { success: true };
                            } catch (error: any) {
                                console.error('Error in download_apk_from_aptoide:', error);
                                functionResponse = { success: false, error: error.message };
                                await options.sock.sendMessage(options.jid, { text: `❌ Hubo un error al descargar la APK: ${error.message}` });
                            } finally {
                                if (filePath) {
                                    require('./apk.service').deleteTempApk(filePath);
                                }
                            }
                        } else {
                            functionResponse = { success: false, error: 'Socket no disponible.' };
                        }
                    }
                    else if (call.name === 'download_youtube_media') {"""
text = text.replace(old_exec_logic, new_exec_logic)

# 5. Add to short circuit array
old_short_circuit = "if (call.name === 'send_file_to_whatsapp' || call.name === 'download_youtube_media') {"
new_short_circuit = "if (call.name === 'send_file_to_whatsapp' || call.name === 'download_youtube_media' || call.name === 'download_apk_from_aptoide') {"
text = text.replace(old_short_circuit, new_short_circuit)

with open("src/services/ai.service.ts", "w") as f:
    f.write(text)
