import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import ytSearch from 'yt-search';

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

        const first = videos[0];
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
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(tempDir, `${safeTitle}_audio_${Date.now()}.mp3`);
    
    try {
        // Usa yt-dlp con cookies (única forma si la IP del VPS está baneada)
        const cookiesPath = path.resolve('./cookies.txt');
        const cookiesArg = fs.existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : '';
        await execAsync(`yt-dlp ${cookiesArg} --extractor-args "youtube:player_client=ios" --extract-audio --audio-format mp3 --audio-quality 0 --no-warnings -o "${filePath}" "${url}"`);
        
        const stats = fs.statSync(filePath);
        const sizeMB = stats.size / (1024 * 1024);
        
        return {
            filePath,
            sizeMB,
            title,
            isLarge: sizeMB > 50
        };
    } catch (err) {
        console.error('Error en downloadAudio yt-dlp:', err);
        throw err;
    }
}

/**
 * Downloads a video in standard quality (up to 720p mp4)
 */
export async function downloadVideo(url: string, title: string): Promise<DownloadResult> {
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(tempDir, `${safeTitle}_video_${Date.now()}.mp4`);
    
    try {
        // Usa yt-dlp con cookies
        const cookiesPath = path.resolve('./cookies.txt');
        const cookiesArg = fs.existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : '';
        await execAsync(`yt-dlp ${cookiesArg} --extractor-args "youtube:player_client=ios" -f "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 --no-warnings -o "${filePath}" "${url}"`);
        
        const stats = fs.statSync(filePath);
        const sizeMB = stats.size / (1024 * 1024);
        
        return {
            filePath,
            sizeMB,
            title,
            isLarge: sizeMB > 50
        };
    } catch (err) {
        console.error('Error en downloadVideo yt-dlp:', err);
        throw err;
    }
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
