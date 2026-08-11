import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TableroDocument = HydratedDocument<Tablero>;

@Schema({ _id: true, timestamps: false })
export class SolicitudEntrada {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: null })
  expiresAt: Date | null;
}

@Schema({ timestamps: true, collection: 'tableros' })
export class Tablero {
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ required: true, enum: ['estatico', 'efimero'] })
  tipoTablero: 'estatico' | 'efimero';

  @Prop({ required: true, enum: ['personal', 'grupo', 'directa'] })
  categoria: 'personal' | 'grupo' | 'directa';

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  adminUserId: Types.ObjectId;

  @Prop({ type: String, default: null, index: true, sparse: true })
  inviteCode: string | null;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  miembros: Types.ObjectId[];

  @Prop({ type: [SolicitudEntrada], default: [] })
  solicitudesEntrada: SolicitudEntrada[];

  @Prop({ type: Date, default: null })
  expiresAt: Date | null;
}

export const TableroSchema = SchemaFactory.createForClass(Tablero);
