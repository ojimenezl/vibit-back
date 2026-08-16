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
import { RealtimeService } from '../realtime/realtime.service';
import { PushService } from '../push/push.service';

function mediaFromDataUrl(imageDataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,/i.exec(imageDataUrl);
  if (!match) {
    throw new BadRequestException('Imagen de dibujo no válida');
  }
  let mimeType = match[1].toLowerCase();
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
  return {
    url: imageDataUrl,
    mimeType,
    width: null as number | null,
    height: null as number | null,
  };
}

@Injectable()
export class NotasService {
  constructor(
    private readonly notasRepository: NotasRepository,
    private readonly tablerosService: TablerosService,
    private readonly usersService: UsersService,
    private readonly realtimeService: RealtimeService,
    private readonly pushService: PushService,
  ) {}

  async create(userId: string, boardId: string, dto: CreateNotaDto) {
    const tablero = await this.tablerosService.getByIdForMember(boardId, userId);

    if (dto.type === 'photo') {
      throw new BadRequestException('Las notas de foto llegarán pronto');
    }

    const tipoNota =
      tablero.categoria === 'personal' || tablero.categoria === 'grupo'
        ? 'estatico'
        : 'efimero';
    const expiresAt =
      tipoNota === 'efimero' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

    let text: string | null = null;
    let media: ReturnType<typeof mediaFromDataUrl>[] = [];
    let type: 'text' | 'draw' = 'text';

    if (dto.type === 'draw') {
      if (!dto.imageDataUrl?.trim()) {
        throw new BadRequestException('El dibujo es obligatorio');
      }
      type = 'draw';
      media = [mediaFromDataUrl(dto.imageDataUrl.trim())];
    } else {
      const trimmed = dto.text?.trim();
      if (!trimmed) {
        throw new BadRequestException('El texto es obligatorio');
      }
      type = 'text';
      text = trimmed;
    }

    const memberIds = tablero.miembros.map((id) => id.toString());
    let recipientIds: Types.ObjectId[] = [];
    if (tablero.categoria === 'directa') {
      const adminId = tablero.adminUserId.toString();
      const isAdmin = adminId === userId;

      if (isAdmin) {
        const memberSet = new Set(memberIds);
        const unique = [...new Set((dto.recipientIds ?? []).map((id) => id.trim()))].filter(
          (id) => id && id !== userId && memberSet.has(id),
        );
        if (!unique.length) {
          throw new BadRequestException(
            'Elige al menos un destinatario de este tablero',
          );
        }
        recipientIds = unique.map((id) => new Types.ObjectId(id));
      } else {
        // Miembros no admin: siempre solo al creador/admin del efímero.
        if (!memberIds.includes(adminId) || adminId === userId) {
          throw new BadRequestException('No hay admin al que enviar la nota');
        }
        recipientIds = [new Types.ObjectId(adminId)];
      }
    }

    const nota = await this.notasRepository.create({
      authorId: new Types.ObjectId(userId),
      boardId: new Types.ObjectId(boardId),
      type,
      tipoNota,
      text,
      media,
      reactions: new Map(),
      recipientIds,
      expiresAt,
      deletedAt: null,
    });

    if (tablero.categoria === 'directa') {
      await this.tablerosService.bumpExpiresAt(boardId);
    }
    if (tablero.categoria !== 'personal') {
      await this.usersService.markWidgetBoardSeen(userId, boardId);
    }

    const publicNota = this.notasRepository.toPublic(nota, userId, tablero.categoria);
    const audience = NotasRepository.audienceUserIds(
      nota,
      memberIds,
      tablero.categoria,
    );

    if (tablero.categoria !== 'personal') {
      this.realtimeService.emitNoteCreated(
        audience,
        boardId,
        publicNota,
        userId,
      );
    }

    void this.pushService.notifyWidgetSync(audience);

    return publicNota;
  }

  async listByBoard(userId: string, boardId: string) {
    const tablero = await this.tablerosService.getByIdForMember(boardId, userId);
    const notas = await this.notasRepository.findActiveByBoard(boardId);
    return notas
      .filter((n) =>
        NotasRepository.isVisibleToUser(n, userId, tablero.categoria),
      )
      .map((n) => this.notasRepository.toPublic(n, userId, tablero.categoria));
  }

  async update(userId: string, boardId: string, notaId: string, dto: UpdateNotaDto) {
    const tablero = await this.tablerosService.getByIdForMember(boardId, userId);
    const nota = await this.notasRepository.findById(notaId);
    if (!nota || nota.boardId.toString() !== boardId || nota.deletedAt) {
      throw new NotFoundException('Nota no encontrada');
    }
    if (nota.authorId.toString() !== userId) {
      throw new ForbiddenException('Solo puedes editar tus propias notas');
    }

    let publicNota;

    if (nota.type === 'text') {
      const text = dto.text?.trim();
      if (!text) throw new BadRequestException('El texto es obligatorio');
      const updated = await this.notasRepository.updateText(notaId, text);
      if (!updated) throw new NotFoundException('Nota no encontrada');
      publicNota = this.notasRepository.toPublic(updated, userId, tablero.categoria);
    } else if (nota.type === 'draw') {
      const imageDataUrl = dto.imageDataUrl?.trim();
      if (!imageDataUrl) throw new BadRequestException('El dibujo es obligatorio');
      const updated = await this.notasRepository.updateMedia(notaId, [
        mediaFromDataUrl(imageDataUrl),
      ]);
      if (!updated) throw new NotFoundException('Nota no encontrada');
      publicNota = this.notasRepository.toPublic(updated, userId, tablero.categoria);
    } else {
      throw new BadRequestException('Este tipo de nota no se puede editar aún');
    }

    if (tablero.categoria === 'directa') {
      await this.tablerosService.bumpExpiresAt(boardId);
    }

    const audience = NotasRepository.audienceUserIds(
      nota,
      tablero.miembros.map((id) => id.toString()),
      tablero.categoria,
    );
    void this.pushService.notifyWidgetSync(audience);

    return publicNota;
  }

  async softDelete(userId: string, boardId: string, notaId: string) {
    const tablero = await this.tablerosService.getByIdForMember(boardId, userId);
    const nota = await this.notasRepository.findById(notaId);
    if (!nota || nota.boardId.toString() !== boardId || nota.deletedAt) {
      throw new NotFoundException('Nota no encontrada');
    }
    if (nota.authorId.toString() !== userId) {
      throw new ForbiddenException('Solo puedes borrar tus propias notas');
    }

    const updated = await this.notasRepository.softDelete(notaId);
    if (!updated) throw new NotFoundException('Nota no encontrada');

    const audience = NotasRepository.audienceUserIds(
      nota,
      tablero.miembros.map((id) => id.toString()),
      tablero.categoria,
    );
    void this.pushService.notifyWidgetSync(audience);

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
    if (!NotasRepository.isVisibleToUser(nota, userId, tablero.categoria)) {
      throw new ForbiddenException('No puedes reaccionar a esta nota');
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

    const publicNota = this.notasRepository.toPublic(
      updated,
      userId,
      tablero.categoria,
    );
    const audience = NotasRepository.audienceUserIds(
      nota,
      tablero.miembros.map((id) => id.toString()),
      tablero.categoria,
    );

    // Conteos personalizados por destinatario (efímero ≠ grupo).
    const fullPublic = this.notasRepository.toPublic(
      updated,
      nota.authorId.toString(),
      tablero.categoria,
    );
    for (const uid of audience) {
      if (uid === userId) continue;
      const counts =
        uid === nota.authorId.toString()
          ? fullPublic.reactionCounts
          : this.notasRepository.toPublic(updated, uid, tablero.categoria)
              .reactionCounts;
      this.realtimeService.emitReactionUpdated(
        [uid],
        boardId,
        notaId,
        userId,
        next,
        counts,
      );
    }

    void this.pushService.notifyWidgetSync(audience);

    return publicNota;
  }
}
