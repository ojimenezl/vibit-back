import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyPinDto } from './dto/verify-pin.dto';
import { ChangePinDto } from './dto/change-pin.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('verify-pin')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  verifyPin(@CurrentUser() user: JwtPayloadUser, @Body() dto: VerifyPinDto) {
    return this.authService.verifyPin(user.userId, dto.pin);
  }

  @Post('change-pin')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  changePin(@CurrentUser() user: JwtPayloadUser, @Body() dto: ChangePinDto) {
    return this.authService.changePin(user.userId, dto);
  }
}
