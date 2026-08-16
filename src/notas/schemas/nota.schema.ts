import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotaDocument = HydratedDocument<Nota>;

@Schema({ _id: false })
export class NotaMedia {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ type: Number, default: null })
  width: number | null;

  @Prop({ type: Number, default: null })
  height: number | null;
}

@Schema({ timestamps: true, collection: 'notas' })
export class Nota {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  authorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tablero', required: true, index: true })
  boardId: Types.ObjectId;

  @Prop({ required: true, enum: ['text', 'draw', 'photo'] })
  type: 'text' | 'draw' | 'photo';

  @Prop({ required: true, enum: ['estatico', 'efimero'] })
  tipoNota: 'estatico' | 'efimero';

  @Prop({ type: String, default: null })
  text: string | null;

  @Prop({ type: [NotaMedia], default: [] })
  media: NotaMedia[];

  @Prop({ type: Map, of: String, default: {} })
  reactions: Map<string, string>;

  /**
   * Destinatarios (solo efímero/directa).
   * Vacío = legacy / visible a todos los miembros del tablero.
   * Autor siempre ve su nota aunque no esté en la lista.
   */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  recipientIds: Types.ObjectId[];

  @Prop({ type: Date, default: null })
  expiresAt: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const NotaSchema = SchemaFactory.createForClass(Nota);
NotaSchema.index({ boardId: 1, createdAt: -1 });
