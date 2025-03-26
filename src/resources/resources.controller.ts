import { Controller, Param, Get, Post, Put, Delete, Query, UploadedFiles, UseInterceptors, UseGuards, Res, HttpException, HttpStatus, Body } from '@nestjs/common';
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
    async createFolder(@Body('name') name: string) {
        return this.resourceService.createFolder(name);
    }

    //PUT
    @Put('folder')
    async renameFolder(@Body('idFolder') idFolder: string, @Body('newName') newName: string) {
        console.log('id:' + idFolder);
        console.log('newname:' + newName);
        return this.resourceService.editFolder(idFolder, newName);
    }

    @Put('file')
    async updateFile(@Body('idFile') idFile: string, @Body('dataPush') dataPush: any) {
        return this.resourceService.editFileData(idFile, dataPush);
    }

    // GET
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

    @Get('me')
    async find(@Body('email') email: string) {
        return this.authService.findByUser(email);
    }

    @Get('folder')
    async getFolders() {
        return this.resourceService.getFolderList();
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

