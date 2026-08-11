import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tablero, TableroSchema } from './schemas/tablero.schema';
import { TablerosRepository } from './tableros.repository';
import { TablerosService } from './tableros.service';
import { TablerosController } from './tableros.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tablero.name, schema: TableroSchema }]),
    UsersModule,
  ],
  controllers: [TablerosController],
  providers: [TablerosRepository, TablerosService],
  exports: [TablerosService, TablerosRepository],
})
export class TablerosModule {}
