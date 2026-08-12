import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { NotasRepository } from './notas.repository';
import { TablerosService } from '../tableros/tableros.service';
import { UsersService } from '../users/users.service';
import { CreateNotaDto } from './dto/create-nota.dto';
import { UpdateNotaDto } from './dto/update-nota.dto';
import { ReactNotaDto, REACTION_TYPES } from './dto/react-nota.dto';

@Injectable()
export class NotasService {
  constructor(
    private readonly notasRepository: NotasRepository,
    private readonly tablerosService: TablerosService,
    private readonly usersService: UsersService,
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

    const tipoNota =
      tablero.categoria === 'personal' || tablero.categoria === 'grupo'
        ? 'estatico'
        : 'efimero';
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

    if (tablero.categoria === 'directa') {
      await this.tablerosService.bumpExpiresAt(boardId);
    }
    if (tablero.categoria !== 'personal') {
      await this.usersService.markWidgetBoardSeen(userId, boardId);
    }

    return this.notasRepository.toPublic(nota, userId);
  }

  async listByBoard(userId: string, boardId: string) {
    await this.tablerosService.getByIdForMember(boardId, userId);
    const notas = await this.notasRepository.findActiveByBoard(boardId);
    return notas.map((n) => this.notasRepository.toPublic(n, userId));
  }

  async update(userId: string, boardId: string, notaId: string, dto: UpdateNotaDto) {
    await this.tablerosService.getByIdForMember(boardId, userId);
    const nota = await this.notasRepository.findById(notaId);
    if (!nota || nota.boardId.toString() !== boardId || nota.deletedAt) {
      throw new NotFoundException('Nota no encontrada');
    }
    if (nota.authorId.toString() !== userId) {
      throw new ForbiddenException('Solo puedes editar tus propias notas');
    }
    if (nota.type !== 'text') {
      throw new BadRequestException('De momento solo se editan notas de texto');
    }

    const text = dto.text.trim();
    if (!text) throw new BadRequestException('El texto es obligatorio');

    const updated = await this.notasRepository.updateText(notaId, text);
    if (!updated) throw new NotFoundException('Nota no encontrada');
    return this.notasRepository.toPublic(updated, userId);
  }

  async softDelete(userId: string, boardId: string, notaId: string) {
    await this.tablerosService.getByIdForMember(boardId, userId);
    const nota = await this.notasRepository.findById(notaId);
    if (!nota || nota.boardId.toString() !== boardId || nota.deletedAt) {
      throw new NotFoundException('Nota no encontrada');
    }
    if (nota.authorId.toString() !== userId) {
      throw new ForbiddenException('Solo puedes borrar tus propias notas');
    }

    const updated = await this.notasRepository.softDelete(notaId);
    if (!updated) throw new NotFoundException('Nota no encontrada');
    return { ok: true };
  }

  async react(userId: string, boardId: string, notaId: string, dto: ReactNotaDto) {
    if (!REACTION_TYPES.includes(dto.type)) {
      throw new BadRequestException('Reacción no válida');
    }

    const tablero = await this.tablerosService.getByIdForMember(boardId, userId);
    if (tablero.categoria === 'personal') {
      throw new BadRequestException('No hay reacciones en el tablero personal');
    }

    const nota = await this.notasRepository.findById(notaId);
    if (!nota || nota.boardId.toString() !== boardId || nota.deletedAt) {
      throw new NotFoundException('Nota no encontrada');
    }

    const current =
      nota.reactions instanceof Map
        ? (nota.reactions.get(userId) ?? null)
        : ((nota.reactions as unknown as Record<string, string> | undefined)?.[userId] ??
          null);
    const next = current === dto.type ? null : dto.type;
    const updated = await this.notasRepository.setReaction(notaId, userId, next);
    if (!updated) throw new NotFoundException('Nota no encontrada');

    if (next) {
      const authorId = nota.authorId.toString();
      const author = await this.usersService.findById(authorId);
      const noteAuthorUsername = author?.username ?? 'Usuario';

      let boardName = tablero.nombre;
      if (tablero.categoria === 'directa') {
        const otherIds = tablero.miembros
          .map((id) => id.toString())
          .filter((id) => id !== userId);
        const others = await this.usersService.findByIds(otherIds);
        boardName = others.map((u) => u.username).join(' · ') || tablero.nombre;
      }

      const recipients = new Set<string>();
      if (authorId !== userId) recipients.add(authorId);
      if (tablero.categoria === 'grupo') {
        for (const mid of tablero.miembros) {
          const id = mid.toString();
          if (id !== userId) recipients.add(id);
        }
      }

      if (recipients.size) {
        void this.usersService.notifyReaction({
          recipientIds: [...recipients],
          fromUserId: userId,
          boardId,
          boardName,
          reaction: next,
          noteAuthorUsername,
        });
      }
    }

    return this.notasRepository.toPublic(updated, userId);
  }
}
