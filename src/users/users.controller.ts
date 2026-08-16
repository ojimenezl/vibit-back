import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../common/decorators/current-user.decorator';
import { UpdateUsernameDto } from './dto/update-username.dto';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  me(@CurrentUser() user: JwtPayloadUser) {
    return this.usersService.getMe(user.userId);
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  updateMe(@CurrentUser() user: JwtPayloadUser, @Body() dto: UpdateUsernameDto) {
    return this.usersService.updateUsername(user.userId, dto.username);
  }

  @Post('me/fcm-token')
  @UseGuards(AuthGuard('jwt'))
  registerFcm(@CurrentUser() user: JwtPayloadUser, @Body() dto: RegisterFcmTokenDto) {
    return this.usersService.registerFcmToken(user.userId, dto.token);
  }

  @Delete('me/fcm-token')
  @UseGuards(AuthGuard('jwt'))
  unregisterFcm(@Body() dto: RegisterFcmTokenDto) {
    return this.usersService.unregisterFcmToken(dto.token);
  }
}
