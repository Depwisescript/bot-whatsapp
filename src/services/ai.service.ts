import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

// Initialize the Google Gemini client
const genAI = config.geminiApiKey ? new GoogleGenerativeAI(config.geminiApiKey) : null;

// Use the flash model which is faster and great for chat
const model = genAI?.getGenerativeModel({
    model: 'gemini-2.5-flash',
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
        // Pollinations.ai is a fantastic free API that wraps Stable Diffusion
        // encodeURIComponent ensures spaces/emojis in the prompt don't break the URL
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&enhance=true`;
        
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Pollinations API Error: ${response.status} ${response.statusText}`);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (err) {
        console.error('Image Generation Error:', err);
        return null;
    }
}
