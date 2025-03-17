import * as sharp from 'sharp';
import * as fs from 'fs';

export async function compressImage(filePath: string) {
  const outputPath = filePath.replace(/(\.[\w\d_-]+)$/i, '_compressed$1');

  await sharp(filePath)
    .resize({ width: 1024 }) // Giảm kích thước ảnh
    .jpeg({ quality: 70 })   // Nén ảnh
    .toFile(outputPath);

  fs.unlinkSync(filePath); // Xóa ảnh gốc
  return outputPath;
}