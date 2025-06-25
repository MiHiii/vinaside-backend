import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Voucher } from './schemas/voucher.schema';
import { BaseRepo } from '../../database/repo/base.repo';

@Injectable()
export class VoucherRepo extends BaseRepo<Voucher> {
  constructor(
    @InjectModel(Voucher.name)
    private readonly voucherModel: Model<Voucher>,
  ) {
    super(voucherModel);
  }

  async findByCode(code: string): Promise<Voucher | null> {
    return this.voucherModel
      .findOne({
        code: code.toUpperCase(),
        isDeleted: false,
      })
      .exec();
  }

  async checkCodeExists(code: string, excludeId?: string): Promise<boolean> {
    const query: FilterQuery<Voucher> = {
      code: code.toUpperCase(),
      isDeleted: false,
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const count = await this.voucherModel.countDocuments(query);
    return count > 0;
  }

  async incrementUsesCount(voucherId: string): Promise<Voucher | null> {
    return this.voucherModel
      .findByIdAndUpdate(voucherId, { $inc: { uses_count: 1 } }, { new: true })
      .exec();
  }

  async getValidVouchers(): Promise<Voucher[]> {
    return this.voucherModel
      .find({
        isDeleted: false,
        is_active: true,
        expiration_date: { $gte: new Date() },
        $expr: { $lt: ['$uses_count', '$max_uses'] },
      })
      .exec();
  }
}
