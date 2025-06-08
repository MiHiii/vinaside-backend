import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { UpdateAmenityDto } from './dto/update-amenity.dto';
import { AmenityDocument } from './schemas/amenity.schema';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { AmenitiesRepo } from './amenities.repo';
import { FilterQuery, Types } from 'mongoose';

@Injectable()
export class AmenitiesService {
  constructor(private readonly amenitiesRepo: AmenitiesRepo) {}

  /**
   * Kiểm tra user có phải host không
   */
  private validateHost(user: JwtPayload): void {
    if (user.role !== 'host') {
      throw new UnauthorizedException(
        'Chỉ có chủ nhà mới có thể quản lý tiện ích',
      );
    }
  }

  /**
   * Tạo tiện ích mới (chỉ host)
   */
  async create(createAmenityDto: CreateAmenityDto, user: JwtPayload) {
    this.validateHost(user);

    const data = {
      ...createAmenityDto,
      room_id: new Types.ObjectId(createAmenityDto.room_id),
      createdBy: new Types.ObjectId(user._id),
    };

    return this.amenitiesRepo.create(data);
  }

  /**
   * Lấy tất cả tiện ích với filtering và pagination
   */
  async findAll(
    query: Record<string, any> = {},
    options: Record<string, any> = {},
  ) {
    try {
      const result = await this.amenitiesRepo.findAll(query, options);
      return result.data;
    } catch {
      return [];
    }
  }

  /**
   * Lấy tất cả tiện ích với context của user (host hoặc guest)
   */
  async findAllWithUserContext(
    query: Record<string, any> = {},
    user?: JwtPayload,
  ) {
    if (user?.role === 'host') {
      const userQuery = { ...query, createdBy: user._id };
      return this.findAll(userQuery);
    } else {
      const publicQuery = { ...query, isDeleted: false };
      return this.findAll(publicQuery);
    }
  }

  /**
   * Lấy tiện ích theo ID (với kiểm tra ownership nếu có userId)
   */
  async findOne(id: string, userId?: string) {
    if (userId) {
      // Kiểm tra ownership cho host
      const amenity = await this.amenitiesRepo.findByIdAndCreatedBy(
        id,
        userId,
      );
      if (!amenity) {
        throw new NotFoundException(
          'Không tìm thấy tiện ích hoặc bạn không có quyền truy cập',
        );
      }
      return amenity;
    }

    // Cho guest - chỉ lấy những amenity chưa bị xóa
    const amenity = await this.amenitiesRepo.findById(id);
    if (!amenity || amenity.isDeleted) {
      throw new NotFoundException('Không tìm thấy tiện ích');
    }
    return amenity;
  }

  /**
   * Lấy tiện ích theo ID với context của user (host hoặc guest)
   */
  async findOneWithUserContext(id: string, user?: JwtPayload) {
    if (user?.role === 'host') {
      return this.findOne(id, user._id);
    } else {
      return this.findOne(id);
    }
  }

  /**
   * Cập nhật tiện ích (với kiểm tra ownership)
   */
  async update(
    id: string,
    updateAmenityDto: UpdateAmenityDto,
    user: JwtPayload,
  ) {
    // Kiểm tra ownership
    const existingAmenity = await this.amenitiesRepo.findByIdAndCreatedBy(
      id,
      user._id,
    );
    if (!existingAmenity) {
      throw new NotFoundException(
        'Không tìm thấy tiện ích hoặc bạn không có quyền cập nhật',
      );
    }

    const updateData = {
      ...updateAmenityDto,
      updatedBy: new Types.ObjectId(user._id),
    };

    return this.amenitiesRepo.updateById(id, updateData);
  }

  /**
   * Soft delete tiện ích (với kiểm tra ownership)
   */
  async softDelete(id: string, user: JwtPayload) {
    // Kiểm tra ownership
    const existingAmenity = await this.amenitiesRepo.findByIdAndCreatedBy(
      id,
      user._id,
    );
    if (!existingAmenity) {
      throw new NotFoundException(
        'Không tìm thấy tiện ích hoặc bạn không có quyền xóa',
      );
    }

    return this.amenitiesRepo.softDelete(id, user._id);
  }

  /**
   * Khôi phục tiện ích (với kiểm tra ownership)
   */
  async restore(id: string, user: JwtPayload) {
    this.validateHost(user);
    
    // Kiểm tra ownership cho deleted record
    const existingAmenity = await this.amenitiesRepo.findByIdAndCreatedBy(
      id,
      user._id,
      true, // includeDeleted = true
    );
    
    if (!existingAmenity || !existingAmenity.isDeleted) {
      throw new NotFoundException(
        'Không tìm thấy tiện ích, chưa bị xóa hoặc bạn không có quyền khôi phục',
      );
    }

    return this.amenitiesRepo.restore(id, user._id);
  }

  /**
   * Tìm kiếm tiện ích (với filter theo user)
   */
  async search(
    query: string,
    userId?: string,
    additionalFilter: Record<string, any> = {},
  ) {
    if (!query?.trim()) return [];

    const additionalFilters: FilterQuery<AmenityDocument> = userId
      ? { createdBy: userId, isDeleted: { $ne: true }, ...additionalFilter }
      : { isDeleted: { $ne: true }, ...additionalFilter };

    try {
      const result = await this.amenitiesRepo.search(
        query,
        ['name', 'description'],
        additionalFilters,
        { sort: { created_at: -1 } },
      );
      return result.data;
    } catch {
      return [];
    }
  }

  /**
   * Tìm kiếm tiện ích với context của user (host hoặc guest)
   */
  async searchWithUserContext(query: string, user?: JwtPayload) {
    if (user?.role === 'host') {
      return this.search(query, user._id);
    } else {
      return this.search(query, undefined, { isDeleted: false });
    }
  }
}
