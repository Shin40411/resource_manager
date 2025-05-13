import { Controller, Param, Get, Post, Put, Delete, Query, UploadedFiles, UseInterceptors, UseGuards, Res, HttpException, HttpStatus, Body, Req } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { ResourcesService } from './resources.service';
import { multerConfig } from '../common/filters/multer.config';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthService } from 'src/auth/auth.service';
import { extname, join } from 'path';
import { existsSync } from 'fs';

@Controller('resources')
@UseGuards(AuthGuard)
export class ResourcesController {
    constructor(private readonly resourceService: ResourcesService, private readonly authService: AuthService) { }
    // POST
    @Post('uploads')
    @UseInterceptors(FilesInterceptor('files', 10, multerConfig))
    async uploadFiles(
        @UploadedFiles() files: Express.Multer.File[],
        @Body('userId') userId: string,
        @Body('folderId') folderId?: string
    ) {
        const numericUserId = Number(userId);
        if (isNaN(numericUserId)) {
            throw new HttpException('Invalid userId', HttpStatus.BAD_REQUEST);
        }
        return this.resourceService.handleUpload(files, numericUserId, folderId);
    }

    @Post('folder')
    async createFolder(@Body('name') name: string, @Body('userId') userId: string) {
        return this.resourceService.createFolder(name, userId);
    }

    @Post('filePath')
    async getFilePath(@Body('path') path: string, @Res() res: Response) {
        if (!path) {
            return res.status(400).json({ message: 'Không tìm thấy path' });
        }

        const safePath = path.replace(/\\/g, '/');
        if (!existsSync(join(__dirname, '..', '..', safePath))) {
            return res.status(404).json({ message: 'Không tìm thấy file' });
        }

        const fileUrl = `${process.env.SERVER_URL}/${safePath}`;
        return res.json({ url: fileUrl });
    }

    @Post('file')
    async getFile(@Body('filepath') filepath: string, @Res() res: Response) {
        try {
            if (!filepath) {
                throw new HttpException('File path không hợp lệ', HttpStatus.BAD_REQUEST);
            }

            return this.resourceService.getFileByName(filepath, res);
        } catch (error) {
            console.error(error);
            throw new HttpException('Failed to get file', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    //PUT
    @Put('folder')
    async renameFolder(@Body('idFolder') idFolder: string, @Body('newName') newName: string) {
        return this.resourceService.editFolder(idFolder, newName);
    }

    @Put('file')
    async updateFile(@Body('idFile') idFile: string, @Body('dataPush') dataPush: any) {
        return this.resourceService.editFileData(idFile, dataPush);
    }

    // GET
    @Get(':userId/files')
    async getFiles(@Param('userId') userId: string, @Res() res: Response) {
        const files = await this.resourceService.getFileList(userId);
        return res.status(200).json({ files });
    }

    @Get(':userId/folder/:folderId/files')
    async getFilesByFolder(@Param('folderId') folderId: string, @Param('userId') userId: string, @Res() res: Response) {
        const files = await this.resourceService.getFilesByFolder(folderId, userId);
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

    @Get('stats/:type/:userId')
    async getStatBy(@Param('type') type: string, @Param('userId') userId: string) {
        const validTypes = ['IMAGE', 'VIDEO', 'FILE'] as const;
        if (!validTypes.includes(type as any)) {
            throw new HttpException('Invalid type parameter', HttpStatus.BAD_REQUEST);
        }
        const countFiles = await this.resourceService.getStatOnDb(type as 'IMAGE' | 'VIDEO' | 'FILE', userId);
        return { count: countFiles };
    }

    @Get('me')
    async find(@Body('email') email: string) {
        return this.authService.findByUser(email);
    }

    @Get(':userId/folder')
    async getFolders(@Param('userId') userId: string) {
        return this.resourceService.getFolderList(userId);
    }

    // DELETE
    @Delete('delete')
    async deleteFile(@Query('filename') filename: string) {
        return await this.resourceService.removeFile(filename);
    }

    @Delete('folder')
    async deleteFolder(@Query('id') idFolder: string) {
        return await this.resourceService.removeFolder(idFolder);
    }
}

