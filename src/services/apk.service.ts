import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';

const tempDir = path.join(process.cwd(), 'data', 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

export async function searchAndDownloadApk(query: string): Promise<{ filePath: string, title: string, sizeMB: number, icon?: string }> {
    // 1. Search Aptoide
    const searchUrl = `http://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(query)}`;
    
    // Using global fetch
    const response = await fetch(searchUrl);
    const data: any = await response.json();
    
    if (!data || !data.datalist || !data.datalist.list || data.datalist.list.length === 0) {
        throw new Error("No se encontró ninguna aplicación con ese nombre en Aptoide.");
    }

    const app = data.datalist.list[0];
    const apkUrl = app.file.path;
    const title = app.name;
    const sizeBytes = app.file.filesize;
    const sizeMB = sizeBytes / (1024 * 1024);
    
    if (sizeMB > 200) {
        throw new Error(`La aplicación ${title} es demasiado grande (${sizeMB.toFixed(2)} MB). El límite de seguridad máximo es de 200 MB.`);
    }

    // 2. Download APK to temp folder
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(tempDir, `${safeTitle}_${Date.now()}.apk`);
    
    const downloadResponse = await fetch(apkUrl);
    if (!downloadResponse.ok) throw new Error(`Falló la descarga: ${downloadResponse.statusText}`);
    if (!downloadResponse.body) throw new Error("Body is null");

    // stream to file
    const fileStream = createWriteStream(filePath);
    
    // In Node 18+ Response.body is a ReadableStream which can be mapped to stream.Readable
    // A simple hack for cross-compatibility if stream/promises pipeline fails on WebStreams:
    const { Readable } = require('stream');
    await pipeline(Readable.fromWeb(downloadResponse.body as any), fileStream);

    return { filePath, title, sizeMB, icon: app.icon };
}

export function deleteTempApk(filePath: string) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.error('Error al borrar APK temporal:', err);
    }
}
