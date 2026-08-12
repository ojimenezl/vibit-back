import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TablerosService } from './tableros.service';
import { UpdateTableroDto } from './dto/update-tablero.dto';
import { ShareDirectaDto } from './dto/share-directa.dto';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../common/decorators/current-user.decorator';
import { NotasService } from '../notas/notas.service';

@Controller('tableros')
@UseGuards(AuthGuard('jwt'))
export class TablerosController {
  constructor(
    private readonly tablerosService: TablerosService,
    @Inject(forwardRef(() => NotasService))
    private readonly notasService: NotasService,
  ) {}

  @Get('personal')
  getPersonal(@CurrentUser() user: JwtPayloadUser) {
    return this.tablerosService.getPersonal(user.userId);
  }

  @Get('shared')
  listShared(@CurrentUser() user: JwtPayloadUser) {
    return this.tablerosService.listShared(user.userId);
  }

  @Post('directa/share')
  async shareDirecta(@CurrentUser() user: JwtPayloadUser, @Body() dto: ShareDirectaDto) {
    const created = await this.tablerosService.shareDirecta(user.userId, dto);
    const nota = await this.notasService.create(user.userId, created.tablero.id, {
      type: 'text',
      text: created.text,
    });
    return { tablero: created.tablero, nota };
  }

  @Post('grupo')
  async createGrupo(@CurrentUser() user: JwtPayloadUser, @Body() dto: CreateGrupoDto) {
    const created = await this.tablerosService.createGrupo(user.userId, dto);
    const nota = await this.notasService.create(user.userId, created.tablero.id, {
      type: 'text',
      text: created.text,
    });
    return { tablero: created.tablero, nota };
  }

  @Post(':id/leave')
  leave(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.tablerosService.leaveGrupo(user.userId, id);
  }

  @Get(':id')
  getOne(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.tablerosService.getPublicForMember(id, user.userId);
  }

  @Patch(':id')
  rename(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: UpdateTableroDto,
  ) {
    return this.tablerosService.rename(user.userId, id, dto.nombre);
  }
}
