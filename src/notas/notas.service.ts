import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { NotasRepository } from './notas.repository';
import { TablerosService } from '../tableros/tableros.service';
import { CreateNotaDto } from './dto/create-nota.dto';

@Injectable()
export class NotasService {
  constructor(
    private readonly notasRepository: NotasRepository,
    private readonly tablerosService: TablerosService,
  ) {}

  async create(userId: string, boardId: string, dto: CreateNotaDto) {
    const tablero = await this.tablerosService.getByIdForMember(boardId, userId);

    if (dto.type !== 'text') {
      throw new BadRequestException('De momento solo se admiten notas de texto');
    }

    const text = dto.text?.trim();
    if (!text) {
      throw new BadRequestException('El texto es obligatorio');
    }

    const tipoNota = tablero.categoria === 'personal' ? 'estatico' : 'efimero';
    const expiresAt =
      tipoNota === 'efimero' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

    const nota = await this.notasRepository.create({
      authorId: new Types.ObjectId(userId),
      boardId: new Types.ObjectId(boardId),
      type: 'text',
      tipoNota,
      text,
      media: [],
      reactions: new Map(),
      expiresAt,
      deletedAt: null,
    });

    return this.notasRepository.toPublic(nota);
  }

  async listByBoard(userId: string, boardId: string) {
    await this.tablerosService.getByIdForMember(boardId, userId);
    const notas = await this.notasRepository.findActiveByBoard(boardId);
    return notas.map((n) => this.notasRepository.toPublic(n));
  }
}
