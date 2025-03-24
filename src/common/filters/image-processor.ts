import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

export async function compressImage(filePath: string) {
    const outputPath = filePath.replace(/(\.[\w\d_-]+)$/i, '_compressed$1');

    await sharp(filePath)
        .resize({ width: 1024 })
        .jpeg({ quality: 70 })
        .toFile(outputPath);

    try {
        await fs.promises.unlink(filePath); 
    } catch (err) {
        const imagesDir = path.dirname(filePath);
        const tempDir = path.join(imagesDir, 'temp');

        await fs.promises.mkdir(tempDir, { recursive: true });

        const tempFilePath = path.join(tempDir, path.basename(filePath));
        await fs.promises.rename(filePath, tempFilePath);
    }

    return outputPath;
}