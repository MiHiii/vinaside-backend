// src/companies/schema/company.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseDocument } from 'src/interfaces/base-document.interface';

export type CompanyDocument = HydratedDocument<Company>;

export interface ICompany extends BaseDocument {
  name: string;
  address?: string; // Đổi thành tùy chọn để khớp với schema
  description?: string; // Đổi thành tùy chọn để khớp với schema
}

@Schema({ timestamps: true })
export class Company implements ICompany {
  @Prop({ required: true })
  name: string;

  @Prop()
  address: string;

  @Prop()
  description: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  createdBy: mongoose.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  updatedBy: mongoose.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  deletedBy: mongoose.Types.ObjectId;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;
}

export const CompanySchema = SchemaFactory.createForClass(Company);
