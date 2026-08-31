import re

with open("src/services/ai.service.ts", "r") as f:
    text = f.read()

# Add the tool declaration
new_tool = """const toggleFeatureTool: FunctionDeclaration = {
    name: 'toggle_feature',
    description: 'Activa o desactiva características globales del bot.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            feature: {
                type: Type.STRING,
                description: 'Nombre de la característica (ej: "decrypt")'
            },
            enabled: {
                type: Type.BOOLEAN,
                description: 'true para activar, false para desactivar'
            }
        },
        required: ['feature', 'enabled']
    }
};

const executeInternalCommandTool"""

text = text.replace("const executeInternalCommandTool", new_tool)

# Add to the functionDeclarations array
text = text.replace("[generateImageTool, runTerminalCommandTool, readFileTool, sendFileTool, downloadYoutubeTool, executeInternalCommandTool]", "[generateImageTool, runTerminalCommandTool, readFileTool, sendFileTool, downloadYoutubeTool, executeInternalCommandTool, toggleFeatureTool]")


# Add the execution logic inside the switch
tool_exec = """                        } else if (call.name === 'execute_internal_command') {
"""

new_tool_exec = """                        } else if (call.name === 'toggle_feature') {
                            const { feature, enabled } = callArgs;
                            if (!options?.isOwner) {
                                functionResponse = { success: false, error: 'PERMISSION DENIED. Only the Owner (Depwise) can toggle features.' };
                            } else {
                                if (feature.toLowerCase() === 'decrypt') {
                                    const { setDecryptEnabled } = require('../connection');
                                    setDecryptEnabled(enabled);
                                    functionResponse = { success: true, message: `La función ${feature} ahora está ${enabled ? 'ACTIVADA' : 'DESACTIVADA'}.` };
                                } else {
                                    functionResponse = { success: false, error: `Feature ${feature} not found.` };
                                }
                            }
                        } else if (call.name === 'execute_internal_command') {"""

text = text.replace(tool_exec, new_tool_exec)

# Make sure it knows it can use it in SYSTEM_INSTRUCTION
sys_ins = """* Tienes acceso a herramientas avanzadas:
1. \`generate_image\`: Crea imágenes.
"""

new_sys_ins = """* Tienes acceso a herramientas avanzadas:
1. \`toggle_feature\`: Usa esto SI EL DUEÑO TE PIDE desactivar o activar funciones como 'decrypt'. NO uses run_terminal_command para esto.
2. \`generate_image\`: Crea imágenes.
"""
text = text.replace(sys_ins, new_sys_ins)

with open("src/services/ai.service.ts", "w") as f:
    f.write(text)
