import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Transaction,
  TransactionDocument,
  TransactionStatus,
} from '../schemas/transaction.schema';
import {
  TransactionLog,
  TransactionLogDocument,
  ChangedBy,
} from '../schemas/transaction-log.schema';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from '../dto/update-transaction-status.dto';
import { QueryTransactionDto } from '../dto/query-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(TransactionLog.name)
    private readonly transactionLogModel: Model<TransactionLogDocument>,
  ) {}

  async createTransaction(
    createTransactionDto: CreateTransactionDto,
  ): Promise<TransactionDocument> {
    const transaction = new this.transactionModel({
      ...createTransactionDto,
      reference_id: new Types.ObjectId(createTransactionDto.reference_id),
      user_id: new Types.ObjectId(createTransactionDto.user_id),
      created_by: createTransactionDto.created_by
        ? new Types.ObjectId(createTransactionDto.created_by)
        : undefined,
    });

    const savedTransaction = await transaction.save();

    // Create initial log entry
    await this.createTransactionLog(
      savedTransaction._id as Types.ObjectId,
      undefined,
      savedTransaction.status,
      ChangedBy.SYSTEM,
      undefined,
      'Transaction created',
    );

    return savedTransaction;
  }

  async getTransactionById(id: string): Promise<TransactionDocument> {
    const transaction = await this.transactionModel
      .findById(id)
      .populate('user_id', 'email fullName')
      .populate('created_by', 'email fullName')
      .populate('updated_by', 'email fullName')
      .exec();

    if (!transaction) {
      throw new NotFoundException('Không tìm thấy giao dịch');
    }

    return transaction;
  }

  async getTransactions(query: QueryTransactionDto) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeDeleted = false,
      ...filters
    } = query;

    const skip = (page - 1) * limit;
    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    // Build filter object
    const filterConditions: any = {};

    if (!includeDeleted) {
      filterConditions.isDeleted = false;
    }

    if (filters.user_id) {
      filterConditions.user_id = new Types.ObjectId(filters.user_id);
    }

    if (filters.type) {
      filterConditions.type = filters.type;
    }

    if (filters.direction) {
      filterConditions.direction = filters.direction;
    }

    if (filters.status) {
      filterConditions.status = filters.status;
    }

    if (filters.method) {
      filterConditions.method = filters.method;
    }

    if (filters.provider) {
      filterConditions.provider = filters.provider;
    }

    if (filters.reference_type) {
      filterConditions.reference_type = filters.reference_type;
    }

    if (filters.reference_id) {
      filterConditions.reference_id = new Types.ObjectId(filters.reference_id);
    }

    if (filters.min_amount || filters.max_amount) {
      filterConditions.amount = {};
      if (filters.min_amount) {
        filterConditions.amount.$gte = filters.min_amount;
      }
      if (filters.max_amount) {
        filterConditions.amount.$lte = filters.max_amount;
      }
    }

    if (filters.from_date || filters.to_date) {
      filterConditions.createdAt = {};
      if (filters.from_date) {
        filterConditions.createdAt.$gte = new Date(filters.from_date);
      }
      if (filters.to_date) {
        filterConditions.createdAt.$lte = new Date(filters.to_date);
      }
    }

    if (filters.search) {
      filterConditions.$or = [
        { note: { $regex: filters.search, $options: 'i' } },
        { provider_transaction_id: { $regex: filters.search, $options: 'i' } },
        { provider_order_id: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(filterConditions)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('user_id', 'email fullName')
        .populate('created_by', 'email fullName')
        .exec(),
      this.transactionModel.countDocuments(filterConditions),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateTransactionStatus(
    id: string,
    updateStatusDto: UpdateTransactionStatusDto,
    userId?: string,
  ): Promise<TransactionDocument> {
    const transaction = await this.getTransactionById(id);
    const oldStatus = transaction.status;

    if (oldStatus === updateStatusDto.status) {
      throw new BadRequestException(
        `Transaction is already in ${updateStatusDto.status} status`,
      );
    }

    // Update transaction
    transaction.status = updateStatusDto.status;
    transaction.updated_by = userId ? new Types.ObjectId(userId) : undefined;
    const updatedTransaction = await transaction.save();

    // Create log entry
    await this.createTransactionLog(
      transaction._id as Types.ObjectId,
      oldStatus,
      updateStatusDto.status,
      updateStatusDto.changed_by,
      userId ? new Types.ObjectId(userId) : undefined,
      updateStatusDto.note,
    );

    return updatedTransaction;
  }

  async getTransactionLogs(
    transactionId: string,
  ): Promise<TransactionLogDocument[]> {
    const transaction = await this.getTransactionById(transactionId);

    return this.transactionLogModel
      .find({ transaction_id: transaction._id, isDeleted: false })
      .sort({ timestamp: -1 })
      .populate('changed_by_user', 'email fullName')
      .exec();
  }

  async getUserTransactions(
    userId: string,
    query: Partial<QueryTransactionDto>,
  ) {
    return this.getTransactions({
      ...query,
      user_id: userId,
    });
  }

  async getTransactionsByReference(
    referenceType: string,
    referenceId: string,
  ): Promise<TransactionDocument[]> {
    return this.transactionModel
      .find({
        reference_type: referenceType,
        reference_id: new Types.ObjectId(referenceId),
        isDeleted: false,
      })
      .sort({ createdAt: -1 })
      .populate('user_id', 'email fullName')
      .exec();
  }

  async deleteTransaction(id: string, deletedBy?: string): Promise<void> {
    const transaction = await this.getTransactionById(id);

    transaction.isDeleted = true;
    transaction.deletedAt = new Date();
    transaction.deletedBy = deletedBy
      ? new Types.ObjectId(deletedBy)
      : undefined;

    await transaction.save();

    // Create log entry
    await this.createTransactionLog(
      transaction._id as Types.ObjectId,
      transaction.status,
      transaction.status,
      ChangedBy.ADMIN,
      deletedBy ? new Types.ObjectId(deletedBy) : undefined,
      'Transaction soft deleted',
    );
  }

  private async createTransactionLog(
    transactionId: Types.ObjectId,
    fromStatus: TransactionStatus | undefined,
    toStatus: TransactionStatus,
    changedBy: ChangedBy,
    changedByUser?: Types.ObjectId,
    note?: string,
    metadata?: Record<string, any>,
  ): Promise<TransactionLogDocument> {
    const log = new this.transactionLogModel({
      transaction_id: transactionId,
      from_status: fromStatus,
      to_status: toStatus,
      changed_by: changedBy,
      changed_by_user: changedByUser,
      note,
      metadata,
    });

    return log.save();
  }

  async getTransactionStats(filters?: Partial<QueryTransactionDto>) {
    const filterConditions: any = { isDeleted: false };

    if (filters?.user_id) {
      filterConditions.user_id = new Types.ObjectId(filters.user_id);
    }

    if (filters?.from_date || filters?.to_date) {
      filterConditions.createdAt = {};
      if (filters.from_date) {
        filterConditions.createdAt.$gte = new Date(filters.from_date);
      }
      if (filters.to_date) {
        filterConditions.createdAt.$lte = new Date(filters.to_date);
      }
    }

    const stats = await this.transactionModel.aggregate([
      { $match: filterConditions },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          successfulTransactions: {
            $sum: {
              $cond: [{ $eq: ['$status', TransactionStatus.SUCCESS] }, 1, 0],
            },
          },
          successfulAmount: {
            $sum: {
              $cond: [
                { $eq: ['$status', TransactionStatus.SUCCESS] },
                '$amount',
                0,
              ],
            },
          },
          pendingTransactions: {
            $sum: {
              $cond: [{ $eq: ['$status', TransactionStatus.PENDING] }, 1, 0],
            },
          },
          failedTransactions: {
            $sum: {
              $cond: [{ $eq: ['$status', TransactionStatus.FAILED] }, 1, 0],
            },
          },
        },
      },
    ]);

    return (
      stats[0] || {
        totalTransactions: 0,
        totalAmount: 0,
        successfulTransactions: 0,
        successfulAmount: 0,
        pendingTransactions: 0,
        failedTransactions: 0,
      }
    );
  }
}
