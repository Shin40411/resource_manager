import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { LoginDto } from './dto/login.dto/login.dto';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto/register.dto';

dotenv.config();
@Injectable()
export class AuthService {
    constructor(private readonly prisma: PrismaService) { }

    async login(loginDto: LoginDto) {
        const JWT_SECRECT = process.env.API_KEY || 'fallback_secret';
        const { email, password } = loginDto;
        const user = await this.prisma.user.findUnique({ where: { email } });

        if (!user) {
            return { statusCode: HttpStatus.NOT_FOUND, message: "Không tìm thấy thông tin người dùng" };
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return { statusCode: HttpStatus.UNAUTHORIZED, message: "Mật khẩu không chính xác" };
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRECT as jwt.Secret,
            { expiresIn: '3d' } as jwt.SignOptions
        );

        return {
            statusCode: HttpStatus.OK,
            message: "Đăng nhập thành công",
            accessToken: token,
            user
        };
    }

    async registration(signupDto: RegisterDto) {
        try {
            const { name, email, password } = signupDto;

            const existingUser = await this.prisma.user.findUnique({ where: { email } });
            if (existingUser)
                throw new HttpException('Thông tin người dùng đã tồn tại', HttpStatus.CONFLICT);

            const hashedPassword = await bcrypt.hash(password, 10);

            return this.prisma.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword
                },
            });
        } catch (error) {
            console.error(error);
            throw new HttpException('Đã có lỗi xảy ra', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findByUser(email: string) {
        const user = await this.prisma.user.findUnique({
            where: { email }
        })

        if (!user) throw new HttpException("Không tìm thấy thông tin người dùng", HttpStatus.UNAUTHORIZED);
        return user;
    }
}