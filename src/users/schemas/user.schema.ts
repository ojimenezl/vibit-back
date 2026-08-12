import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: true, timestamps: false })
export class Notificacion {
  _id: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['contacto', 'join_tablero', 'contacto_aceptado', 'solicitud_enviada', 'contacto_nuevo'],
  })
  tipo:
    | 'contacto'
    | 'join_tablero'
    | 'contacto_aceptado'
    | 'solicitud_enviada'
    | 'contacto_nuevo';

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  fromUserId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tablero', default: null })
  boardId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  label: string | null;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

export const NotificacionSchema = SchemaFactory.createForClass(Notificacion);

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

  @Prop({ type: [NotificacionSchema], default: [] })
  notificaciones: Notificacion[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Tablero' }], default: [] })
  idTableros: Types.ObjectId[];

  @Prop({ type: [String], default: [] })
  fcmTokens: string[];

  @Prop({ type: String, default: null })
  googleId: string | null;

  @Prop({
    type: [
      {
        boardId: { type: Types.ObjectId, ref: 'Tablero', required: true },
        lastSeenAt: { type: Date, required: true },
      },
    ],
    default: [],
  })
  widgetSeen: { boardId: Types.ObjectId; lastSeenAt: Date }[];
}

export const UserSchema = SchemaFactory.createForClass(User);
