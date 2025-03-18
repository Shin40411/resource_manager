import { Module } from '@nestjs/common';
import { ResourcesController } from './resources.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ResourcesService } from './resources.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [ResourcesController],
  providers: [ResourcesService]
})
export class ResourcesModule {}
