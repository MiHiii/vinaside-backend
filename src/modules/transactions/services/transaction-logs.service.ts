import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import {
  TransactionLog,
  TransactionLogDocument,
  ChangedBy,
} from '../schemas/transaction-log.schema';
import { TransactionStatus } from '../schemas/transaction.schema';

interface DateRangeFilter {
  $gte?: Date;
  $lte?: Date;
}

@Injectable()
export class TransactionLogsService {
  constructor(
    @InjectModel(TransactionLog.name)
    private readonly transactionLogModel: Model<TransactionLogDocument>,
  ) {}

  async createLog(
    transactionId: string,
    fromStatus: TransactionStatus | undefined,
    toStatus: TransactionStatus,
    changedBy: ChangedBy,
    changedByUser?: string,
    note?: string,
    metadata?: Record<string, any>,
  ): Promise<TransactionLogDocument> {
    const log = new this.transactionLogModel({
      transaction_id: new Types.ObjectId(transactionId),
      from_status: fromStatus,
      to_status: toStatus,
      changed_by: changedBy,
      changed_by_user: changedByUser
        ? new Types.ObjectId(changedByUser)
        : undefined,
      note,
      metadata,
    });

    return log.save();
  }

  async getTransactionLogs(
    transactionId: string,
    includeDeleted = false,
  ): Promise<TransactionLogDocument[]> {
    const filter: Record<string, any> = {
      transaction_id: new Types.ObjectId(transactionId),
    };

    if (!includeDeleted) {
      filter.isDeleted = false;
    }

    return this.transactionLogModel
      .find(filter)
      .sort({ timestamp: -1 })
      .populate('changed_by_user', 'email fullName')
      .exec();
  }

  async getLogById(logId: string): Promise<TransactionLogDocument> {
    const log = await this.transactionLogModel
      .findById(logId)
      .populate('changed_by_user', 'email fullName')
      .populate('transaction_id')
      .exec();

    if (!log) {
      throw new NotFoundException('Không tìm thấy log giao dịch');
    }

    return log;
  }

  async getLogsByUser(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TransactionLogDocument[]> {
    const filter: FilterQuery<TransactionLogDocument> = {
      changed_by_user: new Types.ObjectId(userId),
      isDeleted: false,
    };

    if (startDate || endDate) {
      const timestampFilter: DateRangeFilter = {};
      if (startDate) {
        timestampFilter.$gte = startDate;
      }
      if (endDate) {
        timestampFilter.$lte = endDate;
      }
      filter.timestamp = timestampFilter;
    }

    return this.transactionLogModel
      .find(filter)
      .sort({ timestamp: -1 })
      .populate('transaction_id')
      .exec();
  }

  async getLogsByChangedBy(
    changedBy: ChangedBy,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TransactionLogDocument[]> {
    const filter: FilterQuery<TransactionLogDocument> = {
      changed_by: changedBy,
      isDeleted: false,
    };

    if (startDate || endDate) {
      const timestampFilter: DateRangeFilter = {};
      if (startDate) {
        timestampFilter.$gte = startDate;
      }
      if (endDate) {
        timestampFilter.$lte = endDate;
      }
      filter.timestamp = timestampFilter;
    }

    return this.transactionLogModel
      .find(filter)
      .sort({ timestamp: -1 })
      .populate('changed_by_user', 'email fullName')
      .populate('transaction_id')
      .exec();
  }

  async deleteLog(logId: string): Promise<void> {
    const log = await this.getLogById(logId);

    log.isDeleted = true;
    log.deletedAt = new Date();
    await log.save();
  }

  async getLogsStatistics(startDate?: Date, endDate?: Date) {
    const filter: FilterQuery<TransactionLogDocument> = { isDeleted: false };

    if (startDate || endDate) {
      const timestampFilter: DateRangeFilter = {};
      if (startDate) {
        timestampFilter.$gte = startDate;
      }
      if (endDate) {
        timestampFilter.$lte = endDate;
      }
      filter.timestamp = timestampFilter;
    }

    const stats = await this.transactionLogModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$changed_by',
          count: { $sum: 1 },
          statusChanges: {
            $push: {
              from: '$from_status',
              to: '$to_status',
            },
          },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    const statusTransitions = await this.transactionLogModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            from: '$from_status',
            to: '$to_status',
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    return {
      changesByActor: stats,
      statusTransitions,
    };
  }
}
