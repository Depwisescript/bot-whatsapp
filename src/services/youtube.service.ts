import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import ytSearch from 'yt-search';

// --- Cola de descargas simple para no explotar la VPS ---
class AsyncQueue {
    private queue: (() => Promise<void>)[] = [];
    private processing = false;

    async add<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const res = await task();
                    resolve(res);
                } catch (e) {
                    reject(e);
                }
            });
            if (!this.processing) this.processNext();
        });
    }

    private async processNext() {
        if (this.queue.length === 0) {
            this.processing = false;
            return;
        }
        this.processing = true;
        const task = this.queue.shift();
        if (task) await task();
        this.processNext();
    }
}
export const downloadQueue = new AsyncQueue();
// --------------------------------------------------------

const execAsync = promisify(exec);

// Temporary directory for downloads
const tempDir = path.resolve('./data/temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

export interface YouTubeSearchResult {
    title: string;
    url: string;
    duration: string;
    author: string;
}

export interface DownloadResult {
    filePath: string;
    sizeMB: number;
    title: string;
    isLarge: boolean; // Over 50MB
}

/**
 * Searches YouTube and returns the best match
 */
export async function searchYouTube(query: string): Promise<YouTubeSearchResult | null> {
    try {
        const result = await ytSearch(query);
        const videos = result.videos;
        if (videos.length === 0) return null;

        let first = videos[0];
        
        // Buscar el primer video que dure menos de 20 minutos (1200 segundos)
        for (const v of videos) {
            if (v.seconds && v.seconds <= 1200) {
                first = v;
                break;
            }
        }

        if (first.seconds && first.seconds > 1200) {
            throw new Error('El video es demasiado largo (máximo 20 minutos). ¡Pobre VPS! 🐢');
        }

        return {
            title: first.title,
            url: first.url,
            duration: first.timestamp,
            author: first.author.name
        };
    } catch (err) {
        console.error('Error in searchYouTube:', err);
        return null;
    }
}

/**
 * Downloads the best audio format
 */
export async function downloadAudio(url: string, title: string): Promise<DownloadResult> {
    return downloadQueue.add(async () => {
        const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filePath = path.join(tempDir, `${safeTitle}_audio_${Date.now()}.mp3`);
        
        try {
            // Usa yt-dlp con proxy de la VPS de Perú (sin cookies porque el proxy está limpio)
            const proxyUrl = process.env.YOUTUBE_PROXY !== undefined ? process.env.YOUTUBE_PROXY : "socks5://38.250.116.74:1080";
            const proxyArg = (proxyUrl && proxyUrl.trim() !== '') ? `--proxy "${proxyUrl}"` : "";
            
            const command = `yt-dlp ${proxyArg} --max-filesize 100M --extract-audio --audio-format mp3 --audio-quality 0 --no-warnings -o "${filePath}" "${url}"`;
            await execAsync(command);
            
            // Check file size
            const stats = fs.statSync(filePath);
            const sizeMB = stats.size / (1024 * 1024);
            
            return {
                filePath,
                title,
                sizeMB,
                isLarge: sizeMB > 50
            };
        } catch (err: any) {
            console.error('Error in downloadAudio:', err.message || err);
            // Si falla, intentamos borrar cualquier residuo
            try { fs.unlinkSync(filePath); } catch (e) {}
            throw err;
        }
    });
}

/**
 * Downloads a video in standard quality (up to 720p mp4)
 */
export async function downloadVideo(url: string, title: string): Promise<DownloadResult> {
    return downloadQueue.add(async () => {
        const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filePath = path.join(tempDir, `${safeTitle}_video_${Date.now()}.mp4`);
        
        try {
            const proxyUrl = process.env.YOUTUBE_PROXY !== undefined ? process.env.YOUTUBE_PROXY : "socks5://38.250.116.74:1080";
            const proxyArg = (proxyUrl && proxyUrl.trim() !== '') ? `--proxy "${proxyUrl}"` : "";
            const command = `yt-dlp ${proxyArg} --max-filesize 100M -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best" --no-warnings -o "${filePath}" "${url}"`;
            await execAsync(command);
            
            if (!fs.existsSync(filePath)) {
                throw new Error("FILE_TOO_LARGE");
            }
            
            const stats = fs.statSync(filePath);
            const sizeMB = stats.size / (1024 * 1024);
            
            return {
                filePath,
                sizeMB,
                title,
                isLarge: sizeMB > 50
            };
        } catch (err: any) {
            console.error('Error en downloadVideo yt-dlp:', err.message || err);
            try { fs.unlinkSync(filePath); } catch (e) {}
            throw err;
        }
    });
}

/**
 * Removes a file safely (to be called after sending)
 */
export function deleteTempFile(filePath: string): void {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.error(`Error deleting temp file ${filePath}:`, err);
    }
}
