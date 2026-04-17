import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

// ── System instruction shared by all AI providers ────────────────
const SYSTEM_INSTRUCTION = `Eres "Depwise AI", un asistente inteligente para grupos de WhatsApp.
Actúas de manera amigable, útil y directa. Tus respuestas deben ser cortas, claras y fáciles de leer en un chat de WhatsApp (usa viñetas y formato). 
Utiliza emojis apropiados para darle personalidad, pero sin excederte.
Si el usuario adjunta texto de un mensaje citado para darle contexto, analiza el contexto para responder su pregunta sobre ese mensaje.`;

// ── Gemini (primary provider) ────────────────────────────────────
const genAI = config.geminiApiKey ? new GoogleGenerativeAI(config.geminiApiKey) : null;
const geminiModel = genAI?.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
});

// ── Pollinations API key (optional fallback) ─────────────────────
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || '';

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
 * Pollinations.ai via POST (OpenAI-compatible) — requires API key
 */
async function pollinationsPOST(model: string, prompt: string, context?: string): Promise<string> {
    const fullPrompt = buildPrompt(prompt, context);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (POLLINATIONS_API_KEY) {
            headers['Authorization'] = `Bearer ${POLLINATIONS_API_KEY}`;
        }

        const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
            method: 'POST',
            headers,
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
            throw new Error('Empty response');
        }

        return text;
    } finally {
        clearTimeout(timeout);
    }
}

// Models to try via Pollinations
const POLLINATIONS_MODELS = ['openai', 'gemini', 'mistral', 'deepseek'];

/**
 * Generate an AI response. Strategy:
 * 1. Gemini API (primary — fast and reliable with API key)
 * 2. Pollinations POST (fallback — requires POLLINATIONS_API_KEY)
 */
export async function generateAIResponse(prompt: string, context?: string): Promise<string> {
    // Strategy 1: Gemini API (primary)
    if (genAI && geminiModel) {
        try {
            const fullPrompt = buildPrompt(prompt, context);
            const result = await geminiModel.generateContent(fullPrompt);
            const text = result.response.text();
            if (text) {
                console.log('[AI] ✓ Gemini API');
                return text;
            }
        } catch (err: any) {
            console.warn(`[AI] ✗ Gemini: ${err.message || err}`);
        }
    }

    // Strategy 2: Pollinations POST (fallback, only if API key is set)
    if (POLLINATIONS_API_KEY) {
        for (const model of POLLINATIONS_MODELS) {
            try {
                const response = await pollinationsPOST(model, prompt, context);
                console.log(`[AI] ✓ Pollinations POST (${model})`);
                return response;
            } catch (err: any) {
                console.warn(`[AI] ✗ Pollinations ${model}: ${err.message || err}`);
            }
        }
    }

    return '❌ No se pudo conectar con la IA. Intenta de nuevo en unos segundos.';
}

/**
 * Generate an image using Pollinations.ai
 */
export async function generateAIImage(prompt: string): Promise<Buffer | null> {
    try {
        const seed = Math.floor(Math.random() * 99999);
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&enhance=true&seed=${seed}&model=flux&width=512&height=512`;

        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        };
        if (POLLINATIONS_API_KEY) {
            headers['Authorization'] = `Bearer ${POLLINATIONS_API_KEY}`;
        }

        const response = await fetch(url, { headers });

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
