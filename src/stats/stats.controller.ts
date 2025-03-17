import { Controller, Post, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('stats')
@UseGuards(AuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) { }

  @Post()
  getStats() {
    const countFiles = this.statsService.getStats();
    return {
      'Hình ảnh': countFiles('uploads/images'),
      'Video': countFiles('uploads/videos'),
      'Tập tin khác': countFiles('uploads/files'),
    };
  }
}