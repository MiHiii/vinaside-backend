import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { AmenitiesRepo } from './amenities.repo';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { UpdateAmenityDto } from './dto/update-amenity.dto';
import { QueryAmenityDto } from './dto/query-amenity.dto';
import { Amenity } from './schemas/amenity.schema';
import { IAmenityResponse, IAmenity } from './amenity.interface';

@Injectable()
export class AmenitiesService {
  private readonly logger = new Logger(AmenitiesService.name);

  constructor(private readonly amenitiesRepo: AmenitiesRepo) {}

  /**
   * Kiểm tra quyền truy cập (chỉ admin và content_manager có thể quản lý)
   */
  private validateManagePermission(user: JwtPayload): void {
    if (
      user.role !== 'admin' &&
      !user.permissions?.includes('amenity.manage')
    ) {
      throw new ForbiddenException('Bạn không có quyền quản lý tiện ích');
    }
  }

  /**
   * Validate ObjectId format
   */
  private validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }
  }

  /**
   * Tạo tiện ích mới
   */
  async create(createDto: CreateAmenityDto, user: JwtPayload): Promise<any> {
    this.validateManagePermission(user);

    try {
      const data = {
        ...createDto,
        createdBy: new Types.ObjectId(user._id),
      };

      const amenity = await this.amenitiesRepo.create(data);
      this.logger.log(
        `Amenity created: ${String(amenity._id)} by user: ${user._id}`,
      );

      return amenity.toJSON();
    } catch (error) {
      this.logger.error(
        'Error creating amenity:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể tạo tiện ích');
    }
  }

  /**
   * Lấy tất cả tiện ích với filter và pagination (Public - chỉ is_active=true và default_checked=true)
   */
  async findAll(queryDto?: QueryAmenityDto): Promise<IAmenityResponse> {
    try {
      const result = await this.amenitiesRepo.findAllForPublic(queryDto || {});

      return {
        amenities: result.data as unknown as IAmenity[],
        meta: result.meta,
      };
    } catch (error) {
      this.logger.error(
        'Error finding amenities:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể lấy danh sách tiện ích');
    }
  }

  /**
   * Lấy tất cả tiện ích cho admin (mặc định bao gồm cả đã xóa)
   */
  async findAllAdmin(
    queryDto?: QueryAmenityDto,
    user?: JwtPayload,
  ): Promise<IAmenityResponse> {
    if (user) {
      this.validateManagePermission(user);
    }

    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        includeDeleted = true, // ✅ Mặc định admin lấy tất cả như house-rules
        search,
        is_active,
        default_checked,
        isDeleted,
      } = queryDto || {};

      const result = await this.amenitiesRepo.findAllForAdmin({
        page,
        limit,
        sortBy,
        sortOrder,
        search,
        is_active,
        default_checked,
        includeDeleted, // ✅ Pass đúng giá trị includeDeleted
        isDeleted,
      });

      return {
        amenities: result.data as unknown as IAmenity[],
        meta: {
          ...result.meta,
          total: result.total,
        },
      };
    } catch (error) {
      this.logger.error(
        'Error finding amenities for admin:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể lấy danh sách tiện ích');
    }
  }

  /**
   * Lấy tất cả tiện ích cho public (alias for findAll)
   */
  async findAllPublic(queryDto?: QueryAmenityDto): Promise<IAmenityResponse> {
    return this.findAll(queryDto);
  }

  /**
   * Lấy tiện ích theo ID (Public - chỉ is_active=true và default_checked=true)
   */
  async findOnePublic(id: string): Promise<any> {
    this.validateObjectId(id);

    const amenity = await this.amenitiesRepo.findActiveById(id);
    if (!amenity) {
      throw new NotFoundException('Không tìm thấy tiện ích');
    }

    // Kiểm tra thêm default_checked cho public
    if (!amenity.default_checked) {
      throw new NotFoundException('Không tìm thấy tiện ích');
    }

    return amenity.toJSON();
  }

  /**
   * @deprecated Use findOnePublic() instead
   */
  async findOne(id: string): Promise<any> {
    return this.findOnePublic(id);
  }

  /**
   * Lấy tiện ích theo ID cho admin (mặc định lấy tất cả trạng thái)
   */
  async findOneAdmin(
    id: string,
    user: JwtPayload,
    includeDeleted = true,
  ): Promise<Amenity> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    const amenity = await this.amenitiesRepo.findByIdForAdmin(
      id,
      includeDeleted,
    );
    if (!amenity) {
      throw new NotFoundException('Không tìm thấy tiện ích');
    }

    return amenity;
  }

  /**
   * Cập nhật tiện ích
   */
  async update(
    id: string,
    updateDto: UpdateAmenityDto,
    user: JwtPayload,
  ): Promise<any> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    const existingAmenity = await this.amenitiesRepo.findActiveById(id);
    if (!existingAmenity) {
      throw new NotFoundException('Không tìm thấy tiện ích');
    }

    try {
      const updateData = {
        ...updateDto,
        updatedBy: new Types.ObjectId(user._id),
      };

      const updatedAmenity = await this.amenitiesRepo.updateById(
        id,
        updateData,
      );
      this.logger.log(`Amenity updated: ${id} by user: ${user._id}`);

      return updatedAmenity!.toJSON();
    } catch (error) {
      this.logger.error(
        'Error updating amenity:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể cập nhật tiện ích');
    }
  }

  /**
   * Xóa mềm tiện ích
   */
  async remove(id: string, user: JwtPayload): Promise<{ success: boolean }> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    const existingAmenity = await this.amenitiesRepo.findActiveById(id);
    if (!existingAmenity) {
      throw new NotFoundException('Không tìm thấy tiện ích');
    }

    try {
      await this.amenitiesRepo.softDelete(id, user._id);
      this.logger.log(`Amenity soft deleted: ${id} by user: ${user._id}`);

      return { success: true };
    } catch (error) {
      this.logger.error(
        'Error deleting amenity:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể xóa tiện ích');
    }
  }

  /**
   * Khôi phục tiện ích đã xóa
   */
  async restore(id: string, user: JwtPayload): Promise<any> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    const deletedAmenity = await this.amenitiesRepo.findDeletedById(id);
    if (!deletedAmenity) {
      throw new NotFoundException('Không tìm thấy tiện ích đã bị xóa');
    }

    try {
      const restoredAmenity = await this.amenitiesRepo.restore(id, user._id);
      this.logger.log(`Amenity restored: ${id} by user: ${user._id}`);

      return restoredAmenity!.toJSON();
    } catch (error) {
      this.logger.error(
        'Error restoring amenity:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể khôi phục tiện ích');
    }
  }

  /**
   * Toggle trạng thái active/inactive của tiện ích
   */
  async toggleStatus(id: string, user: JwtPayload): Promise<any> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    try {
      const updatedAmenity = await this.amenitiesRepo.toggleStatus(
        id,
        user._id,
      );
      if (!updatedAmenity) {
        throw new NotFoundException('Không tìm thấy tiện ích');
      }

      this.logger.log(
        `Amenity status toggled: ${id} to ${updatedAmenity.is_active} by user: ${user._id}`,
      );
      return updatedAmenity;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        'Error toggling amenity status:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể thay đổi trạng thái tiện ích');
    }
  }

  /**
   * Toggle trạng thái default_checked của tiện ích
   */
  async toggleDefaultChecked(id: string, user: JwtPayload): Promise<any> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    try {
      const updatedAmenity = await this.amenitiesRepo.toggleDefaultChecked(
        id,
        user._id,
      );
      if (!updatedAmenity) {
        throw new NotFoundException('Không tìm thấy tiện ích');
      }

      this.logger.log(
        `Amenity default_checked toggled: ${id} to ${updatedAmenity.default_checked} by user: ${user._id}`,
      );
      return updatedAmenity;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        'Error toggling amenity default_checked:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException(
        'Không thể thay đổi trạng thái default_checked',
      );
    }
  }

  /**
   * Tìm kiếm tiện ích cho admin (mặc định search tất cả trạng thái)
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
  ): Promise<{ data: IAmenity[]; total: number }> {
    this.validateManagePermission(user);

    try {
      // ✅ Mặc định admin search tất cả trạng thái nếu không specify includeDeleted
      const defaultFilters = {
        includeDeleted: true, // ✅ Mặc định admin search TẤT CẢ
        ...filters,
      };

      const searchResult = await this.amenitiesRepo.searchAdmin(
        query,
        defaultFilters,
      );

      return {
        data: searchResult.data as unknown as IAmenity[],
        total: searchResult.total,
      };
    } catch (error) {
      this.logger.error(
        'Error searching amenities for admin:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể tìm kiếm tiện ích');
    }
  }

  // ==================== LEGACY METHODS FOR BACKWARD COMPATIBILITY ====================

  /**
   * @deprecated Use remove() instead
   */
  async softDelete(id: string, user: JwtPayload): Promise<Amenity> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    const existingAmenity = await this.amenitiesRepo.findActiveById(id);
    if (!existingAmenity) {
      throw new NotFoundException('Không tìm thấy tiện ích');
    }

    try {
      const deletedAmenity = await this.amenitiesRepo.softDelete(id, user._id);
      this.logger.log(`Amenity soft deleted: ${id} by user: ${user._id}`);

      return deletedAmenity!;
    } catch (error) {
      this.logger.error(
        'Error soft deleting amenity:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể xóa tiện ích');
    }
  }
}
