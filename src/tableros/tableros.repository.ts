import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tablero, TableroDocument } from './schemas/tablero.schema';

@Injectable()
export class TablerosRepository {
  constructor(
    @InjectModel(Tablero.name) private readonly tableroModel: Model<TableroDocument>,
  ) {}

  create(data: Partial<Tablero>): Promise<TableroDocument> {
    return this.tableroModel.create(data);
  }

  findById(id: string): Promise<TableroDocument | null> {
    return this.tableroModel.findById(id).exec();
  }

  findPersonalByUser(userId: string): Promise<TableroDocument | null> {
    return this.tableroModel
      .findOne({
        categoria: 'personal',
        adminUserId: new Types.ObjectId(userId),
      })
      .exec();
  }

  findSharedForUser(userId: string): Promise<TableroDocument[]> {
    const now = new Date();
    return this.tableroModel
      .find({
        miembros: new Types.ObjectId(userId),
        categoria: { $in: ['directa', 'grupo'] },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      })
      .sort({ updatedAt: -1 })
      .exec();
  }

  findActiveForUser(userId: string): Promise<TableroDocument[]> {
    const now = new Date();
    return this.tableroModel
      .find({
        miembros: new Types.ObjectId(userId),
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      })
      .exec();
  }

  updateNombre(id: string, nombre: string): Promise<TableroDocument | null> {
    return this.tableroModel
      .findByIdAndUpdate(id, { $set: { nombre } }, { returnDocument: 'after' })
      .exec();
  }

  touchExpiresAt(id: string, expiresAt: Date): Promise<TableroDocument | null> {
    return this.tableroModel
      .findByIdAndUpdate(id, { $set: { expiresAt } }, { returnDocument: 'after' })
      .exec();
  }

  addMiembro(tableroId: Types.ObjectId | string, userId: Types.ObjectId) {
    return this.tableroModel
      .findByIdAndUpdate(
        tableroId,
        { $addToSet: { miembros: userId } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  toPublic(tablero: TableroDocument) {
    return {
      id: tablero._id.toString(),
      nombre: tablero.nombre,
      tipoTablero: tablero.tipoTablero,
      categoria: tablero.categoria,
      adminUserId: tablero.adminUserId.toString(),
      inviteCode: tablero.inviteCode,
      miembros: tablero.miembros.map((id) => id.toString()),
      expiresAt: tablero.expiresAt,
      createdAt: (tablero as TableroDocument & { createdAt?: Date }).createdAt,
      updatedAt: (tablero as TableroDocument & { updatedAt?: Date }).updatedAt,
    };
  }
}
