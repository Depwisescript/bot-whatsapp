import * as fs from 'fs';
import * as path from 'path';
import ytdl from '@distube/ytdl-core';
import ytSearch from 'yt-search';

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
 * Downloads the best audio format as MP3/WebM/M4A to a temp file
 */
export async function downloadAudio(url: string, title: string): Promise<DownloadResult> {
    return new Promise((resolve, reject) => {
        try {
            const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
            const filePath = path.join(tempDir, `${safeTitle}_audio_${Date.now()}.mp3`);
            
            // Getting highest quality audio
            const stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });
            
            const writeStream = fs.createWriteStream(filePath);
            stream.pipe(writeStream);
            
            writeStream.on('finish', () => {
                const stats = fs.statSync(filePath);
                const sizeMB = stats.size / (1024 * 1024);
                resolve({
                    filePath,
                    sizeMB,
                    title,
                    isLarge: sizeMB > 50
                });
            });

            writeStream.on('error', (err) => {
                reject(err);
            });
            stream.on('error', (err) => {
                reject(err);
            });
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Downloads a video in standard quality (usually 360p or 720p) with merged audio and video
 */
export async function downloadVideo(url: string, title: string): Promise<DownloadResult> {
    return new Promise((resolve, reject) => {
        try {
            const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
            const filePath = path.join(tempDir, `${safeTitle}_video_${Date.now()}.mp4`);
            
            // audioandvideo ensures we don't have to mux it manually. It's usually 360p or 720p.
            const stream = ytdl(url, { filter: 'audioandvideo', quality: 'highest' });
            
            const writeStream = fs.createWriteStream(filePath);
            stream.pipe(writeStream);
            
            writeStream.on('finish', () => {
                const stats = fs.statSync(filePath);
                const sizeMB = stats.size / (1024 * 1024);
                resolve({
                    filePath,
                    sizeMB,
                    title,
                    isLarge: sizeMB > 50
                });
            });

            writeStream.on('error', (err) => {
                reject(err);
            });
            stream.on('error', (err) => {
                reject(err);
            });
        } catch (err) {
            reject(err);
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
