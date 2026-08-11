import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TablerosService } from './tableros.service';
import { UpdateTableroDto } from './dto/update-tablero.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../common/decorators/current-user.decorator';

@Controller('tableros')
@UseGuards(AuthGuard('jwt'))
export class TablerosController {
  constructor(private readonly tablerosService: TablerosService) {}

  @Get('personal')
  getPersonal(@CurrentUser() user: JwtPayloadUser) {
    return this.tablerosService.getPersonal(user.userId);
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
