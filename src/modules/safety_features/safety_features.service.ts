import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CreateSafetyFeatureDto } from './dto/create-safety_feature.dto';
import { UpdateSafetyFeatureDto } from './dto/update-safety_feature.dto';
import { QuerySafetyFeatureDto } from './dto/query-safety_feature.dto';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { SafetyFeaturesRepo } from './safety_features.repo';
import { Types } from 'mongoose';
import {
  ISafetyFeature,
  ISafetyFeatureResponse,
  ISafetyFeatureFilters,
} from './safety_features.interface';

@Injectable()
export class SafetyFeaturesService {
  private readonly logger = new Logger(SafetyFeaturesService.name);

  constructor(private readonly safetyFeaturesRepo: SafetyFeaturesRepo) {}

  /**
   * Kiểm tra quyền manage safety_feature
   */
  private validateManagePermission(user: JwtPayload): void {
    if (
      user.role !== 'admin' &&
      !user.permissions?.includes('safety_feature.manage')
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền quản lý tính năng an toàn',
      );
    }
  }

  /**
   * Validate MongoDB ObjectId
   */
  private validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }
  }

  /**
   * Tạo tính năng an toàn mới
   */
  async create(
    createDto: CreateSafetyFeatureDto,
    user: JwtPayload,
  ): Promise<ISafetyFeature> {
    this.validateManagePermission(user);

    try {
      const data = {
        ...createDto,
        createdBy: new Types.ObjectId(user._id),
      };

      const safetyFeature = await this.safetyFeaturesRepo.create(data);
      this.logger.log(
        `Safety feature created: ${String(safetyFeature._id)} by user: ${user._id}`,
      );

      return safetyFeature as unknown as ISafetyFeature;
    } catch (error) {
      this.logger.error(
        'Error creating safety feature:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể tạo tính năng an toàn');
    }
  }

  /**
   * Lấy danh sách tính năng an toàn với phân trang và lọc (Public - chỉ is_active=true và default_checked=true)
   */
  async findAll(
    queryDto?: QuerySafetyFeatureDto,
  ): Promise<ISafetyFeatureResponse> {
    try {
      const result = await this.safetyFeaturesRepo.findAllForPublic(
        queryDto || {},
      );

      return {
        safetyFeatures: result.data as unknown as ISafetyFeature[],
        meta: {
          ...result.meta,
          total: result.total,
        },
      };
    } catch (error) {
      this.logger.error(
        'Error finding safety features:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException(
        'Không thể lấy danh sách tính năng an toàn',
      );
    }
  }

  /**
   * Lấy tất cả tính năng an toàn cho admin (mặc định bao gồm cả đã xóa)
   */
  async findAllAdmin(
    queryDto?: QuerySafetyFeatureDto,
    user?: JwtPayload,
  ): Promise<ISafetyFeatureResponse> {
    if (user) {
      this.validateManagePermission(user);
    }

    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        includeDeleted = true, // Mặc định admin lấy tất cả
        search,
        is_active,
        default_checked,
        isDeleted,
        ...filterFields
      } = queryDto || {};

      const result = await this.safetyFeaturesRepo.findAllForAdmin({
        page,
        limit,
        sortBy,
        sortOrder,
        search,
        is_active,
        default_checked,
        includeDeleted,
        isDeleted,
        ...filterFields,
      });

      return {
        safetyFeatures: result.data as unknown as ISafetyFeature[],
        meta: {
          ...result.meta,
          total: result.total,
        },
      };
    } catch (error) {
      this.logger.error(
        'Error finding safety features for admin:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException(
        'Không thể lấy danh sách tính năng an toàn',
      );
    }
  }

  /**
   * Lấy tất cả tính năng an toàn cho public (alias for findAll)
   */
  async findAllPublic(
    queryDto?: QuerySafetyFeatureDto,
  ): Promise<ISafetyFeatureResponse> {
    return this.findAll(queryDto);
  }

  /**
   * Lấy tính năng an toàn theo ID (Public - chỉ is_active=true và default_checked=true)
   */
  async findOnePublic(id: string): Promise<ISafetyFeature> {
    this.validateObjectId(id);

    const safetyFeature = await this.safetyFeaturesRepo.findActiveById(id);
    if (!safetyFeature) {
      throw new NotFoundException('Không tìm thấy tính năng an toàn');
    }

    // Kiểm tra thêm default_checked cho public
    if (!safetyFeature.default_checked) {
      throw new NotFoundException('Không tìm thấy tính năng an toàn');
    }

    return safetyFeature as unknown as ISafetyFeature;
  }

  /**
   * @deprecated Use findOnePublic() instead
   */
  async findOne(id: string): Promise<ISafetyFeature> {
    return this.findOnePublic(id);
  }

  /**
   * Lấy tính năng an toàn theo ID cho admin (mặc định lấy tất cả trạng thái)
   */
  async findOneAdmin(
    id: string,
    user: JwtPayload,
    includeDeleted = true,
  ): Promise<ISafetyFeature> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    const safetyFeature = await this.safetyFeaturesRepo.findByIdForAdmin(
      id,
      includeDeleted,
    );
    if (!safetyFeature) {
      throw new NotFoundException('Không tìm thấy tính năng an toàn');
    }

    return safetyFeature as unknown as ISafetyFeature;
  }

  /**
   * Cập nhật tính năng an toàn
   */
  async update(
    id: string,
    updateDto: UpdateSafetyFeatureDto,
    user: JwtPayload,
  ): Promise<ISafetyFeature> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    try {
      const existingSafetyFeature =
        await this.safetyFeaturesRepo.findActiveById(id);
      if (!existingSafetyFeature) {
        throw new NotFoundException('Không tìm thấy tính năng an toàn');
      }

      const updateData = {
        ...updateDto,
        updatedBy: new Types.ObjectId(user._id),
      };

      const updatedSafetyFeature = await this.safetyFeaturesRepo.updateById(
        id,
        updateData,
      );
      this.logger.log(`Safety feature updated: ${id} by user: ${user._id}`);

      return updatedSafetyFeature! as unknown as ISafetyFeature;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        'Error updating safety feature:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể cập nhật tính năng an toàn');
    }
  }

  /**
   * Xóa mềm tính năng an toàn
   */
  async remove(id: string, user: JwtPayload): Promise<{ success: boolean }> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    try {
      const existingSafetyFeature =
        await this.safetyFeaturesRepo.findActiveById(id);
      if (!existingSafetyFeature) {
        throw new NotFoundException('Không tìm thấy tính năng an toàn');
      }

      await this.safetyFeaturesRepo.softDelete(id, user._id);
      this.logger.log(
        `Safety feature soft deleted: ${id} by user: ${user._id}`,
      );

      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        'Error deleting safety feature:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể xóa tính năng an toàn');
    }
  }

  /**
   * Khôi phục tính năng an toàn đã xóa
   */
  async restore(id: string, user: JwtPayload): Promise<ISafetyFeature> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    try {
      const restoredSafetyFeature = await this.safetyFeaturesRepo.restore(
        id,
        user._id,
      );
      if (!restoredSafetyFeature) {
        throw new NotFoundException('Không thể khôi phục tính năng an toàn');
      }

      this.logger.log(`Safety feature restored: ${id} by user: ${user._id}`);
      return restoredSafetyFeature as unknown as ISafetyFeature;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        'Error restoring safety feature:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể khôi phục tính năng an toàn');
    }
  }

  /**
   * Toggle trạng thái active/inactive
   */
  async toggleStatus(id: string, user: JwtPayload): Promise<ISafetyFeature> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    try {
      const updatedSafetyFeature = await this.safetyFeaturesRepo.toggleStatus(
        id,
        user._id,
      );
      if (!updatedSafetyFeature) {
        throw new NotFoundException('Không tìm thấy tính năng an toàn');
      }

      this.logger.log(
        `Safety feature status toggled: ${id} to ${updatedSafetyFeature.is_active} by user: ${user._id}`,
      );

      return updatedSafetyFeature as unknown as ISafetyFeature;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        'Error toggling safety feature status:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException(
        'Không thể thay đổi trạng thái tính năng an toàn',
      );
    }
  }

  /**
   * Toggle trạng thái default_checked
   */
  async toggleDefaultChecked(
    id: string,
    user: JwtPayload,
  ): Promise<ISafetyFeature> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    try {
      const updatedSafetyFeature =
        await this.safetyFeaturesRepo.toggleDefaultChecked(id, user._id);
      if (!updatedSafetyFeature) {
        throw new NotFoundException('Không tìm thấy tính năng an toàn');
      }

      this.logger.log(
        `Safety feature default_checked toggled: ${id} to ${updatedSafetyFeature.default_checked} by user: ${user._id}`,
      );

      return updatedSafetyFeature as unknown as ISafetyFeature;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        'Error toggling safety feature default_checked:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException(
        'Không thể thay đổi trạng thái default_checked của tính năng an toàn',
      );
    }
  }

  /**
   * Tìm kiếm tính năng an toàn cho admin (mặc định search tất cả trạng thái)
   */
  async searchAdmin(
    query: string,
    user: JwtPayload,
    filters?: {
      is_active?: boolean;
      default_checked?: boolean;
      includeDeleted?: boolean;
      isDeleted?: boolean;
    },
  ): Promise<{ data: ISafetyFeature[]; total: number }> {
    this.validateManagePermission(user);

    try {
      // Mặc định admin search tất cả trạng thái nếu không specify includeDeleted
      const defaultFilters = {
        includeDeleted: true,
        ...filters,
      };

      const searchResult = await this.safetyFeaturesRepo.searchAdmin(
        query,
        defaultFilters,
      );

      return {
        data: searchResult.data as unknown as ISafetyFeature[],
        total: searchResult.total,
      };
    } catch (error) {
      this.logger.error(
        'Error searching safety features for admin:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể tìm kiếm tính năng an toàn');
    }
  }

  // ==================== LEGACY METHODS FOR BACKWARD COMPATIBILITY ====================

  /**
   * @deprecated Use remove() instead
   */
  async softDelete(id: string, user: JwtPayload): Promise<ISafetyFeature> {
    await this.remove(id, user);
    return this.findOne(id);
  }
}
