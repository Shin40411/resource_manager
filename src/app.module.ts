import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ResourcesModule } from './resources/resources.module';

@Module({
  imports: [AuthModule, PrismaModule, ConfigModule.forRoot(), ResourcesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
