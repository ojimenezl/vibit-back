import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersRepository {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  create(data: Partial<User>): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByUserCode(userCode: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ userCode: userCode.toUpperCase() }).exec();
  }

  findByLinkUser(linkUser: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ linkUser }).exec();
  }

  findByIds(ids: string[]): Promise<UserDocument[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.userModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .exec();
  }

  addTablero(userId: string, tableroId: Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $addToSet: { idTableros: tableroId } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  removeTablero(userId: string, tableroId: Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $pull: { idTableros: tableroId } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  addNotification(
    userId: string,
    data: {
      tipo:
        | 'join_tablero'
        | 'contacto'
        | 'contacto_aceptado'
        | 'solicitud_enviada'
        | 'contacto_nuevo'
        | 'reaccion';
      fromUserId: Types.ObjectId;
      boardId?: Types.ObjectId | null;
      label?: string | null;
      reaction?: string | null;
      noteAuthorUsername?: string | null;
      expiresAt: Date;
    },
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $push: {
            notificaciones: {
              _id: new Types.ObjectId(),
              tipo: data.tipo,
              fromUserId: data.fromUserId,
              boardId: data.boardId ?? null,
              label: data.label ?? null,
              reaction: data.reaction ?? null,
              noteAuthorUsername: data.noteAuthorUsername ?? null,
              createdAt: new Date(),
              expiresAt: data.expiresAt,
            },
          },
        },
        { returnDocument: 'after' },
      )
      .exec();
  }

  /** Evita apilar muchas reacciones del mismo user en el mismo tablero. */
  clearReactionNotifications(
    userId: string,
    fromUserId: Types.ObjectId,
    boardId: Types.ObjectId,
  ) {
    return this.userModel
      .updateOne(
        { _id: userId },
        {
          $pull: {
            notificaciones: {
              tipo: 'reaccion',
              fromUserId,
              boardId,
            },
          },
        },
      )
      .exec();
  }

  updatePinHash(userId: string, pinHash: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(userId, { $set: { pinHash } }, { returnDocument: 'after' })
      .exec();
  }

  updateUsername(userId: string, username: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(userId, { $set: { username } }, { returnDocument: 'after' })
      .exec();
  }

  async markWidgetBoardSeen(userId: string, boardId: string, at = new Date()) {
    const oid = new Types.ObjectId(boardId);
    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: userId, 'widgetSeen.boardId': oid },
        { $set: { 'widgetSeen.$.lastSeenAt': at } },
        { returnDocument: 'after' },
      )
      .exec();

    if (updated) return updated;

    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $push: { widgetSeen: { boardId: oid, lastSeenAt: at } } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  toPublic(user: UserDocument) {
    return {
      id: user._id.toString(),
      username: user.username,
      userCode: user.userCode,
      linkUser: user.linkUser,
      idTableros: user.idTableros.map((id) => id.toString()),
      createdAt: (user as UserDocument & { createdAt?: Date }).createdAt,
    };
  }
}
