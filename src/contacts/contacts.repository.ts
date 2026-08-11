import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class ContactsRepository {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByLinkUser(linkUser: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ linkUser }).exec();
  }

  findManyByIds(ids: Types.ObjectId[]): Promise<UserDocument[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.userModel.find({ _id: { $in: ids } }).exec();
  }

  async purgeExpiredNotifications(userId: string) {
    const now = new Date();
    await this.userModel
      .updateOne(
        { _id: userId },
        { $pull: { notificaciones: { expiresAt: { $lte: now } } } },
      )
      .exec();
  }

  addContactRequest(
    targetUserId: string,
    fromUserId: Types.ObjectId,
    expiresAt: Date,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        targetUserId,
        {
          $push: {
            notificaciones: {
              _id: new Types.ObjectId(),
              tipo: 'contacto',
              fromUserId,
              createdAt: new Date(),
              expiresAt,
            },
          },
        },
        { returnDocument: 'after' },
      )
      .exec();
  }

  addNotification(
    userId: string,
    tipo: 'contacto' | 'contacto_aceptado' | 'solicitud_enviada' | 'contacto_nuevo' | 'join_tablero',
    fromUserId: Types.ObjectId,
    expiresAt: Date,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $push: {
            notificaciones: {
              _id: new Types.ObjectId(),
              tipo,
              fromUserId,
              createdAt: new Date(),
              expiresAt,
            },
          },
        },
        { returnDocument: 'after' },
      )
      .exec();
  }

  addAcceptedNotification(
    userId: string,
    fromUserId: Types.ObjectId,
    expiresAt: Date,
  ): Promise<UserDocument | null> {
    return this.addNotification(userId, 'contacto_aceptado', fromUserId, expiresAt);
  }

  /** Quita avisos de "solicitud enviada" hacia un usuario concreto. */
  removeOutgoingRequestNotice(requesterId: string, targetUserId: string) {
    return this.userModel
      .updateOne(
        { _id: requesterId },
        {
          $pull: {
            notificaciones: {
              tipo: 'solicitud_enviada',
              fromUserId: new Types.ObjectId(targetUserId),
            },
          },
        },
      )
      .exec();
  }

  /** Repara notificaciones sin `_id` real en Mongo (lean, sin ids efímeros de Mongoose). */
  async ensureNotificationIds(userId: string): Promise<void> {
    const raw = await this.userModel.findById(userId).lean().exec();
    if (!raw?.notificaciones?.length) return;

    let changed = false;
    const notificaciones = raw.notificaciones.map((n) => {
      const row = n as { _id?: Types.ObjectId | string };
      if (row._id) return n;
      changed = true;
      return {
        ...n,
        _id: new Types.ObjectId(),
      };
    });

    if (changed) {
      await this.userModel.updateOne({ _id: userId }, { $set: { notificaciones } }).exec();
    }
  }

  findNotificationOnUser(
    user: UserDocument,
    notificationId: string,
  ): UserDocument['notificaciones'][number] | undefined {
    const target = String(notificationId);
    return user.notificaciones.find((n) => {
      const id = n?._id != null ? String(n._id) : '';
      return id === target;
    });
  }

  removeNotification(userId: string, notificationId: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $pull: { notificaciones: { _id: new Types.ObjectId(notificationId) } } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  addMutualContact(userAId: string, userBId: string) {
    const a = new Types.ObjectId(userAId);
    const b = new Types.ObjectId(userBId);
    return Promise.all([
      this.userModel
        .findByIdAndUpdate(userAId, { $addToSet: { contactos: b } }, { returnDocument: 'after' })
        .exec(),
      this.userModel
        .findByIdAndUpdate(userBId, { $addToSet: { contactos: a } }, { returnDocument: 'after' })
        .exec(),
    ]);
  }

  removeMutualContact(userAId: string, userBId: string) {
    const a = new Types.ObjectId(userAId);
    const b = new Types.ObjectId(userBId);
    return Promise.all([
      this.userModel
        .findByIdAndUpdate(userAId, { $pull: { contactos: b } }, { returnDocument: 'after' })
        .exec(),
      this.userModel
        .findByIdAndUpdate(userBId, { $pull: { contactos: a } }, { returnDocument: 'after' })
        .exec(),
    ]);
  }
}
