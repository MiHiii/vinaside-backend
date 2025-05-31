import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password_hash: string;

  @Prop({ required: true })
  phone: string;

  @Prop()
  avatar_url: string;

  @Prop({ enum: ['guest', 'host', 'admin'], default: 'guest' })
  role: string;

  @Prop({ default: 'vi' })
  language: string;

  @Prop({ default: false })
  is_verified: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
