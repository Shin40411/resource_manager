import { Body, Controller, Post } from '@nestjs/common';
import { LoginDto } from './dto/login.dto/login.dto';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto/register.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Post('registration')
    async registration(@Body() registerDto: RegisterDto) {
        return this.authService.registration(registerDto);
    }
}
