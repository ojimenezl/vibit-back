import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Nota, NotaSchema } from './schemas/nota.schema';
import { NotasRepository } from './notas.repository';
import { NotasService } from './notas.service';
import { NotasController } from './notas.controller';
import { TablerosModule } from '../tableros/tableros.module';
import { UsersModule } from '../users/users.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Nota.name, schema: NotaSchema }]),
    forwardRef(() => TablerosModule),
    UsersModule,
    RealtimeModule,
  ],
  controllers: [NotasController],
  providers: [NotasRepository, NotasService],
  exports: [NotasService, NotasRepository],
})
export class NotasModule {}
