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
   * Lấy tất cả tiện ích với filter và pagination
   */
  async findAll(queryDto?: QueryAmenityDto): Promise<IAmenityResponse> {
    try {
      const result = await this.amenitiesRepo.findAllWithFilters(
        queryDto || {},
      );

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
   * Lấy tiện ích theo ID
   */
  async findOne(id: string): Promise<any> {
    this.validateObjectId(id);

    const amenity = await this.amenitiesRepo.findActiveById(id);
    if (!amenity) {
      throw new NotFoundException('Không tìm thấy tiện ích');
    }

    return amenity.toJSON();
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
   * Tìm kiếm tiện ích theo từ khóa
   */
  async search(query: string): Promise<{ data: IAmenity[]; total: number }> {
    try {
      const result = await this.amenitiesRepo.searchPublic(query);
      return {
        data: result.data as unknown as IAmenity[],
        total: result.total,
      };
    } catch (error) {
      this.logger.error(
        'Error searching amenities:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể tìm kiếm tiện ích');
    }
  }

  /**
   * Soft delete method alias for backward compatibility
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
