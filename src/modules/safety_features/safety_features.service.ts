import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateSafetyFeatureDto } from './dto/create-safety_feature.dto';
import { UpdateSafetyFeatureDto } from './dto/update-safety_feature.dto';
import { SafetyFeatureDocument } from './schemas/safety_feature.schema';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { SafetyFeaturesRepo } from './safety_features.repo';
import { FilterQuery, Types } from 'mongoose';

@Injectable()
export class SafetyFeaturesService {
  constructor(private readonly safetyFeaturesRepo: SafetyFeaturesRepo) {}

  /**
   * Kiểm tra user có phải host không
   */
  private validateHost(user: JwtPayload): void {
    if (user.role !== 'host') {
      throw new UnauthorizedException(
        'Chỉ có chủ nhà mới có thể quản lý tính năng an toàn',
      );
    }
  }

  /**
   * Tạo tính năng an toàn mới (chỉ host)
   */
  async create(
    createSafetyFeatureDto: CreateSafetyFeatureDto,
    user: JwtPayload,
  ) {
    this.validateHost(user);

    const data = {
      ...createSafetyFeatureDto,
      room_id: new Types.ObjectId(createSafetyFeatureDto.room_id),
      createdBy: new Types.ObjectId(user._id),
    };

    return this.safetyFeaturesRepo.create(data);
  }

  /**
   * Lấy tất cả tính năng an toàn với filtering và pagination
   */
  async findAll(
    query: Record<string, any> = {},
    options: Record<string, any> = {},
  ) {
    try {
      const result = await this.safetyFeaturesRepo.findAll(query, options);
      return result.data;
    } catch {
      return [];
    }
  }

  /**
   * Lấy tất cả tính năng an toàn với context của user (host hoặc guest)
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
   * Lấy tính năng an toàn theo ID (với kiểm tra ownership nếu có userId)
   */
  async findOne(id: string, userId?: string) {
    if (userId) {
      // Kiểm tra ownership cho host
      const safetyFeature = await this.safetyFeaturesRepo.findByIdAndCreatedBy(
        id,
        userId,
      );
      if (!safetyFeature) {
        throw new NotFoundException(
          'Không tìm thấy tính năng an toàn hoặc bạn không có quyền truy cập',
        );
      }
      return safetyFeature;
    }

    // Cho guest - chỉ lấy những safety feature chưa bị xóa
    const safetyFeature = await this.safetyFeaturesRepo.findById(id);
    if (!safetyFeature || safetyFeature.isDeleted) {
      throw new NotFoundException('Không tìm thấy tính năng an toàn');
    }
    return safetyFeature;
  }

  /**
   * Lấy tính năng an toàn theo ID với context của user (host hoặc guest)
   */
  async findOneWithUserContext(id: string, user?: JwtPayload) {
    if (user?.role === 'host') {
      return this.findOne(id, user._id);
    } else {
      return this.findOne(id);
    }
  }

  /**
   * Cập nhật tính năng an toàn (với kiểm tra ownership)
   */
  async update(
    id: string,
    updateSafetyFeatureDto: UpdateSafetyFeatureDto,
    user: JwtPayload,
  ) {
    this.validateHost(user);

    // Kiểm tra ownership
    const existingSafetyFeature =
      await this.safetyFeaturesRepo.findByIdAndCreatedBy(id, user._id);
    if (!existingSafetyFeature) {
      throw new NotFoundException(
        'Không tìm thấy tính năng an toàn hoặc bạn không có quyền cập nhật',
      );
    }

    const updateData = {
      ...updateSafetyFeatureDto,
      updatedBy: new Types.ObjectId(user._id),
    };

    return this.safetyFeaturesRepo.updateById(id, updateData);
  }

  /**
   * Soft delete tính năng an toàn (với kiểm tra ownership)
   */
  async softDelete(id: string, user: JwtPayload) {
    // Kiểm tra ownership
    const existingSafetyFeature =
      await this.safetyFeaturesRepo.findByIdAndCreatedBy(id, user._id);
    if (!existingSafetyFeature) {
      throw new NotFoundException(
        'Không tìm thấy tính năng an toàn hoặc bạn không có quyền xóa',
      );
    }

    return this.safetyFeaturesRepo.softDelete(id, user._id);
  }

  /**
   * Khôi phục tính năng an toàn (với kiểm tra ownership)
   */
  async restore(id: string, user: JwtPayload) {
    this.validateHost(user);

    // Kiểm tra ownership cho deleted record
    const existingSafetyFeature =
      await this.safetyFeaturesRepo.findByIdAndCreatedBy(
        id,
        user._id,
        true, // includeDeleted = true
      );

    if (!existingSafetyFeature || !existingSafetyFeature.isDeleted) {
      throw new NotFoundException(
        'Không tìm thấy tính năng an toàn, chưa bị xóa hoặc bạn không có quyền khôi phục',
      );
    }

    return this.safetyFeaturesRepo.restore(id, user._id);
  }

  /**
   * Tìm kiếm tính năng an toàn (với filter theo user)
   */
  async search(
    query: string,
    userId?: string,
    additionalFilter: Record<string, any> = {},
  ) {
    if (!query?.trim()) return [];

    const additionalFilters: FilterQuery<SafetyFeatureDocument> = userId
      ? { createdBy: userId, isDeleted: { $ne: true }, ...additionalFilter }
      : { isDeleted: { $ne: true }, ...additionalFilter };

    try {
      const result = await this.safetyFeaturesRepo.search(
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
   * Tìm kiếm tính năng an toàn với context của user (host hoặc guest)
   */
  async searchWithUserContext(query: string, user?: JwtPayload) {
    if (user?.role === 'host') {
      return this.search(query, user._id);
    } else {
      return this.search(query, undefined, { isDeleted: false });
    }
  }
}
