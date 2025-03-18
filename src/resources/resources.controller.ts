import { Controller, Param, Get, Post, Delete, Query, UploadedFiles, UseInterceptors, UseGuards, Res, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { ResourcesService } from './resources.service';
import { multerConfig } from '../common/filters/multer.config';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

@Controller('resources')
@UseGuards(AuthGuard)
export class ResourcesController {
    constructor(private readonly resourceService: ResourcesService) { }

    @Post('uploads')
    @UseInterceptors(FilesInterceptor('files', 10, multerConfig))
    async uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
        return this.resourceService.handleUpload(files);
    }

    @Get('file/:filename')
    async getFile(@Param('filename') filename: string, @Res() res: Response) {
        try {
            return this.resourceService.getDecryptedFile(filename, res);
        } catch (error) {
            throw new HttpException('message', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('stats')
    getStats() {
        const countFiles = this.resourceService.getStats();
        return {
            'Images': countFiles('uploads/images'),
            'Videos': countFiles('uploads/videos'),
            'OtherFiles': countFiles('uploads/files'),
        };
    }

    @Delete('delete')
    async deleteFile(@Query('filename') filename: string) {
        return await this.resourceService.removeFile(filename);
    }
}

