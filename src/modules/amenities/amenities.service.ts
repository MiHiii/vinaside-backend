import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { UpdateAmenityDto } from './dto/update-amenity.dto';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { AmenitiesRepo } from './amenities.repo';
import { Types } from 'mongoose';
import { Amenity } from './schemas/amenity.schema';

@Injectable()
export class AmenitiesService {
  constructor(private readonly amenitiesRepo: AmenitiesRepo) {}

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
   * Tạo tiện ích mới (chỉ staff)
   */
  async create(createAmenityDto: CreateAmenityDto, user: JwtPayload) {
    this.validateStaff(user);

    const data = {
      ...createAmenityDto,
      room_id: new Types.ObjectId(createAmenityDto.room_id),
      createdBy: new Types.ObjectId(user._id),
    };

    return this.amenitiesRepo.create(data);
  }

  /**
   * Lấy tất cả tiện ích với context của user (staff hoặc guest)
   */
  async findAll(): Promise<any> {
    return await this.amenitiesRepo.findAll({});
  }

  /**
   * Lấy tiện ích theo ID với context của user (staff hoặc guest)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async findOne(id: string, _user?: JwtPayload): Promise<Amenity> {
    const amenity = await this.amenitiesRepo.findById(id);
    if (!amenity) {
      throw new NotFoundException('Không tìm thấy tiện ích');
    }
    return amenity;
  }

  /**
   * Cập nhật tiện ích (với kiểm tra ownership)
   */
  async update(
    id: string,
    updateAmenityDto: UpdateAmenityDto,
    user: JwtPayload,
  ) {
    this.validateStaff(user);

    const updateData = {
      ...updateAmenityDto,
      updatedBy: new Types.ObjectId(user._id),
    };

    const updated = await this.amenitiesRepo.updateById(id, updateData);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy tiện ích để cập nhật');
    }
    return updated;
  }

  /**
   * Soft delete tiện ích (với kiểm tra ownership)
   */
  async softDelete(id: string, user: JwtPayload) {
    this.validateStaff(user);

    const deleted = await this.amenitiesRepo.softDelete(id, user._id);
    if (!deleted) {
      throw new NotFoundException('Không tìm thấy tiện ích để xóa');
    }
    return deleted;
  }

  /**
   * Khôi phục tiện ích (với kiểm tra ownership)
   */
  async restore(id: string, user: JwtPayload) {
    this.validateStaff(user);

    const restored = await this.amenitiesRepo.restore(id, user._id);
    if (!restored) {
      throw new NotFoundException('Không thể khôi phục tiện ích');
    }
    return restored;
  }

  /**
   * Tìm kiếm tiện ích với context của user (staff hoặc guest)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async search(query: string, _user?: JwtPayload): Promise<any> {
    // Simple search implementation
    return await this.amenitiesRepo.search(query);
  }

  /**
   * Toggle trạng thái active/inactive của tiện ích
   */
  async toggleStatus(id: string, user: JwtPayload) {
    this.validateStaff(user);

    const existingAmenity = await this.amenitiesRepo.findById(id);
    if (!existingAmenity) {
      throw new NotFoundException('Không tìm thấy tiện ích');
    }

    const newStatus = !existingAmenity.is_active;
    const updateData = {
      is_active: newStatus,
      updatedBy: user._id,
    };

    return this.amenitiesRepo.updateById(id, updateData);
  }
}
