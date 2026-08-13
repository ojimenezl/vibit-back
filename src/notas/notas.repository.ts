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

  findActiveByBoardAsc(boardId: string): Promise<NotaDocument[]> {
    const now = new Date();
    return this.notaModel
      .find({
        boardId: new Types.ObjectId(boardId),
        deletedAt: null,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      })
      .sort({ createdAt: 1 })
      .exec();
  }

  findById(id: string): Promise<NotaDocument | null> {
    return this.notaModel.findById(id).exec();
  }

  softDelete(id: string): Promise<NotaDocument | null> {
    return this.notaModel
      .findByIdAndUpdate(
        id,
        { $set: { deletedAt: new Date() } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  deleteAllByBoard(boardId: string) {
    return this.notaModel.deleteMany({ boardId: new Types.ObjectId(boardId) }).exec();
  }

  updateText(id: string, text: string): Promise<NotaDocument | null> {
    return this.notaModel
      .findByIdAndUpdate(id, { $set: { text } }, { returnDocument: 'after' })
      .exec();
  }

  updateMedia(
    id: string,
    media: { url: string; mimeType: string; width: number | null; height: number | null }[],
  ): Promise<NotaDocument | null> {
    return this.notaModel
      .findByIdAndUpdate(
        id,
        { $set: { media, text: null } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  setReaction(
    id: string,
    userId: string,
    type: string | null,
  ): Promise<NotaDocument | null> {
    if (type === null) {
      return this.notaModel
        .findByIdAndUpdate(
          id,
          { $unset: { [`reactions.${userId}`]: '' } },
          { returnDocument: 'after' },
        )
        .exec();
    }
    return this.notaModel
      .findByIdAndUpdate(
        id,
        { $set: { [`reactions.${userId}`]: type } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  toPublic(nota: NotaDocument, viewerId?: string) {
    const reactions: Record<string, string> = {};
    const raw = nota.reactions as Map<string, string> | Record<string, string> | undefined;
    if (raw) {
      const entries =
        raw instanceof Map ? Array.from(raw.entries()) : Object.entries(raw);
      for (const [key, value] of entries) {
        if (typeof value === 'string') reactions[key] = value;
      }
    }

    const reactionCounts = { like: 0, heart: 0, laugh: 0, wow: 0 };
    for (const type of Object.values(reactions)) {
      if (type === 'like' || type === 'heart' || type === 'laugh' || type === 'wow') {
        reactionCounts[type] += 1;
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
      reactionCounts,
      myReaction: viewerId ? reactions[viewerId] ?? null : null,
      expiresAt: nota.expiresAt,
      createdAt: (nota as NotaDocument & { createdAt?: Date }).createdAt,
      updatedAt: (nota as NotaDocument & { updatedAt?: Date }).updatedAt,
    };
  }
}
