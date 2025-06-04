import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HouseRuleDocument = HouseRule & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class HouseRule {
    @Prop({ required: true })
    name: string;

    @Prop()
    description: string;

    @Prop()
    icon_url?: string;

    @Prop({ default: false })
    default_checked: boolean;

    @Prop({ default: true })
    is_active: boolean;

    @Prop({ default: false })
    isDeleted?: boolean;

    @Prop({ required: true })
    createdBy: Types.ObjectId;

    @Prop()
    updatedBy?: Types.ObjectId;

    @Prop()
    deletedBy?: Types.ObjectId;

    @Prop()
    deletedAt?: Date;
}

export const HouseRuleSchema = SchemaFactory.createForClass(HouseRule);
