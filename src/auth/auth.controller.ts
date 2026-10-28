import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() data: RegisterDto) {
    return this.authService.register(data);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() data: LoginDto){
      return this.authService.login(data)
  }



  @Post('refresh')
refresh(@Body() data: RefreshTokenDto) {
  return this.authService.refresh(data);
}



 @Post('logout')
  logout(@Body() data: RefreshTokenDto) {
    return this.authService.logout(data);
  }

  
};