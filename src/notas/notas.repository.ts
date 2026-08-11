import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Nota, NotaDocument } from './schemas/nota.schema';

@Injectable()
export class NotasRepository {
  constructor(@InjectModel(Nota.name) private readonly notaModel: Model<NotaDocument>) {}

  create(data: Partial<Nota>): Promise<NotaDocument> {
    return this.notaModel.create(data);
  }

  findActiveByBoard(boardId: string): Promise<NotaDocument[]> {
    const now = new Date();
    return this.notaModel
      .find({
        boardId: new Types.ObjectId(boardId),
        deletedAt: null,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  toPublic(nota: NotaDocument) {
    const reactions: Record<string, string> = {};
    if (nota.reactions) {
      for (const [key, value] of nota.reactions.entries()) {
        reactions[key] = value;
      }
    }

    return {
      id: nota._id.toString(),
      authorId: nota.authorId.toString(),
      boardId: nota.boardId.toString(),
      type: nota.type,
      tipoNota: nota.tipoNota,
      text: nota.text,
      media: nota.media,
      reactions,
      expiresAt: nota.expiresAt,
      createdAt: (nota as NotaDocument & { createdAt?: Date }).createdAt,
      updatedAt: (nota as NotaDocument & { updatedAt?: Date }).updatedAt,
    };
  }
}
