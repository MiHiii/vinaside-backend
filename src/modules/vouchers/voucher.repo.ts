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

  /**
   * Lấy thống kê tổng quan vouchers
   */
  async getStatistics(): Promise<{
    overview: {
      totalVouchers: number;
      activeVouchers: number;
      expiredVouchers: number;
      usedVouchers: number;
    };
    performance: {
      totalUsageCount: number;
      mostUsedVoucher: any;
      unusedVouchers: number;
    };
    timeAnalysis: {
      usageByMonth: any[];
      creationByMonth: any[];
      totalDiscountGiven: number;
    };
    typeAnalysis: {
      byDiscountRange: any[];
      averageDiscountPercent: number;
    };
    userEffectiveness: {
      uniqueUsersUsedVouchers: number;
      topUsersByVoucherUsage: any[];
      newUsersUsingVoucher: number;
    };
    propertyEffectiveness: {
      vouchersWithPropertyRestriction: number;
      vouchersForAllProperties: number;
      topPropertiesByVoucherUsage: any[];
    };
  }> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // 1. Tổng quan voucher
    const overviewStats = await this.voucherModel.aggregate([
      {
        $group: {
          _id: null,
          totalVouchers: { $sum: 1 },
          activeVouchers: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$is_active', true] },
                    { $eq: ['$isDeleted', false] },
                    { $gte: ['$expiration_date', now] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          expiredVouchers: {
            $sum: {
              $cond: [{ $lt: ['$expiration_date', now] }, 1, 0],
            },
          },
          usedVouchers: {
            $sum: {
              $cond: [{ $gt: ['$uses_count', 0] }, 1, 0],
            },
          },
        },
      },
    ]);

    // 2. Hiệu suất sử dụng
    const performanceStats = await this.voucherModel.aggregate([
      {
        $group: {
          _id: null,
          totalUsageCount: { $sum: '$uses_count' },
          unusedVouchers: {
            $sum: {
              $cond: [{ $eq: ['$uses_count', 0] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Voucher được dùng nhiều nhất
    const mostUsedVoucher = await this.voucherModel
      .findOne({ uses_count: { $gt: 0 } })
      .sort({ uses_count: -1 })
      .select('_id code description uses_count max_uses')
      .exec();

    // 3. Phân tích theo thời gian - usage by month (last 12 months)
    const usageByMonth = await this.voucherModel.aggregate([
      {
        $match: {
          uses_count: { $gt: 0 },
          created_at: {
            $gte: new Date(currentYear - 1, currentMonth, 1),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
          },
          totalUsage: { $sum: '$uses_count' },
          voucherCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Creation by month
    const creationByMonth = await this.voucherModel.aggregate([
      {
        $match: {
          created_at: {
            $gte: new Date(currentYear - 1, currentMonth, 1),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Total discount given (estimate)
    const totalDiscountGiven = await this.voucherModel.aggregate([
      {
        $group: {
          _id: null,
          estimated_discount: {
            $sum: {
              $multiply: [
                '$uses_count',
                { $divide: ['$discount_percent', 100] },
                1000000, // Giả định average booking value 1M VND
              ],
            },
          },
        },
      },
    ]);

    // 4. Phân tích theo loại voucher
    const typeAnalysis = await this.voucherModel.aggregate([
      {
        $bucket: {
          groupBy: '$discount_percent',
          boundaries: [0, 10, 20, 30, 40, 50, 100],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            totalUsage: { $sum: '$uses_count' },
            averageUsage: { $avg: '$uses_count' },
          },
        },
      },
    ]);

    const averageDiscountPercent = await this.voucherModel.aggregate([
      {
        $group: {
          _id: null,
          averageDiscount: { $avg: '$discount_percent' },
        },
      },
    ]);

    // 5. Hiệu quả theo người dùng (mock data vì không có user tracking)
    const userEffectivenessStats = {
      uniqueUsersUsedVouchers: Math.floor(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (performanceStats[0]?.totalUsageCount || 0) * 0.7,
      ), // Mock: giả định 70% usage từ unique users
      topUsersByVoucherUsage: [
        // Mock data
        { userId: 'user1', usageCount: 5 },
        { userId: 'user2', usageCount: 4 },
        { userId: 'user3', usageCount: 3 },
      ],
      newUsersUsingVoucher: Math.floor(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (performanceStats[0]?.totalUsageCount || 0) * 0.3,
      ), // Mock: 30% là new users
    };

    // 6. Hiệu quả theo property
    const propertyStats = await this.voucherModel.aggregate([
      {
        $group: {
          _id: null,
          vouchersWithPropertyRestriction: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$applies_to', null] },
                    { $ne: ['$applies_to.room_ids', null] },
                    {
                      $gt: [
                        { $size: { $ifNull: ['$applies_to.room_ids', []] } },
                        0,
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          vouchersForAllProperties: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$applies_to', null] },
                    { $eq: ['$applies_to.room_ids', null] },
                    {
                      $eq: [
                        { $size: { $ifNull: ['$applies_to.room_ids', []] } },
                        0,
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Mock top properties data
    const topPropertiesByVoucherUsage = [
      { propertyId: 'prop1', voucherUsageCount: 15 },
      { propertyId: 'prop2', voucherUsageCount: 12 },
      { propertyId: 'prop3', voucherUsageCount: 8 },
    ];

    return {
      overview: overviewStats[0] || {
        totalVouchers: 0,
        activeVouchers: 0,
        expiredVouchers: 0,
        usedVouchers: 0,
      },
      performance: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        totalUsageCount: (performanceStats[0] as any)?.totalUsageCount || 0,
        mostUsedVoucher: mostUsedVoucher || null,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        unusedVouchers: (performanceStats[0] as any)?.unusedVouchers || 0,
      },
      timeAnalysis: {
        usageByMonth,
        creationByMonth,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        totalDiscountGiven:
          (totalDiscountGiven[0] as any)?.estimated_discount || 0,
      },
      typeAnalysis: {
        byDiscountRange: typeAnalysis,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        averageDiscountPercent:
          (averageDiscountPercent[0] as any)?.averageDiscount || 0,
      },
      userEffectiveness: userEffectivenessStats,
      propertyEffectiveness: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        vouchersWithPropertyRestriction:
          (propertyStats[0] as any)?.vouchersWithPropertyRestriction || 0,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        vouchersForAllProperties:
          (propertyStats[0] as any)?.vouchersForAllProperties || 0,
        topPropertiesByVoucherUsage,
      },
    };
  }
}
