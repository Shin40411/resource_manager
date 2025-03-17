import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DeleteService {
  constructor(private readonly prisma: PrismaService) { }

  async remove(filename: string): Promise<void> {
    const folders = ['images', 'videos', 'files'];
    let deletedFiles: string[] = [];

    try {
      const file_existed = await this.prisma.resource.findFirst({
        where: {
          filename: filename,
        },
      });

      if (!file_existed) {
        throw new HttpException('Không tìm thấy file để xoá', HttpStatus.NOT_FOUND);
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
      })

    } catch (error) {
      throw new HttpException('Xoá file thất bại, lỗi DB hoặc hệ thống', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}