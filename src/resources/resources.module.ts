import { Module } from '@nestjs/common';
import { ResourcesController } from './resources.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ResourcesService } from './resources.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, ConfigModule, AuthModule],
  controllers: [ResourcesController],
  providers: [ResourcesService]
})
export class ResourcesModule {}
