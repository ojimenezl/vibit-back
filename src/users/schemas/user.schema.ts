import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: true, timestamps: false })
export class Notificacion {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({ required: true, enum: ['contacto', 'join_tablero'] })
  tipo: 'contacto' | 'join_tablero';

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  fromUserId: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true })
  username: string;

  @Prop({ required: true, unique: true, index: true })
  userCode: string;

  @Prop({ required: true, unique: true, index: true })
  linkUser: string;

  @Prop({ required: true })
  pinHash: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  contactos: Types.ObjectId[];

  @Prop({ type: [Notificacion], default: [] })
  notificaciones: Notificacion[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Tablero' }], default: [] })
  idTableros: Types.ObjectId[];

  @Prop({ type: [String], default: [] })
  fcmTokens: string[];

  @Prop({ type: String, default: null })
  googleId: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
