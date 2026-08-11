import { Module } from '@nestjs/common';
import { WidgetService } from './widget.service';
import { WidgetController } from './widget.controller';
import { TablerosModule } from '../tableros/tableros.module';
import { NotasModule } from '../notas/notas.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TablerosModule, NotasModule, UsersModule],
  controllers: [WidgetController],
  providers: [WidgetService],
})
export class WidgetModule {}
