import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AmenityDocument = Amenity & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Amenity {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  icon_url: string;

  @Prop({ required: true })
  room_id: Types.ObjectId;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  createdBy: Types.ObjectId;

  @Prop()
  updatedBy?: Types.ObjectId;

  @Prop()
  deletedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const AmenitySchema = SchemaFactory.createForClass(Amenity);
