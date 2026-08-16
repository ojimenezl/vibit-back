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

  /** Visible para el usuario: autor, o destinatario en efímero, o todos si no es efímero / legacy. */
  static isVisibleToUser(
    nota: {
      authorId: Types.ObjectId | string;
      recipientIds?: Types.ObjectId[] | string[] | null;
      tipoNota?: string;
    },
    userId: string,
    boardCategoria: string,
  ): boolean {
    if (boardCategoria !== 'directa') return true;
    if (nota.authorId.toString() === userId) return true;
    const recipients = nota.recipientIds ?? [];
    // Notas antiguas sin destinatarios: se mantienen visibles a todo el tablero.
    if (!recipients.length) return true;
    return recipients.some((id) => id.toString() === userId);
  }

  static audienceUserIds(
    nota: {
      authorId: Types.ObjectId | string;
      recipientIds?: Types.ObjectId[] | string[] | null;
    },
    boardMemberIds: string[],
    boardCategoria: string,
  ): string[] {
    if (boardCategoria !== 'directa') return boardMemberIds;
    const recipients = (nota.recipientIds ?? []).map((id) => id.toString());
    if (!recipients.length) return boardMemberIds;
    return [...new Set([nota.authorId.toString(), ...recipients])];
  }

  /**
   * Última nota activa por tablero (preview Home).
   * En tableros efímeros (`privadaBoardIds`) solo cuentan notas visibles para `userId`.
   */
  async findLatestByBoardIds(
    boardIds: string[],
    viewer?: { userId: string; privadaBoardIds: string[] },
  ): Promise<
    Array<{
      boardId: string;
      type: 'text' | 'draw' | 'photo';
      text: string | null;
      createdAt?: Date;
      updatedAt?: Date;
      activityAt: Date;
    }>
  > {
    if (!boardIds.length) return [];
    const now = new Date();
    const oids = boardIds
      .filter(Boolean)
      .map((id) => new Types.ObjectId(id));
    if (!oids.length) return [];

    const match: Record<string, unknown> = {
      boardId: { $in: oids },
      deletedAt: null,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    };

    if (viewer?.userId && viewer.privadaBoardIds?.length) {
      const privadaOids = viewer.privadaBoardIds
        .filter(Boolean)
        .map((id) => new Types.ObjectId(id));
      const userOid = new Types.ObjectId(viewer.userId);
      match.$and = [
        {
          $or: [
            { boardId: { $nin: privadaOids } },
            { authorId: userOid },
            { recipientIds: userOid },
            { recipientIds: { $exists: false } },
            { recipientIds: { $size: 0 } },
          ],
        },
      ];
    }

    const rows = await this.notaModel
      .aggregate<{
        _id: Types.ObjectId;
        type: 'text' | 'draw' | 'photo';
        text: string | null;
        createdAt?: Date;
        updatedAt?: Date;
        activityAt: Date;
      }>([
        { $match: match },
        {
          $addFields: {
            activityAt: { $ifNull: ['$updatedAt', '$createdAt'] },
          },
        },
        { $sort: { activityAt: -1 } },
        {
          $group: {
            _id: '$boardId',
            type: { $first: '$type' },
            text: { $first: '$text' },
            createdAt: { $first: '$createdAt' },
            updatedAt: { $first: '$updatedAt' },
            activityAt: { $first: '$activityAt' },
          },
        },
      ])
      .exec();

    return rows.map((r) => ({
      boardId: r._id.toString(),
      type: r.type,
      text: r.text,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      activityAt: r.activityAt,
    }));
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

  toPublic(
    nota: NotaDocument,
    viewerId?: string,
    boardCategoria: string = 'grupo',
  ) {
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

    const myReaction = viewerId ? reactions[viewerId] ?? null : null;
    const visibleCounts = NotasRepository.visibleReactionCounts(
      reactionCounts,
      {
        viewerId,
        authorId: nota.authorId.toString(),
        boardCategoria,
        myReaction,
      },
    );

    return {
      id: nota._id.toString(),
      authorId: nota.authorId.toString(),
      boardId: nota.boardId.toString(),
      type: nota.type,
      tipoNota: nota.tipoNota,
      text: nota.text,
      media: nota.media,
      reactions,
      reactionCounts: visibleCounts,
      myReaction,
      recipientIds: (nota.recipientIds ?? []).map((id) => id.toString()),
      expiresAt: nota.expiresAt,
      createdAt: (nota as NotaDocument & { createdAt?: Date }).createdAt,
      updatedAt: (nota as NotaDocument & { updatedAt?: Date }).updatedAt,
    };
  }

  /**
   * Efímero: autor ve todos los conteos; el resto solo el suyo (0/1).
   * Grupo: todos ven todos los conteos.
   */
  static visibleReactionCounts(
    full: { like: number; heart: number; laugh: number; wow: number },
    opts: {
      viewerId?: string;
      authorId: string;
      boardCategoria: string;
      myReaction: string | null;
    },
  ) {
    if (opts.boardCategoria !== 'directa') {
      return { ...full };
    }
    if (opts.viewerId && opts.viewerId === opts.authorId) {
      return { ...full };
    }
    const mine = { like: 0, heart: 0, laugh: 0, wow: 0 };
    if (
      opts.myReaction === 'like' ||
      opts.myReaction === 'heart' ||
      opts.myReaction === 'laugh' ||
      opts.myReaction === 'wow'
    ) {
      mine[opts.myReaction] = 1;
    }
    return mine;
  }
}
