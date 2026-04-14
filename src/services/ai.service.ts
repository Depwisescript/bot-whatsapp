import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

// Initialize the Google Gemini client
const genAI = config.geminiApiKey ? new GoogleGenerativeAI(config.geminiApiKey) : null;

// Use the pro model for higher quality responses
const model = genAI?.getGenerativeModel({
    model: 'gemini-2.5-pro',
    systemInstruction: `Eres "Depwise AI", un asistente inteligente para grupos de WhatsApp.
Actúas de manera amigable, útil y directa. Tus respuestas deben ser cortas, claras y fáciles de leer en un chat de WhatsApp (usa viñetas y formato). 
Utiliza emojis apropiados para darle personalidad, pero sin excederte.
Si el usuario adjunta texto de un mensaje citado para darle contexto, analiza el contexto para responder su pregunta sobre ese mensaje.`,
});

/**
 * Generate a response using Google Gemini 1.5 Flash
 * 
 * @param prompt The question from the user
 * @param context The text of the quoted message (if the user replied to something)
 * @returns The AI's response text
 */
export async function generateAIResponse(prompt: string, context?: string): Promise<string> {
    if (!genAI || !model) {
        return '🤖 La funcionalidad de Inteligencia Artificial no está configurada (Falta GEMINI_API_KEY).';
    }

    try {
        let fullPrompt = prompt;

        // If the user quoted a message, include it in the prompt
        if (context) {
            fullPrompt = `[Contexto del mensaje citado, sobre el que te preguntan]:\n"${context}"\n\n[Pregunta del usuario]:\n${prompt}`;
        }

        const result = await model.generateContent(fullPrompt);
        return result.response.text();
    } catch (err) {
        console.error('Gemini API Error (Text):', err);
        return '❌ Hubo un error al intentar consultar a la Inteligencia Artificial. Por favor intenta en unos minutos.';
    }
}

/**
 * Generate an image using a completely free API (Pollinations.ai)
 * No API key required, highly reliable for bots.
 * 
 * @param prompt The description of the image to create
 * @returns A Buffer with the image data, or null on error
 */
export async function generateAIImage(prompt: string): Promise<Buffer | null> {
    try {
        // Pollinations.ai requires dummy parameters to bypass cache or ratelimits.
        const seed = Math.floor(Math.random() * 99999);
        // Using model=flux routes to a fresh, less-overloaded rendering node, resolving 500 Internal Server errors
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&enhance=true&seed=${seed}&model=flux&width=512&height=512`;
        
        // Sometimes Cloudflare/WAF block simple Node fetch causing 500 or 403. 
        // We add a realistic User-Agent to masquerade as a real browser visit.
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        if (!response.ok) {
            console.error(`[IMAGE-DEBUG] Pollinations Error: ${response.status} ${response.statusText}`);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log(`[IMAGE-DEBUG] Éxito: Imagen descargada. Tamaño: ${arrayBuffer.byteLength} bytes`);
        return Buffer.from(arrayBuffer);
    } catch (err: any) {
        console.error('[IMAGE-DEBUG] Error fatal descargando imagen:', err.message || err);
        return null;
    }
}
