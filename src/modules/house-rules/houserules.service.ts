import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { HouseRulesRepo } from './house-rules.repo';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { CreateHouseRuleDto } from './dto/create-house-rule.dto';
import { UpdateHouseRuleDto } from './dto/update-house-rule.dto';
import { Types } from 'mongoose';
import { HouseRule } from './schemas/house-rule.schema';

@Injectable()
export class HouseRulesService {
  constructor(private readonly houseRulesRepo: HouseRulesRepo) {}

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
   * Tạo quy tắc nhà mới (chỉ staff)
   */
  async create(createDto: CreateHouseRuleDto, user: JwtPayload) {
    this.validateStaff(user);

    const data = {
      ...createDto,
      room_id: new Types.ObjectId(createDto.room_id),
      createdBy: new Types.ObjectId(user._id),
    };

    return this.houseRulesRepo.create(data);
  }

  /**
   * Lấy tất cả quy tắc nhà với context của user (staff hoặc guest)
   */
  async findAll(): Promise<any> {
    // Simple implementation - get all house rules
    return await this.houseRulesRepo.findAll({});
  }

  /**
   * Lấy quy tắc nhà theo ID với context của user (staff hoặc guest)
   */
  async findOne(id: string): Promise<HouseRule> {
    const houseRule = await this.houseRulesRepo.findById(id);
    if (!houseRule) {
      throw new NotFoundException('Không tìm thấy quy tắc nhà');
    }
    return houseRule;
  }

  /**
   * Cập nhật quy tắc nhà (với kiểm tra ownership)
   */
  async update(id: string, updateDto: UpdateHouseRuleDto, user: JwtPayload) {
    this.validateStaff(user);

    const updateData = {
      ...updateDto,
      updatedBy: user._id,
    };

    const updated = await this.houseRulesRepo.updateById(id, updateData);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy quy tắc nhà để cập nhật');
    }
    return updated;
  }

  /**
   * Soft delete quy tắc nhà (với kiểm tra ownership)
   */
  async softDelete(id: string, user: JwtPayload) {
    this.validateStaff(user);

    const deleted = await this.houseRulesRepo.softDelete(id, user._id);
    if (!deleted) {
      throw new NotFoundException('Không tìm thấy quy tắc nhà để xóa');
    }
    return deleted;
  }

  /**
   * Khôi phục quy tắc nhà (với kiểm tra ownership)
   */
  async restore(id: string, user: JwtPayload) {
    this.validateStaff(user);

    const restored = await this.houseRulesRepo.restore(id, user._id);
    if (!restored) {
      throw new NotFoundException('Không thể khôi phục quy tắc nhà');
    }
    return restored;
  }

  /**
   * Tìm kiếm quy tắc nhà với context của user (staff hoặc guest)
   */
  async search(query: string): Promise<any> {
    // Simple search implementation
    return await this.houseRulesRepo.search(query);
  }

  /**
   * Toggle trạng thái active/inactive của quy tắc nhà
   */
  async toggleStatus(id: string, user: JwtPayload) {
    this.validateStaff(user);

    const existingRule = await this.houseRulesRepo.findById(id);
    if (!existingRule) {
      throw new NotFoundException('Không tìm thấy quy tắc nhà');
    }

    const newStatus = !existingRule.is_active;
    const updateData = {
      is_active: newStatus,
      updatedBy: user._id,
    };

    return this.houseRulesRepo.updateById(id, updateData);
  }
}
