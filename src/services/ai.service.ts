import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

// ── System instruction shared by all AI providers ────────────────
const SYSTEM_INSTRUCTION = `Eres "Depwise AI", un asistente inteligente para grupos de WhatsApp.
Actúas de manera amigable, útil y directa. Tus respuestas deben ser cortas, claras y fáciles de leer en un chat de WhatsApp (usa viñetas y formato). 
Utiliza emojis apropiados para darle personalidad, pero sin excederte.
Si el usuario adjunta texto de un mensaje citado para darle contexto, analiza el contexto para responder su pregunta sobre ese mensaje.`;

// ── Gemini (fallback) ────────────────────────────────────────────
const genAI = config.geminiApiKey ? new GoogleGenerativeAI(config.geminiApiKey) : null;
const geminiModel = genAI?.getGenerativeModel({
    model: 'gemini-2.5-pro',
    systemInstruction: SYSTEM_INSTRUCTION,
});

/**
 * Build the full prompt including optional quoted context.
 */
function buildPrompt(prompt: string, context?: string): string {
    if (context) {
        return `[Contexto del mensaje citado, sobre el que te preguntan]:\n"${context}"\n\n[Pregunta del usuario]:\n${prompt}`;
    }
    return prompt;
}

/**
 * PRIMARY: Generate text using Pollinations.ai (free, unlimited, no API key)
 * Uses OpenAI-compatible endpoint at gen.pollinations.ai
 */
async function pollinationsText(prompt: string, context?: string): Promise<string> {
    const fullPrompt = buildPrompt(prompt, context);

    const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'DepwiseBot/1.0',
        },
        body: JSON.stringify({
            model: 'openai',
            messages: [
                { role: 'system', content: SYSTEM_INSTRUCTION },
                { role: 'user', content: fullPrompt },
            ],
            max_tokens: 1024,
        }),
    });

    if (!response.ok) {
        throw new Error(`Pollinations API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
        throw new Error('Pollinations returned empty response');
    }

    return text;
}

/**
 * FALLBACK: Generate text using Google Gemini
 */
async function geminiText(prompt: string, context?: string): Promise<string> {
    if (!genAI || !geminiModel) {
        throw new Error('Gemini not configured');
    }

    const fullPrompt = buildPrompt(prompt, context);
    const result = await geminiModel.generateContent(fullPrompt);
    return result.response.text();
}

/**
 * Generate an AI response. Tries Pollinations first (free/unlimited),
 * falls back to Gemini Pro if it fails.
 * 
 * @param prompt The question from the user
 * @param context The text of the quoted message (if the user replied to something)
 * @returns The AI's response text
 */
export async function generateAIResponse(prompt: string, context?: string): Promise<string> {
    // Try Pollinations first (free, unlimited)
    try {
        const response = await pollinationsText(prompt, context);
        console.log('[AI] Response from: Pollinations ✓');
        return response;
    } catch (err: any) {
        console.warn('[AI] Pollinations failed:', err.message || err);
    }

    // Fallback to Gemini Pro
    try {
        const response = await geminiText(prompt, context);
        console.log('[AI] Response from: Gemini Pro (fallback) ✓');
        return response;
    } catch (err: any) {
        console.error('[AI] Gemini also failed:', err.message || err);
    }

    return '❌ No se pudo contactar ningún servicio de IA. Intenta de nuevo en unos minutos.';
}

/**
 * Generate an image using Pollinations.ai (free, no API key required)
 * 
 * @param prompt The description of the image to create
 * @returns A Buffer with the image data, or null on error
 */
export async function generateAIImage(prompt: string): Promise<Buffer | null> {
    try {
        const seed = Math.floor(Math.random() * 99999);
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&enhance=true&seed=${seed}&model=flux&width=512&height=512`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        if (!response.ok) {
            console.error(`[IMAGE] Pollinations Error: ${response.status} ${response.statusText}`);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log(`[IMAGE] Éxito: Imagen descargada. Tamaño: ${arrayBuffer.byteLength} bytes`);
        return Buffer.from(arrayBuffer);
    } catch (err: any) {
        console.error('[IMAGE] Error fatal descargando imagen:', err.message || err);
        return null;
    }
}
