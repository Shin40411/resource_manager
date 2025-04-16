import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { compressImage } from '../common/filters/image-processor';
import { Resource } from '@prisma/client';

@Injectable()
export class ResourcesService {
    private ENCRYPTION_KEY: Buffer;
    private IV_LENGTH = 16;

    constructor(private readonly prisma: PrismaService, private readonly configService: ConfigService) {
        const keyFromEnv = this.configService.get<string>('ENCRYPTION_KEY');
        if (!keyFromEnv || keyFromEnv.length !== 64) {
            throw new HttpException('ENCRYPTION_KEY không chính xác. Phải là 64 ký tự dạng hex.', HttpStatus.BAD_REQUEST);
        }

        this.ENCRYPTION_KEY = Buffer.from(keyFromEnv, 'hex');
    }

    private encryptFile(inputPath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(inputPath)) {
                return reject(new HttpException(`Không tìm thấy file: ${inputPath}`, HttpStatus.NOT_FOUND));
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

    async handleUpload(files: any[], userId: number, folderId?: string) {
        const filePaths = await Promise.all(
            files.map(async (file) => {
                let filePath = file.path;
                const rawName = file.originalname;
                const decodedName = Buffer.from(rawName, 'latin1').toString('utf8');

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
                    throw new HttpException('Tập tin không tồn tại', HttpStatus.NOT_FOUND);
                }

                await this.encryptFile(filePath, encryptedFilePath);
                fs.unlink(filePath, async (err) => {
                    if (err) {
                        const tempDir = path.join(path.dirname(filePath), 'temp', fileType);
                        if (!fs.existsSync(tempDir)) {
                            fs.mkdirSync(tempDir, { recursive: true });
                        }

                        const tempFilePath = path.join(tempDir, path.basename(filePath));

                        try {
                            await fs.promises.rename(filePath, tempFilePath);
                        } catch (renameErr) {
                            throw new HttpException('Đã xảy ra lỗi khi di chuyển tập tin vào thư mục tạm', HttpStatus.INTERNAL_SERVER_ERROR);
                        }
                    }
                });

                return await this.saveFileData(encryptedFileName, decodedName, encryptedFilePath.replace('uploads/', '/'), fileType, file.size, userId, folderId);
            })
        );
        return { files: filePaths };
    }

    async saveFileData(
        filename: string,
        originalFilename: string,
        path: string,
        type: 'IMAGE' | 'VIDEO' | 'FILE',
        size: number,
        userId: number,
        folderId?: string
    ) {
        try {
            return await this.prisma.resource.create({
                data: {
                    filename,
                    originalFilename,
                    path,
                    type,
                    size,
                    userId,
                    folderId,
                },
            });
        } catch (error) {
            console.error('Lỗi khi lưu vào database:', error);
            throw new HttpException('Đã có lỗi xảy ra', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getDecryptedFile(filename: string, res: Response) {
        const resource = await this.prisma.resource.findUnique({
            where: { filename },
        });

        if (!resource) {
            throw new HttpException('Không tìm thấy dữ liệu tập tin', HttpStatus.NOT_FOUND);
        }

        const encryptedFilePath = path.join(resource.path);
        if (!fs.existsSync(encryptedFilePath)) {
            throw new HttpException('Không tìm thấy dữ liệu tập tin', HttpStatus.NOT_FOUND);
        }

        const input = fs.createReadStream(encryptedFilePath);
        const iv = Buffer.alloc(this.IV_LENGTH);

        input.read(iv.length);
        input.once('readable', () => {
            const readBytes = input.read(iv.length);
            if (!readBytes) {
                throw new HttpException('Không thể đọc IV từ file', HttpStatus.BAD_REQUEST);
            }
            iv.set(readBytes);

            const decipher = crypto.createDecipheriv('aes-256-cbc', this.ENCRYPTION_KEY, iv);

            res.setHeader('Content-Type', this.getMimeType(resource.type));
            res.setHeader('Content-Disposition', `inline; filename="${resource.filename}"`);

            input.pipe(decipher).pipe(res);
        });
    }

    async removeFile(filename: string): Promise<void> {
        const folders = ['images', 'videos', 'files'];
        let deletedFiles: string[] = [];

        try {
            const file_existed = await this.prisma.resource.findFirst({
                where: {
                    filename: filename,
                },
            });

            if (!file_existed) {
                throw new HttpException('Tập tin không tồn tại', HttpStatus.NOT_FOUND);
            }

            for (const folder of folders) {
                if (file_existed?.filename) {
                    const potentialPath = path.join('uploads', folder, file_existed.filename);
                    if (fs.existsSync(potentialPath)) {
                        fs.unlinkSync(potentialPath);
                        deletedFiles.push(file_existed.filename);
                        break;
                    }
                }
            }

            await this.prisma.resource.delete({
                where: { filename }
            });

        } catch (error) {
            throw new HttpException('Đã có lỗi xảy ra', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getStatOnDb(typeOfFile: 'IMAGE' | 'VIDEO' | 'FILE') {
        const filesOnStat = await this.prisma.resource.findMany(
            {
                where: {
                    type: typeOfFile
                }
            }
        );

        if (filesOnStat.length > 0)
            return filesOnStat.length;

        return 0;
    }

    async getFileList(userId: string) {
        return this.prisma.resource.findMany({
            where: {
                userId: Number(userId),
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async editFileData(id: string, payload: { data: Partial<Resource> }) {
        try {
            if (!payload || !payload.data || Object.keys(payload.data).length === 0) {
                throw new HttpException('Dữ liệu cập nhật không hợp lệ', HttpStatus.BAD_REQUEST);
            }

            return await this.prisma.resource.update({
                where: { id },
                data: payload.data,
            });
        } catch (error) {
            console.error('Lỗi khi cập nhật dữ liệu tập tin:', error);
            throw new HttpException('Đã có lỗi xảy ra khi cập nhật dữ liệu tập tin', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getFolderList(userId: string) {
        const folders = await this.prisma.folder.findMany({
            where: {
                userId: Number(userId),
            },
            include: {
                resources: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        const folderList = await Promise.all(
            folders.map(async (folder) => {
                const resources = await this.prisma.resource.findMany({
                    where: { folderId: folder.id },
                });
                return {
                    ...folder,
                    resources,
                };
            })
        );

        return folderList;
    }

    async getFilesByFolder(folderId: string, userId: string) {
        return this.prisma.resource.findMany({
            where: {
                folderId,
                userId: Number(userId),
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async createFolder(folderName: string, userId: string) {
        try {
            const existingFolder = await this.prisma.folder.findFirst({
                where: {
                    name: folderName,
                    userId: Number(userId),
                },
            });
            if (existingFolder) {
                throw new HttpException('Thư mục đã tồn tại', HttpStatus.BAD_REQUEST);
            }
            const userIdNumber = Number(userId);

            return await this.prisma.folder.create({ data: { name: folderName, userId: userIdNumber } });
        } catch (error) {
            console.error('Lỗi khi tạo thư mục:', error);
            throw new HttpException('Đã có lỗi xảy ra khi tạo thư mục', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async editFolder(folderId: string, folderName: string) {
        try {
            return this.prisma.folder.update({ data: { name: folderName }, where: { id: folderId } });
        } catch (error) {
            console.error(error);
            throw new HttpException('Đã có lỗi xảy ra khi cập nhật thư mục', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async removeFolder(folderId: string) {
        const folder = await this.prisma.folder.findUnique({
            where: { id: folderId },
        });

        if (!folder) {
            throw new HttpException('Thư mục không tồn tại', HttpStatus.NOT_FOUND);
        }

        try {
            const filesExisting = await this.prisma.resource.findMany({
                where: { folderId },
            });

            if (filesExisting.length > 0) {
                filesExisting.forEach(async (file) => {
                    await this.removeFile(file.filename);
                });
            }

            return this.prisma.folder.delete({ where: { id: folderId } });
        } catch (error) {
            throw new HttpException('Đã có lỗi xảy ra', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    getStats() {
        return (folder: string) => fs.readdirSync(folder).length;
    }
}