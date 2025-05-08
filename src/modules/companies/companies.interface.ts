import { Types } from 'mongoose';
import { BaseDocument } from 'src/interfaces/base-document.interface';

export interface ICompany extends BaseDocument {
  name: string;
  address: string;
  description: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
}
