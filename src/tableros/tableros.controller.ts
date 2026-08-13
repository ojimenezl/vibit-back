import {
  Body,
  Controller,
  Delete,
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
import { AddGrupoMiembrosDto } from './dto/add-grupo-miembros.dto';
import { TransferGrupoAdminDto } from './dto/transfer-grupo-admin.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../common/decorators/current-user.decorator';
import { NotasService } from '../notas/notas.service';
import { RealtimeService } from '../realtime/realtime.service';

@Controller('tableros')
@UseGuards(AuthGuard('jwt'))
export class TablerosController {
  constructor(
    private readonly tablerosService: TablerosService,
    @Inject(forwardRef(() => NotasService))
    private readonly notasService: NotasService,
    private readonly realtimeService: RealtimeService,
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
    const nota =
      created.type === 'draw'
        ? await this.notasService.create(user.userId, created.tablero.id, {
            type: 'draw',
            imageDataUrl: created.imageDataUrl ?? undefined,
          })
        : await this.notasService.create(user.userId, created.tablero.id, {
            type: 'text',
            text: created.text ?? undefined,
          });
    // Emit to all members including creator (other devices / same account).
    this.realtimeService.emitBoardCreated(created.tablero.miembros, created.tablero.id);
    return { tablero: created.tablero, nota };
  }

  @Post('grupo')
  async createGrupo(@CurrentUser() user: JwtPayloadUser, @Body() dto: CreateGrupoDto) {
    const created = await this.tablerosService.createGrupo(user.userId, dto);
    const nota =
      created.type === 'draw'
        ? await this.notasService.create(user.userId, created.tablero.id, {
            type: 'draw',
            imageDataUrl: created.imageDataUrl ?? undefined,
          })
        : await this.notasService.create(user.userId, created.tablero.id, {
            type: 'text',
            text: created.text ?? undefined,
          });
    // Emit to all members including creator (other devices / same account).
    this.realtimeService.emitBoardCreated(created.tablero.miembros, created.tablero.id);
    return { tablero: created.tablero, nota };
  }

  @Post(':id/leave')
  leave(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.tablerosService.leaveGrupo(user.userId, id);
  }

  @Post(':id/miembros')
  addMiembros(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: AddGrupoMiembrosDto,
  ) {
    return this.tablerosService.addGrupoMiembros(user.userId, id, dto.contactIds);
  }

  @Delete(':id/miembros/:memberId')
  removeMiembro(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.tablerosService.removeGrupoMiembro(user.userId, id, memberId);
  }

  @Patch(':id/admin')
  transferAdmin(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: TransferGrupoAdminDto,
  ) {
    return this.tablerosService.transferGrupoAdmin(user.userId, id, dto.memberId);
  }

  @Delete(':id')
  deleteBoard(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.tablerosService.deleteSharedBoard(user.userId, id);
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
