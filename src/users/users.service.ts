import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersRepository } from './users.repository';
import { UserDocument } from './schemas/user.schema';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly realtimeService: RealtimeService,
  ) {}

  create(data: Partial<UserDocument>) {
    return this.usersRepository.create(data);
  }

  findByUserCode(userCode: string) {
    return this.usersRepository.findByUserCode(userCode);
  }

  findById(id: string) {
    return this.usersRepository.findById(id);
  }

  async getMe(userId: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.usersRepository.toPublic(user);
  }

  addTablero(userId: string, tableroId: Types.ObjectId) {
    return this.usersRepository.addTablero(userId, tableroId);
  }

  removeTablero(userId: string, tableroId: Types.ObjectId) {
    return this.usersRepository.removeTablero(userId, tableroId);
  }

  async addJoinTableroNotification(
    userId: string,
    fromUserId: Types.ObjectId,
    boardId: Types.ObjectId,
    label: string,
    expiresAt: Date,
  ) {
    await this.usersRepository.addNotification(userId, {
      tipo: 'join_tablero',
      fromUserId,
      boardId,
      label,
      expiresAt,
    });
    this.realtimeService.emitNotificationNew(userId);
  }

  async addDirectaNotaNotification(
    userId: string,
    fromUserId: Types.ObjectId,
    boardId: Types.ObjectId,
    expiresAt: Date,
  ) {
    await this.usersRepository.addNotification(userId, {
      tipo: 'nota_directa',
      fromUserId,
      boardId,
      label: null,
      expiresAt,
    });
    this.realtimeService.emitNotificationNew(userId);
  }

  async notifyReaction(data: {
    recipientIds: string[];
    fromUserId: string;
    boardId: string;
    boardName: string;
    reaction: string;
    noteAuthorUsername: string;
  }) {
    const fromOid = new Types.ObjectId(data.fromUserId);
    const boardOid = new Types.ObjectId(data.boardId);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const unique = [...new Set(data.recipientIds)].filter((id) => id !== data.fromUserId);

    await Promise.all(
      unique.map(async (recipientId) => {
        await this.usersRepository.clearReactionNotifications(recipientId, fromOid, boardOid);
        await this.usersRepository.addNotification(recipientId, {
          tipo: 'reaccion',
          fromUserId: fromOid,
          boardId: boardOid,
          label: data.boardName,
          reaction: data.reaction,
          noteAuthorUsername: data.noteAuthorUsername,
          expiresAt,
        });
        this.realtimeService.emitNotificationNew(recipientId);
      }),
    );
  }

  findByIds(ids: string[]) {
    return this.usersRepository.findByIds(ids);
  }

  markWidgetBoardSeen(userId: string, boardId: string, at = new Date()) {
    return this.usersRepository.markWidgetBoardSeen(userId, boardId, at);
  }

  updatePinHash(userId: string, pinHash: string) {
    return this.usersRepository.updatePinHash(userId, pinHash);
  }

  async updateUsername(userId: string, username: string) {
    const trimmed = username.trim();
    if (trimmed.length < 2 || trimmed.length > 32) {
      throw new BadRequestException('El nombre debe tener entre 2 y 32 caracteres');
    }
    const user = await this.usersRepository.updateUsername(userId, trimmed);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.usersRepository.toPublic(user);
  }

  toPublic(user: UserDocument) {
    return this.usersRepository.toPublic(user);
  }
}
