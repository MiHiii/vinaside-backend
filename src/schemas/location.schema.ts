import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Location extends Document {
  @Prop({ required: true, unique: true })
  place_id: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: Object })
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };

  @Prop({ type: Object })
  raw?: any; // lưu toàn bộ kết quả trả về nếu muốn

  @Prop({ default: true })
  isActive?: boolean;
}

export const LocationSchema = SchemaFactory.createForClass(Location);
