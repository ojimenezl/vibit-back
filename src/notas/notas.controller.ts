import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotasService } from './notas.service';
import { CreateNotaDto } from './dto/create-nota.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../common/decorators/current-user.decorator';

@Controller('tableros/:tableroId/notas')
@UseGuards(AuthGuard('jwt'))
export class NotasController {
  constructor(private readonly notasService: NotasService) {}

  @Get()
  list(@CurrentUser() user: JwtPayloadUser, @Param('tableroId') tableroId: string) {
    return this.notasService.listByBoard(user.userId, tableroId);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Param('tableroId') tableroId: string,
    @Body() dto: CreateNotaDto,
  ) {
    return this.notasService.create(user.userId, tableroId, dto);
  }
}
