import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Directory for storing temporary configuration files sent for decryption
const decryptTempDir = path.resolve('./data/temp/decrypt');
if (!fs.existsSync(decryptTempDir)) {
    fs.mkdirSync(decryptTempDir, { recursive: true });
}

export { decryptTempDir };

export interface DecryptionResult {
    success: boolean;
    output?: string;
    error?: string;
}

/**
 * Executes the Python bridge script to decrypt a VPN configuration file or link (.hc, .ehi, darktunnel://, ssc://)
 */
export async function decryptVPNConfig(target: string): Promise<DecryptionResult> {
    try {
        // Try venv python first, fallback to python3 in system
        const venvPython1 = path.resolve('./scripts/decryption/venv/bin/python3');
        const venvPython2 = path.resolve(__dirname, '../../scripts/decryption/venv/bin/python3');
        let pythonCmd = 'python3';
        if (fs.existsSync(venvPython1)) {
            pythonCmd = `"${venvPython1}"`;
        } else if (fs.existsSync(venvPython2)) {
            pythonCmd = `"${venvPython2}"`;
        }
        
        const bridgeScript1 = path.resolve('./scripts/decryption/bridge.py');
        const bridgeScript2 = path.resolve(__dirname, '../../scripts/decryption/bridge.py');
        const bridgeScript = fs.existsSync(bridgeScript1) ? bridgeScript1 : bridgeScript2;
        
        if (!fs.existsSync(bridgeScript)) {
            return {
                success: false,
                error: '⚠️ Error interno: No se encuentra el script puente de desencriptación en el servidor.'
            };
        }

        const command = `${pythonCmd} "${bridgeScript}" "${target}"`;
        const { stdout, stderr } = await execAsync(command, { timeout: 15000 });

        if (stdout && stdout.trim().length > 0) {
            return {
                success: true,
                output: stdout.trim()
            };
        }

        return {
            success: false,
            error: stderr || 'No se pudo desencriptar la configuración con los módulos disponibles.'
        };
    } catch (err: any) {
        console.error('Error en decryptVPNConfig:', err);
        let errorMsg = 'No se pudo desencriptar la configuración. Formato no soportado o archivo protegido.';
        const outputToParse = (err && err.stdout && err.stdout.trim()) || (err && err.stderr && err.stderr.trim()) || '';
        if (outputToParse) {
            try {
                const parsed = JSON.parse(outputToParse);
                if (parsed.error) errorMsg = parsed.error;
            } catch {
                if (outputToParse.includes("Falta") || outputToParse.includes("ERROR:") || outputToParse.includes("ModuleNotFoundError")) {
                    errorMsg = `⚠️ Error del motor de desencriptación: ${outputToParse}`;
                }
            }
        }
        return {
            success: false,
            error: errorMsg
        };
    }
}

/**
 * Safely removes a temporary file after decryption
 */
export function cleanupDecryptFile(filePath: string): void {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.error('Error limpiando archivo temporal de desencriptación:', err);
    }
}
