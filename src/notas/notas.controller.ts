import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotasService } from './notas.service';
import { CreateNotaDto } from './dto/create-nota.dto';
import { UpdateNotaDto } from './dto/update-nota.dto';
import { ReactNotaDto } from './dto/react-nota.dto';
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

  @Post(':notaId/react')
  react(
    @CurrentUser() user: JwtPayloadUser,
    @Param('tableroId') tableroId: string,
    @Param('notaId') notaId: string,
    @Body() dto: ReactNotaDto,
  ) {
    return this.notasService.react(user.userId, tableroId, notaId, dto);
  }

  @Patch(':notaId')
  update(
    @CurrentUser() user: JwtPayloadUser,
    @Param('tableroId') tableroId: string,
    @Param('notaId') notaId: string,
    @Body() dto: UpdateNotaDto,
  ) {
    return this.notasService.update(user.userId, tableroId, notaId, dto);
  }

  @Delete(':notaId')
  remove(
    @CurrentUser() user: JwtPayloadUser,
    @Param('tableroId') tableroId: string,
    @Param('notaId') notaId: string,
  ) {
    return this.notasService.softDelete(user.userId, tableroId, notaId);
  }
}
