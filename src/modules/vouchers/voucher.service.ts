import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { FilterQuery, Types } from 'mongoose';
import { Voucher } from './schemas/voucher.schema';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { QueryVoucherDto } from './dto/query-voucher.dto';
import { VoucherRepo } from './voucher.repo';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';

export interface PaginatedVouchers {
  data: Voucher[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface VoucherValidationResult {
  valid: boolean;
  voucher?: Voucher;
  message: string;
  discount_amount?: number;
}

@Injectable()
export class VoucherService {
  private readonly logger = new Logger(VoucherService.name);

  constructor(private readonly voucherRepo: VoucherRepo) {}

  /**
   * Tạo voucher mới
   */
  async create(
    createVoucherDto: CreateVoucherDto,
    user: JwtPayload,
  ): Promise<Voucher> {
    const { code, room_ids, property_id, ...rest } = createVoucherDto;

    // Kiểm tra mã voucher đã tồn tại
    const codeExists = await this.voucherRepo.checkCodeExists(code);
    if (codeExists) {
      throw new ConflictException(`Mã voucher ${code} đã tồn tại`);
    }

    // Kiểm tra ngày hết hạn
    const expirationDate = new Date(createVoucherDto.expiration_date);
    if (expirationDate <= new Date()) {
      throw new BadRequestException('Ngày hết hạn phải sau thời điểm hiện tại');
    }

    // Xây dựng applies_to object
    const appliesTo: {
      property_id?: Types.ObjectId;
      room_ids?: Types.ObjectId[];
    } = {};

    if (property_id) {
      appliesTo.property_id = new Types.ObjectId(property_id);
    }

    if (room_ids && room_ids.length > 0) {
      appliesTo.room_ids = room_ids.map((id) => new Types.ObjectId(id));
    }

    const voucherData = {
      ...rest,
      code: code.toUpperCase(),
      expiration_date: expirationDate,
      applies_to: Object.keys(appliesTo).length > 0 ? appliesTo : undefined,
    };

    return this.voucherRepo.create(voucherData, user._id);
  }

  /**
   * Lấy danh sách vouchers với phân trang và bộ lọc
   */
  async findAll(queryDto: QueryVoucherDto): Promise<PaginatedVouchers> {
    const { page = 1, limit = 10, include_deleted, ...filters } = queryDto;

    // Build filter query
    const filterQuery: FilterQuery<Voucher> = {};

    if (!include_deleted) {
      filterQuery.isDeleted = false;
    }

    if (filters.code) {
      filterQuery.code = { $regex: filters.code.toUpperCase(), $options: 'i' };
    }

    if (filters.is_active !== undefined) {
      filterQuery.is_active = filters.is_active;
    }

    if (filters.expiration_date_from || filters.expiration_date_to) {
      const dateFilter: Record<string, Date> = {};
      if (filters.expiration_date_from) {
        dateFilter.$gte = new Date(filters.expiration_date_from);
      }
      if (filters.expiration_date_to) {
        dateFilter.$lte = new Date(filters.expiration_date_to);
      }
      filterQuery.expiration_date = dateFilter;
    }

    if (filters.search) {
      filterQuery.$or = [
        { code: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }

    // Filter theo property_id
    if (filters.property_id) {
      filterQuery['applies_to.property_id'] = new Types.ObjectId(
        filters.property_id,
      );
    }

    // Filter theo room_id
    if (filters.room_id) {
      filterQuery['applies_to.room_ids'] = new Types.ObjectId(filters.room_id);
    }

    const { data, total } = await this.voucherRepo.findAll(filterQuery);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Lấy voucher theo ID
   */
  async findOne(id: string): Promise<Voucher> {
    const voucher = await this.voucherRepo.findById(id);

    if (!voucher || voucher.isDeleted) {
      throw new NotFoundException(`Không tìm thấy voucher với ID ${id}`);
    }

    return voucher;
  }

  /**
   * Lấy voucher theo code
   */
  async findByCode(code: string): Promise<Voucher> {
    const voucher = await this.voucherRepo.findByCode(code);

    if (!voucher) {
      throw new NotFoundException(`Không tìm thấy voucher với mã ${code}`);
    }

    return voucher;
  }

  /**
   * Cập nhật voucher
   */
  async update(
    id: string,
    updateVoucherDto: UpdateVoucherDto,
    user: JwtPayload,
  ): Promise<Voucher> {
    const existingVoucher = await this.findOne(id);

    // Kiểm tra mã voucher nếu thay đổi
    if (
      updateVoucherDto.code &&
      updateVoucherDto.code !== existingVoucher.code
    ) {
      const codeExists = await this.voucherRepo.checkCodeExists(
        updateVoucherDto.code,
        id,
      );
      if (codeExists) {
        throw new ConflictException(
          `Mã voucher ${updateVoucherDto.code} đã tồn tại`,
        );
      }
    }

    // Kiểm tra ngày hết hạn nếu thay đổi
    if (updateVoucherDto.expiration_date) {
      const expirationDate = new Date(updateVoucherDto.expiration_date);
      if (expirationDate <= new Date()) {
        throw new BadRequestException(
          'Ngày hết hạn phải sau thời điểm hiện tại',
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (updateVoucherDto as any).expiration_date = expirationDate;
    }

    // Kiểm tra uses_count không vượt quá max_uses
    if (
      updateVoucherDto.uses_count !== undefined ||
      updateVoucherDto.max_uses !== undefined
    ) {
      const newUsesCount =
        updateVoucherDto.uses_count ?? existingVoucher.uses_count;
      const newMaxUses = updateVoucherDto.max_uses ?? existingVoucher.max_uses;

      if (newUsesCount > newMaxUses) {
        throw new BadRequestException(
          'Số lượt đã sử dụng không được vượt quá số lượt tối đa',
        );
      }
    }

    const { room_ids, property_id, ...rest } = updateVoucherDto;

    // Xây dựng applies_to object
    const appliesTo: {
      property_id?: Types.ObjectId;
      room_ids?: Types.ObjectId[];
    } = {};

    if (property_id) {
      appliesTo.property_id = new Types.ObjectId(property_id);
    }

    if (room_ids && room_ids.length > 0) {
      appliesTo.room_ids = room_ids.map((id) => new Types.ObjectId(id));
    }

    const updateData = {
      ...rest,
      code: updateVoucherDto.code?.toUpperCase(),
      applies_to: Object.keys(appliesTo).length > 0 ? appliesTo : undefined,
    };

    const updated = await this.voucherRepo.updateById(id, updateData, user._id);
    if (!updated) {
      throw new NotFoundException('Không thể cập nhật voucher');
    }

    return updated;
  }

  /**
   * Xóa mềm voucher
   */
  async remove(id: string, user: JwtPayload): Promise<{ success: boolean }> {
    await this.findOne(id);
    await this.voucherRepo.softDelete(id, user._id);
    return { success: true };
  }

  /**
   * Khôi phục voucher đã xóa
   */
  async restore(id: string): Promise<Voucher> {
    const restored = await this.voucherRepo.restore(id);
    if (!restored) {
      throw new NotFoundException(
        'Không tìm thấy voucher hoặc không thể khôi phục',
      );
    }
    return restored;
  }

  /**
   * Kiểm tra tính hợp lệ của voucher và tính toán giảm giá
   */
  async validateVoucher(
    code: string,
    totalAmount: number,
    listingId?: string,
    propertyId?: string,
    userId?: string,
  ): Promise<VoucherValidationResult> {
    const voucher = await this.voucherRepo.findByCode(code);

    if (!voucher) {
      return {
        valid: false,
        message: 'Mã voucher không tồn tại',
      };
    }

    if (!voucher.is_active) {
      return {
        valid: false,
        message: 'Mã voucher đã bị vô hiệu hóa',
      };
    }

    if (voucher.expiration_date < new Date()) {
      return {
        valid: false,
        message: 'Mã voucher đã hết hạn',
      };
    }

    if (voucher.uses_count >= voucher.max_uses) {
      return {
        valid: false,
        message: 'Mã voucher đã hết lượt sử dụng',
      };
    }

    // Kiểm tra giới hạn sử dụng per user
    if (userId && voucher.max_uses_per_user && voucher.max_uses_per_user > 0) {
      const userUsageCount = await this.voucherRepo.getUserUsageCount(
        String(voucher._id),
        userId,
      );
      if (userUsageCount >= voucher.max_uses_per_user) {
        return {
          valid: false,
          message: `Bạn đã sử dụng voucher này ${voucher.max_uses_per_user} lần (tối đa)`,
        };
      }
    }

    // Kiểm tra giá trị đơn hàng tối thiểu
    if (voucher.min_order_value && voucher.min_order_value > 0) {
      if (totalAmount < voucher.min_order_value) {
        return {
          valid: false,
          message: `Đơn hàng phải có giá trị tối thiểu ${voucher.min_order_value.toLocaleString('vi-VN')} VND để sử dụng voucher này`,
        };
      }
    }

    // Kiểm tra áp dụng cho property cụ thể
    if (voucher.applies_to?.property_id && propertyId) {
      if (voucher.applies_to.property_id.toString() !== propertyId) {
        return {
          valid: false,
          message: 'Mã voucher không áp dụng cho property này',
        };
      }
    }

    // Kiểm tra áp dụng cho phòng cụ thể
    if (voucher.applies_to?.room_ids && listingId) {
      const roomIds = voucher.applies_to.room_ids.map((id) => id.toString());
      if (!roomIds.includes(listingId)) {
        return {
          valid: false,
          message: 'Mã voucher không áp dụng cho phòng này',
        };
      }
    }

    const discountAmount = (totalAmount * voucher.discount_percent) / 100;

    return {
      valid: true,
      voucher,
      message: 'Mã voucher hợp lệ',
      discount_amount: discountAmount,
    };
  }

  /**
   * Sử dụng voucher (tăng uses_count và track usage)
   */
  async useVoucher(
    voucherId: string,
    userId?: string,
    bookingId?: string,
    discountAmount?: number,
    orderAmount?: number,
  ): Promise<Voucher> {
    const voucher = await this.voucherRepo.incrementUsesCount(voucherId);
    if (!voucher) {
      throw new NotFoundException('Không tìm thấy voucher');
    }

    // Track usage nếu có đầy đủ thông tin
    if (
      userId &&
      bookingId &&
      discountAmount !== undefined &&
      orderAmount !== undefined
    ) {
      await this.voucherRepo.trackVoucherUsage(
        voucherId,
        userId,
        bookingId,
        discountAmount,
        orderAmount,
        userId, // createdBy
      );
    }

    return voucher;
  }

  /**
   * Lấy lịch sử sử dụng voucher của user
   */
  async getUserVoucherHistory(
    voucherId: string,
    userId: string,
  ): Promise<any[]> {
    return this.voucherRepo.getUserUsageHistory(voucherId, userId);
  }

  /**
   * Lấy thống kê sử dụng voucher
   */
  async getVoucherUsageStats(voucherId: string): Promise<{
    totalUsage: number;
    uniqueUsers: number;
    averageUsagePerUser: number;
  }> {
    return this.voucherRepo.getVoucherUsageStats(voucherId);
  }

  /**
   * Kiểm tra voucher có được sử dụng cho booking cụ thể không
   */
  async isVoucherUsedForBooking(
    voucherId: string,
    bookingId: string,
  ): Promise<boolean> {
    return this.voucherRepo.isVoucherUsedForBooking(voucherId, bookingId);
  }

  /**
   * Lấy danh sách vouchers hợp lệ
   */
  async getValidVouchers(): Promise<Voucher[]> {
    return this.voucherRepo.getValidVouchers();
  }

  /**
   * Lấy voucher với thông tin chi tiết về property và phòng
   */
  async getVoucherWithRooms(id: string): Promise<{
    voucher: Voucher;
    message: string;
    property_id?: Types.ObjectId;
    room_ids?: Types.ObjectId[];
    total_rooms?: number;
  }> {
    const voucher = await this.findOne(id);

    const result: {
      voucher: Voucher;
      message: string;
      property_id?: Types.ObjectId;
      room_ids?: Types.ObjectId[];
      total_rooms?: number;
    } = {
      voucher,
      message: 'Voucher này áp dụng cho tất cả',
    };

    // Kiểm tra property_id
    if (voucher.applies_to?.property_id) {
      result.property_id = voucher.applies_to.property_id;
      result.message = 'Voucher này áp dụng cho property cụ thể';
    }

    // Kiểm tra room_ids
    if (
      voucher.applies_to?.room_ids &&
      voucher.applies_to.room_ids.length > 0
    ) {
      result.room_ids = voucher.applies_to.room_ids;
      result.total_rooms = voucher.applies_to.room_ids.length;
      result.message = `Voucher này áp dụng cho ${voucher.applies_to.room_ids.length} phòng cụ thể`;
    }

    // Nếu có cả property_id và room_ids
    if (
      voucher.applies_to?.property_id &&
      voucher.applies_to?.room_ids &&
      voucher.applies_to.room_ids.length > 0
    ) {
      result.message = `Voucher này áp dụng cho property cụ thể với ${voucher.applies_to.room_ids.length} phòng`;
    }

    return result;
  }

  /**
   * Lấy voucher theo property ID
   */
  async getVoucherByProperty(propertyId: string): Promise<{
    voucher: Voucher;
    message: string;
    property_id: Types.ObjectId;
    room_ids?: Types.ObjectId[];
    total_rooms?: number;
  }> {
    const voucher = await this.voucherRepo.findByProperty(propertyId);

    if (!voucher) {
      throw new NotFoundException(
        `Không tìm thấy voucher cho property ${propertyId}`,
      );
    }

    const result: {
      voucher: Voucher;
      message: string;
      property_id: Types.ObjectId;
      room_ids?: Types.ObjectId[];
      total_rooms?: number;
    } = {
      voucher,
      property_id: voucher.applies_to?.property_id as Types.ObjectId,
      message: 'Voucher này áp dụng cho property này',
    };

    // Kiểm tra room_ids
    if (
      voucher.applies_to?.room_ids &&
      voucher.applies_to.room_ids.length > 0
    ) {
      result.room_ids = voucher.applies_to.room_ids;
      result.total_rooms = voucher.applies_to.room_ids.length;
      result.message = `Voucher này áp dụng cho property này với ${voucher.applies_to.room_ids.length} phòng cụ thể`;
    }

    return result;
  }

  /**
   * Lấy thống kê tổng quan về vouchers (Admin only)
   */
  async getStatistics() {
    try {
      const stats = await this.voucherRepo.getStatistics();

      this.logger.log('Voucher statistics retrieved successfully');

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error(
        'Error getting voucher statistics:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể lấy thống kê voucher');
    }
  }

  /**
   * Lấy thông tin chi tiết về min_order_value của voucher
   */
  async getVoucherMinOrderInfo(id: string): Promise<{
    voucher: Voucher;
    minOrderValue: number;
    hasMinOrderRequirement: boolean;
    formattedMinOrderValue: string;
  }> {
    const voucher = await this.findOne(id);

    const minOrderValue = voucher.min_order_value || 0;
    const hasMinOrderRequirement = minOrderValue > 0;
    const formattedMinOrderValue =
      minOrderValue > 0
        ? minOrderValue.toLocaleString('vi-VN') + ' VND'
        : 'Không có yêu cầu';

    return {
      voucher,
      minOrderValue,
      hasMinOrderRequirement,
      formattedMinOrderValue,
    };
  }

  /**
   * Lấy danh sách voucher theo khoảng giá trị đơn hàng tối thiểu
   */
  async getVouchersByMinOrderRange(
    minValue: number,
    maxValue: number,
  ): Promise<Voucher[]> {
    return this.voucherRepo.findByMinOrderRange(minValue, maxValue);
  }
}
