import {
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import {
  Transaction,
  TransactionDocument,
  TransactionStatus,
  TransactionType,
  TransactionDirection,
  ReferenceType,
  PaymentProvider,
  PaymentMethod,
} from '../schemas/transaction.schema';
import {
  TransactionLog,
  TransactionLogDocument,
  ChangedBy,
} from '../schemas/transaction-log.schema';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from '../dto/update-transaction-status.dto';
import { QueryTransactionDto } from '../dto/query-transaction.dto';
import { BookingService } from '../../booking/booking.service';
import { BookingStatus } from '../../booking/schemas/booking.schema';
import { toSafeString } from 'src/utils';
import { applyStaffFilter } from '../../../utils/staff-filter.util';

interface AmountRangeFilter {
  $gte?: number;
  $lte?: number;
}

interface DateRangeFilter {
  $gte?: Date;
  $lte?: Date;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(TransactionLog.name)
    private readonly transactionLogModel: Model<TransactionLogDocument>,
    @Inject(forwardRef(() => BookingService))
    private readonly bookingService: BookingService,
  ) {}

  async createTransaction(
    createTransactionDto: CreateTransactionDto,
  ): Promise<TransactionDocument> {
    const transaction = new this.transactionModel({
      ...createTransactionDto,
      reference_id: new Types.ObjectId(createTransactionDto.reference_id),
      user_id: new Types.ObjectId(createTransactionDto.user_id),
      propertyId: createTransactionDto.propertyId
        ? new Types.ObjectId(createTransactionDto.propertyId)
        : undefined,
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

  async getTransactions(query: QueryTransactionDto, user?: any, request?: any) {
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
    const filterConditions: FilterQuery<Transaction> = {};

    if (!includeDeleted) {
      filterConditions.isDeleted = false;
    }

    if (filters.user_id) {
      filterConditions.user_id = new Types.ObjectId(filters.user_id);
    }

    if (filters.propertyId) {
      filterConditions.propertyId = new Types.ObjectId(filters.propertyId);
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
      const amountFilter: AmountRangeFilter = {};
      if (filters.min_amount) {
        amountFilter.$gte = filters.min_amount;
      }
      if (filters.max_amount) {
        amountFilter.$lte = filters.max_amount;
      }
      filterConditions.amount = amountFilter;
    }

    if (filters.from_date || filters.to_date) {
      const dateFilter: DateRangeFilter = {};
      if (filters.from_date) {
        dateFilter.$gte = new Date(filters.from_date);
      }
      if (filters.to_date) {
        dateFilter.$lte = new Date(filters.to_date);
      }
      filterConditions.createdAt = dateFilter;
    }

    if (filters.search) {
      filterConditions.$or = [
        { note: { $regex: filters.search, $options: 'i' } },
        { provider_transaction_id: { $regex: filters.search, $options: 'i' } },
        { provider_order_id: { $regex: filters.search, $options: 'i' } },
      ];
    }

    // Apply staff filtering using utility function
    const filteredConditions = applyStaffFilter(
      filterConditions,
      request,
      'propertyId',
    );

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(filteredConditions)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('user_id', 'email fullName')
        .populate('created_by', 'email fullName')
        .exec(),
      this.transactionModel.countDocuments(filteredConditions),
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

  async getTransactionStats(filters?: Partial<QueryTransactionDto>): Promise<{
    overview: {
      totalTransactions: number;
      totalAmount: number;
      avgAmount: number;
      statusBreakdown: string[];
    };
    statusBreakdown: Array<{
      _id: string;
      count: number;
      totalAmount: number;
    }>;
  }> {
    const filterConditions: FilterQuery<Transaction> = { isDeleted: false };

    if (filters?.user_id) {
      filterConditions.user_id = new Types.ObjectId(filters.user_id);
    }

    if (filters?.from_date || filters?.to_date) {
      const dateFilter: DateRangeFilter = {};
      if (filters.from_date) {
        dateFilter.$gte = new Date(filters.from_date);
      }
      if (filters.to_date) {
        dateFilter.$lte = new Date(filters.to_date);
      }
      filterConditions.createdAt = dateFilter;
    }

    const [stats, statusStats] = await Promise.all([
      this.transactionModel.aggregate([
        { $match: filterConditions },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgAmount: { $avg: '$amount' },
            statusBreakdown: {
              $push: '$status',
            },
          },
        },
      ]),
      this.transactionModel.aggregate([
        { $match: filterConditions },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const overviewResult = stats[0] as
      | {
          totalTransactions: number;
          totalAmount: number;
          avgAmount: number;
          statusBreakdown: string[];
        }
      | undefined;

    const statusResult = statusStats as Array<{
      _id: string;
      count: number;
      totalAmount: number;
    }>;

    return {
      overview: overviewResult || {
        totalTransactions: 0,
        totalAmount: 0,
        avgAmount: 0,
        statusBreakdown: [],
      },
      statusBreakdown: statusResult,
    };
  }

  async refundBookingTransaction(
    bookingId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const booking =
        await this.bookingService['bookingRepo'].findById(bookingId);
      if (!booking)
        return { success: false, message: 'Không tìm thấy booking' };
      if (booking.status !== BookingStatus.CANCELLED)
        return { success: false, message: 'Booking chưa bị huỷ' };
      if (!booking.deposit_paid_amount || booking.deposit_paid_amount <= 0)
        return { success: false, message: 'Booking chưa thanh toán cọc' };
      if (!booking.refund_amount || booking.refund_amount <= 0)
        return { success: false, message: 'Không có số tiền hoàn lại' };

      // Tạo transaction refund
      // Lấy id booking và guestId an toàn
      const bookingIdStr = toSafeString(booking._id);
      if (!bookingIdStr)
        return { success: false, message: 'ID booking không hợp lệ' };
      const guestIdStr = toSafeString(booking.guestId);
      if (!guestIdStr)
        return { success: false, message: 'ID guest không hợp lệ' };
      const refundTransaction = await this.createTransaction({
        type: TransactionType.REFUND,
        direction: TransactionDirection.REFUND,
        reference_type: ReferenceType.BOOKING,
        reference_id: bookingIdStr,
        amount: booking.refund_amount,
        user_id: guestIdStr,
        method: booking.payment_method as PaymentMethod,
        provider: booking.vnpay_card_type
          ? PaymentProvider.VNPAY
          : PaymentProvider.MOMO,
        note: 'Refund for cancelled booking',
      });

      // Mock gọi provider
      let refundResult: {
        success: boolean;
        refundId?: string;
        message?: string;
      } = { success: false };
      if (booking.payment_method === 'vnpay') {
        refundResult = {
          success: true,
          refundId: 'MOCK_VNPAY_REFUND_ID',
          message: 'Mock VNPay refund success',
        };
      } else if (booking.payment_method === 'momo') {
        refundResult = {
          success: true,
          refundId: 'MOCK_MOMO_REFUND_ID',
          message: 'Mock MoMo refund success',
        };
      } else {
        refundResult = {
          success: false,
          message: 'Không hỗ trợ refund cho phương thức này',
        };
      }

      // Cập nhật transaction status
      let newStatus = TransactionStatus.FAILED;
      if (refundResult.success) {
        newStatus = TransactionStatus.SUCCESS;
        refundTransaction.provider_transaction_id = refundResult.refundId;
        refundTransaction.raw_response = refundResult;
      } else {
        refundTransaction.raw_response = refundResult;
      }
      refundTransaction.status = newStatus;
      await refundTransaction.save();

      // Ghi log
      await this['createTransactionLog'](
        refundTransaction._id as Types.ObjectId,
        TransactionStatus.PENDING,
        newStatus,
        ChangedBy.SYSTEM,
        new Types.ObjectId(guestIdStr),
        refundResult.message || '',
      );

      if (newStatus === TransactionStatus.SUCCESS) {
        return { success: true, message: 'Hoàn tiền thành công!' };
      } else {
        return {
          success: false,
          message: 'Hoàn tiền thất bại: ' + (refundResult.message || ''),
        };
      }
    } catch (err: unknown) {
      let msg = 'Lỗi không xác định';
      if (
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message?: unknown }).message === 'string'
      ) {
        msg = (err as { message: string }).message;
      }
      return { success: false, message: msg };
    }
  }
}
