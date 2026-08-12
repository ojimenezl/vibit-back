import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersRepository } from './users.repository';
import { UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

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

  addJoinTableroNotification(
    userId: string,
    fromUserId: Types.ObjectId,
    boardId: Types.ObjectId,
    label: string,
    expiresAt: Date,
  ) {
    return this.usersRepository.addNotification(userId, {
      tipo: 'join_tablero',
      fromUserId,
      boardId,
      label,
      expiresAt,
    });
  }

  findByIds(ids: string[]) {
    return this.usersRepository.findByIds(ids);
  }

  markWidgetBoardSeen(userId: string, boardId: string) {
    return this.usersRepository.markWidgetBoardSeen(userId, boardId);
  }

  toPublic(user: UserDocument) {
    return this.usersRepository.toPublic(user);
  }
}
