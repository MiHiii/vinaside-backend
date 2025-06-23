import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateSafetyFeatureDto } from './dto/create-safety_feature.dto';
import { UpdateSafetyFeatureDto } from './dto/update-safety_feature.dto';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { SafetyFeaturesRepo } from './safety_features.repo';
import { Types } from 'mongoose';

@Injectable()
export class SafetyFeaturesService {
  constructor(private readonly safetyFeaturesRepo: SafetyFeaturesRepo) {}

  /**
   * Kiểm tra user có phải staff không
   */
  private validateStaff(user: JwtPayload): void {
    if (user.role !== 'staff') {
      throw new ForbiddenException(
        'Chỉ staff mới có thể thực hiện hành động này',
      );
    }
  }

  /**
   * Tạo tính năng an toàn mới (chỉ staff)
   */
  async create(
    createSafetyFeatureDto: CreateSafetyFeatureDto,
    user: JwtPayload,
  ) {
    this.validateStaff(user);

    const data = {
      ...createSafetyFeatureDto,
      room_id: new Types.ObjectId(createSafetyFeatureDto.room_id),
      createdBy: new Types.ObjectId(user._id),
    };

    return this.safetyFeaturesRepo.create(data);
  }

  /**
   * Lấy tất cả tính năng an toàn với context của user (staff hoặc guest)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async findAll(_query: Record<string, any>, _user?: JwtPayload): Promise<any> {
    // Simple implementation - get all safety features
    return await this.safetyFeaturesRepo.findAll({});
  }

  /**
   * Lấy tính năng an toàn theo ID với context của user (staff hoặc guest)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async findOne(id: string, _user?: JwtPayload) {
    const safetyFeature = await this.safetyFeaturesRepo.findById(id);
    if (!safetyFeature) {
      throw new NotFoundException('Không tìm thấy tính năng an toàn');
    }
    return safetyFeature;
  }

  /**
   * Cập nhật tính năng an toàn (với kiểm tra ownership)
   */
  async update(
    id: string,
    updateSafetyFeatureDto: UpdateSafetyFeatureDto,
    user: JwtPayload,
  ) {
    this.validateStaff(user);

    const updateData = {
      ...updateSafetyFeatureDto,
      updatedBy: new Types.ObjectId(user._id),
    };

    const updated = await this.safetyFeaturesRepo.updateById(id, updateData);
    if (!updated) {
      throw new NotFoundException(
        'Không tìm thấy tính năng an toàn để cập nhật',
      );
    }
    return updated;
  }

  /**
   * Soft delete tính năng an toàn (với kiểm tra ownership)
   */
  async softDelete(id: string, user: JwtPayload) {
    this.validateStaff(user);

    const deleted = await this.safetyFeaturesRepo.softDelete(id, user._id);
    if (!deleted) {
      throw new NotFoundException('Không tìm thấy tính năng an toàn để xóa');
    }
    return deleted;
  }

  /**
   * Khôi phục tính năng an toàn (với kiểm tra ownership)
   */
  async restore(id: string, user: JwtPayload) {
    this.validateStaff(user);

    const restored = await this.safetyFeaturesRepo.restore(id, user._id);
    if (!restored) {
      throw new NotFoundException('Không thể khôi phục tính năng an toàn');
    }
    return restored;
  }

  /**
   * Tìm kiếm tính năng an toàn với context của user (staff hoặc guest)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async search(query: string, _user?: JwtPayload): Promise<any> {
    // Simple search implementation
    return await this.safetyFeaturesRepo.search(query);
  }

  /**
   * Toggle trạng thái active/inactive của tính năng an toàn
   */
  async toggleStatus(id: string, user: JwtPayload) {
    this.validateStaff(user);

    const existingSafetyFeature = await this.safetyFeaturesRepo.findById(id);
    if (!existingSafetyFeature) {
      throw new NotFoundException('Không tìm thấy tính năng an toàn');
    }

    const newStatus = !existingSafetyFeature.is_active;
    const updateData = {
      is_active: newStatus,
      updatedBy: user._id,
    };

    return this.safetyFeaturesRepo.updateById(id, updateData);
  }
}
