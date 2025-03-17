import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}