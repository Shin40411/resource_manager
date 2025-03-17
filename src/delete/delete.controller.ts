import { Controller, Query, Delete, UseGuards } from '@nestjs/common';
import { DeleteService } from './delete.service';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('delete')
@UseGuards(AuthGuard)
export class DeleteController {
  constructor(private readonly deleteService: DeleteService) { }

  @Delete()
  async deleteFile(@Query('filename') filename: string) {
    await this.deleteService.remove(filename);
    return { message: 'Xoá file thành công' };
  }
}