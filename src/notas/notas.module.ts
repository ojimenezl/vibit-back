import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Nota, NotaSchema } from './schemas/nota.schema';
import { NotasRepository } from './notas.repository';
import { NotasService } from './notas.service';
import { NotasController } from './notas.controller';
import { TablerosModule } from '../tableros/tableros.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Nota.name, schema: NotaSchema }]),
    TablerosModule,
  ],
  controllers: [NotasController],
  providers: [NotasRepository, NotasService],
  exports: [NotasService],
})
export class NotasModule {}
