import { Controller, Param, Get, Post, UploadedFiles, UseInterceptors, UseGuards, NotFoundException, Res, InternalServerErrorException } from '@nestjs/common';
import { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { multerConfig } from './multer.config';
import { UploadsService } from './uploads.service';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('uploads')
@UseGuards(AuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) { }

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10, multerConfig))
  async uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    return this.uploadsService.handleUpload(files);
  }

  @Get('file/:filename')
  async getFile(@Param('filename') filename: string, @Res() res: Response) {
    try {
      return this.uploadsService.getDecryptedFile(filename, res);
    } catch (error) {
      throw new InternalServerErrorException('Không thể lấy file');
    }
  }
}