import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private configService: ConfigService) { }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpException('Bạn chưa đăng nhập', HttpStatus.UNAUTHORIZED);
    }

    const token = authHeader.split(' ')[1];
    const JWT_SECRET = this.configService.get<string>('API_KEY') || 'fallback_secret';

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      request.user = decoded;
      return true;
    } catch (error) {
      throw new HttpException('Token không hợp lệ hoặc đã hết hạn', HttpStatus.UNAUTHORIZED);
    }
  }
}