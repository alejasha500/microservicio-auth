import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() data: RegisterDto) {
    return this.authService.register(data);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() data: LoginDto) {
    return this.authService.login(data);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() data: RefreshTokenDto) {
    return this.authService.refresh(data);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Body() data: RefreshTokenDto) {
    return this.authService.logout(data);
  }
}