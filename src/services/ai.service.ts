import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

// ── System instruction shared by all AI providers ────────────────
const SYSTEM_INSTRUCTION = `Eres "Depwise AI", un asistente inteligente para grupos de WhatsApp.
Actúas de manera amigable, útil y directa. Tus respuestas deben ser cortas, claras y fáciles de leer en un chat de WhatsApp (usa viñetas y formato). 
Utiliza emojis apropiados para darle personalidad, pero sin excederte.
Si el usuario adjunta texto de un mensaje citado para darle contexto, analiza el contexto para responder su pregunta sobre ese mensaje.`;

// ── Gemini (last resort fallback) ────────────────────────────────
const genAI = config.geminiApiKey ? new GoogleGenerativeAI(config.geminiApiKey) : null;
const geminiModel = genAI?.getGenerativeModel({
    model: 'gemini-2.0-flash',
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
 * Call Pollinations.ai with a specific model.
 * Free, unlimited, no API key needed.
 */
async function pollinationsChat(model: string, prompt: string, context?: string): Promise<string> {
    const fullPrompt = buildPrompt(prompt, context);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
        const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: SYSTEM_INSTRUCTION },
                    { role: 'user', content: fullPrompt },
                ],
                max_tokens: 1024,
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;
        const text = data?.choices?.[0]?.message?.content;

        if (!text) {
            throw new Error('Empty response from model');
        }

        return text;
    } finally {
        clearTimeout(timeout);
    }
}

// List of Pollinations models to try in order (all free)
const POLLINATIONS_MODELS = [
    'openai',           // GPT-4o mini — fast, reliable
    'gemini',           // Gemini 2.5 Flash via Pollinations (no key needed!)
    'claude-fast',      // Claude Haiku — fast  
    'mistral',          // Mistral — good quality
];

/**
 * Generate an AI response. Tries multiple Pollinations models,
 * then falls back to direct Gemini API as last resort.
 */
export async function generateAIResponse(prompt: string, context?: string): Promise<string> {
    // Try each Pollinations model in order
    for (const model of POLLINATIONS_MODELS) {
        try {
            const response = await pollinationsChat(model, prompt, context);
            console.log(`[AI] ✓ Response from Pollinations (${model})`);
            return response;
        } catch (err: any) {
            console.warn(`[AI] ✗ Pollinations ${model}: ${err.message || err}`);
        }
    }

    // Last resort: direct Gemini API (has rate limits on free tier)
    if (genAI && geminiModel) {
        try {
            const fullPrompt = buildPrompt(prompt, context);
            const result = await geminiModel.generateContent(fullPrompt);
            console.log('[AI] ✓ Response from Gemini API (direct fallback)');
            return result.response.text();
        } catch (err: any) {
            console.error('[AI] ✗ Gemini API:', err.message || err);
        }
    }

    return '❌ No se pudo conectar con la IA. Intenta de nuevo en unos segundos.';
}

/**
 * Generate an image using Pollinations.ai (free, no API key required)
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
