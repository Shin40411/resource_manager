import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { compressImage } from './image-processor';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

@Injectable()
export class UploadsService {
  private ENCRYPTION_KEY: Buffer;
  private IV_LENGTH = 16;

  constructor(private readonly prisma: PrismaService, private readonly configService: ConfigService) {
    const keyFromEnv = this.configService.get<string>('ENCRYPTION_KEY');
    if (!keyFromEnv || keyFromEnv.length !== 64) {
      throw new Error('ENCRYPTION_KEY không chính xác. Phải là 64 ký tự dạng hex.');
    }

    this.ENCRYPTION_KEY = Buffer.from(keyFromEnv, 'hex');
  }

  private encryptFile(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(inputPath)) {
        return reject(new Error(`Không tìm thấy file: ${inputPath}`));
      }

      try {
        const iv = crypto.randomBytes(this.IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', this.ENCRYPTION_KEY, iv);

        const input = fs.createReadStream(inputPath);
        const output = fs.createWriteStream(outputPath);

        output.write(iv);
        input.pipe(cipher).pipe(output);

        output.on('finish', () => {
          resolve();
        });

        output.on('error', (err) => {
          reject(err);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private getMimeType(type: string): string {
    const mimeTypes = {
      IMAGE: 'image/jpeg',
      VIDEO: 'video/mp4',
      FILE: 'application/octet-stream',
    };
    return mimeTypes[type] || 'application/octet-stream';
  }

  async handleUpload(files: any[]) {
    const filePaths = await Promise.all(
      files.map(async (file) => {
        let filePath = file.path;

        if (file.mimetype.startsWith('image')) {
          filePath = await compressImage(file.path);
        }

        let fileType: 'IMAGE' | 'VIDEO' | 'FILE' = 'FILE';
        if (file.mimetype.startsWith('image')) fileType = 'IMAGE';
        if (file.mimetype.startsWith('video')) fileType = 'VIDEO';

        const fileExt = path.extname(file.originalname);
        const hashName = crypto.createHash('sha256').update(file.originalname + Date.now()).digest('hex');
        const encryptedFileName = `${hashName}${fileExt}`;

        const encryptedFilePath = path.join(path.dirname(filePath), encryptedFileName);

        if (!fs.existsSync(filePath)) {
          throw new Error(`Không tìm thấy file: ${filePath}`);
        }

        await this.encryptFile(filePath, encryptedFilePath);
        fs.unlink(filePath, (err) => {
          if (err)
            throw new Error(`❌ Lỗi khi xóa file gốc ${filePath}:`, err);
        });

        return await this.saveFileData(encryptedFileName, encryptedFilePath.replace('uploads/', '/'), fileType, file.size);
      })
    );
    return { files: filePaths };
  }

  async saveFileData(filename: string, path: string, type: 'IMAGE' | 'VIDEO' | 'FILE', size: number) {
    try {
      return await this.prisma.resource.create({
        data: {
          filename,
          path,
          type,
          size,
        },
      });
    } catch (error) {
      console.error('Lỗi khi lưu vào database:', error);
      throw new InternalServerErrorException('Lưu file vào database thất bại');
    }
  }

  async getDecryptedFile(filename: string, res: Response) {
    const resource = await this.prisma.resource.findUnique({
      where: { filename },
    });
    
    if (!resource) {
      throw new NotFoundException('File không tồn tại');
    }
    
    const encryptedFilePath = path.join(resource.path);
    if (!fs.existsSync(encryptedFilePath)) {
      throw new NotFoundException('File đã bị xóa hoặc không tồn tại trên server');
    }

    const input = fs.createReadStream(encryptedFilePath);
    const iv = Buffer.alloc(this.IV_LENGTH);

    input.read(iv.length);
    input.once('readable', () => {
      const readBytes = input.read(iv.length);
      if (!readBytes) {
        throw new Error('Không thể đọc IV từ file');
      }
      iv.set(readBytes);

      const decipher = crypto.createDecipheriv('aes-256-cbc', this.ENCRYPTION_KEY, iv);

      res.setHeader('Content-Type', this.getMimeType(resource.type));
      res.setHeader('Content-Disposition', `inline; filename="${resource.filename}"`);

      input.pipe(decipher).pipe(res);
    });
  }
}