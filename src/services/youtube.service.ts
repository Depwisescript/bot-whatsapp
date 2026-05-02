import * as fs from 'fs';
import * as path from 'path';
import youtubedl from 'youtube-dl-exec';
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
 * Downloads the best audio format as M4A to a temp file
 */
export async function downloadAudio(url: string, title: string): Promise<DownloadResult> {
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(tempDir, `${safeTitle}_audio_${Date.now()}.m4a`);
    
    await youtubedl(url, {
        format: 'bestaudio[ext=m4a]/bestaudio',
        output: filePath,
        noCheckCertificates: true,
        noWarnings: true
    });
    
    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    
    return {
        filePath,
        sizeMB,
        title,
        isLarge: sizeMB > 50
    };
}

/**
 * Downloads a video in standard quality (up to 720p mp4)
 */
export async function downloadVideo(url: string, title: string): Promise<DownloadResult> {
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(tempDir, `${safeTitle}_video_${Date.now()}.mp4`);
    
    await youtubedl(url, {
        format: 'best[height<=720][ext=mp4]/best[ext=mp4]/best',
        output: filePath,
        noCheckCertificates: true,
        noWarnings: true
    });
    
    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    
    return {
        filePath,
        sizeMB,
        title,
        isLarge: sizeMB > 50
    };
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
