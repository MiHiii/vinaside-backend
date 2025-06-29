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
    const { code, room_ids, ...rest } = createVoucherDto;

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

    const voucherData = {
      ...rest,
      code: code.toUpperCase(),
      expiration_date: expirationDate,
      applies_to: room_ids
        ? { room_ids: room_ids.map((id) => new Types.ObjectId(id)) }
        : undefined,
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

    const { room_ids, ...rest } = updateVoucherDto;
    const updateData = {
      ...rest,
      code: updateVoucherDto.code?.toUpperCase(),
      applies_to: room_ids
        ? { room_ids: room_ids.map((id) => new Types.ObjectId(id)) }
        : undefined,
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
   * Sử dụng voucher (tăng uses_count)
   */
  async useVoucher(voucherId: string): Promise<Voucher> {
    const voucher = await this.voucherRepo.incrementUsesCount(voucherId);
    if (!voucher) {
      throw new NotFoundException('Không tìm thấy voucher');
    }
    return voucher;
  }

  /**
   * Lấy danh sách vouchers hợp lệ
   */
  async getValidVouchers(): Promise<Voucher[]> {
    return this.voucherRepo.getValidVouchers();
  }

  /**
   * Lấy voucher với thông tin chi tiết về phòng
   */
  async getVoucherWithRooms(id: string): Promise<any> {
    const voucher = await this.findOne(id);

    if (
      !voucher.applies_to?.room_ids ||
      voucher.applies_to.room_ids.length === 0
    ) {
      return {
        voucher,
        rooms: [],
        message: 'Voucher này áp dụng cho tất cả phòng',
      };
    }

    // Lấy thông tin chi tiết về các phòng từ Listing collection
    const roomIds = voucher.applies_to.room_ids;

    return {
      voucher,
      room_ids: roomIds,
      total_rooms: roomIds.length,
      message: `Voucher này áp dụng cho ${roomIds.length} phòng cụ thể`,
    };
  }
}
