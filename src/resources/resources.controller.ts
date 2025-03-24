import { Controller, Param, Get, Post, Delete, Query, UploadedFiles, UseInterceptors, UseGuards, Res, HttpException, HttpStatus, Body } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { ResourcesService } from './resources.service';
import { multerConfig } from '../common/filters/multer.config';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthService } from 'src/auth/auth.service';

@Controller('resources')
@UseGuards(AuthGuard)
export class ResourcesController {
    constructor(private readonly resourceService: ResourcesService, private readonly authService: AuthService) { }

    @Post('uploads')
    @UseInterceptors(FilesInterceptor('files', 10, multerConfig))
    async uploadFiles(@UploadedFiles() files: Express.Multer.File[], @Body('userId') userId: string) {
        const numericUserId = Number(userId);
        if (isNaN(numericUserId)) {
            throw new HttpException('Invalid userId', HttpStatus.BAD_REQUEST);
        }
        return this.resourceService.handleUpload(files, numericUserId);
    }

    @Get('file/:filename')
    async getFile(@Param('filename') filename: string, @Res() res: Response) {
        try {
            return this.resourceService.getDecryptedFile(filename, res);
        } catch (error) {
            throw new HttpException('Failed to get file', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('files')
    async getFiles(@Res() res: Response) {
        const files = await this.resourceService.getFileList();
        return res.status(200).json({ files });
    }

    @Get('stats')
    getStats() {
        const countFiles = this.resourceService.getStats();
        return {
            'Images': countFiles('uploads/images'),
            'Videos': countFiles('uploads/videos'),
            'OtherFiles': countFiles('uploads/files'),
        };
    }

    @Get('stats/:type')
    async getStatBy(@Param('type') type: string) {
        const validTypes = ['IMAGE', 'VIDEO', 'FILE'] as const;
        if (!validTypes.includes(type as any)) {
            throw new HttpException('Invalid type parameter', HttpStatus.BAD_REQUEST);
        }
        const countFiles = await this.resourceService.getStatOnDb(type as 'IMAGE' | 'VIDEO' | 'FILE');
        return { count: countFiles };
    }

    @Delete('delete')
    async deleteFile(@Query('filename') filename: string) {
        return await this.resourceService.removeFile(filename);
    }

    @Get('me')
    async find(@Body('email') email: string) {
        return this.authService.findByUser(email);
    }
}

