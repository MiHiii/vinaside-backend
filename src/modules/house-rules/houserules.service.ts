import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HouseRulesRepo } from './house-rules.repo';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { CreateHouseRuleDto } from './dto/create-house-rule.dto';
import { UpdateHouseRuleDto } from './dto/update-house-rule.dto';
import { HouseRuleDocument } from './schemas/house-rule.schema';
import { FilterQuery, Types } from 'mongoose';

@Injectable()
export class HouseRulesService {
  constructor(private readonly houseRulesRepo: HouseRulesRepo) {}

  /**
   * Kiểm tra user có phải host không
   */
  private validateHost(user: JwtPayload): void {
    if (user.role !== 'host') {
      throw new UnauthorizedException('Chỉ có chủ nhà mới có thể tạo quy tắc nhà');
    }
  }

  /**
   * Tạo quy tắc nhà mới (chỉ host)
   */
  async create(createDto: CreateHouseRuleDto, user: JwtPayload) {
    this.validateHost(user);
    
    const data = {
      ...createDto,
      room_id: new Types.ObjectId(createDto.room_id),
      createdBy: new Types.ObjectId(user._id),
    };
    
    return this.houseRulesRepo.create(data);
  }

  /**
   * Lấy tất cả quy tắc nhà với filtering và pagination
   */
  async findAll(query: Record<string, any> = {}, options: Record<string, any> = {}) {
    try {
      const result = await this.houseRulesRepo.findAll(query, options);
      return result.data;
    } catch (error) {
      return [];
    }
  }

  /**
   * Lấy tất cả quy tắc nhà với context của user (host hoặc guest)
   */
  async findAllWithUserContext(query: Record<string, any> = {}, user?: JwtPayload) {
    if (user?.role === 'host') {
      const userQuery = { ...query, createdBy: user._id };
      return this.findAll(userQuery);
    } else {
      const publicQuery = { ...query, isDeleted: false };
      return this.findAll(publicQuery);
    }
  }

  /**
   * Lấy quy tắc nhà theo ID (với kiểm tra ownership nếu có userId)
   */
  async findOne(id: string, userId?: string) {
    if (userId) {
      // Kiểm tra ownership cho host
      const houseRule = await this.houseRulesRepo.findByIdAndCreatedBy(id, userId);
      if (!houseRule) {
        throw new NotFoundException(
          'Không tìm thấy quy tắc nhà hoặc bạn không có quyền truy cập',
        );
      }
      return houseRule;
    }
    
    // Cho guest - chỉ lấy những rule chưa bị xóa
    const houseRule = await this.houseRulesRepo.findById(id);
    if (!houseRule || houseRule.isDeleted) {
      throw new NotFoundException('Không tìm thấy quy tắc nhà');
    }
    return houseRule;
  }

  /**
   * Lấy quy tắc nhà theo ID với context của user (host hoặc guest)
   */
  async findOneWithUserContext(id: string, user?: JwtPayload) {
    if (user?.role === 'host') {
      return this.findOne(id, user._id);
    } else {
      return this.findOne(id);
    }
  }

  /**
   * Cập nhật quy tắc nhà (với kiểm tra ownership)
   */
  async update(id: string, updateDto: UpdateHouseRuleDto, user: JwtPayload) {
    // Kiểm tra ownership
    const existingRule = await this.houseRulesRepo.findByIdAndCreatedBy(id, user._id);
    if (!existingRule) {
      throw new NotFoundException(
        'Không tìm thấy quy tắc nhà hoặc bạn không có quyền cập nhật',
      );
    }

    const updateData = {
      ...updateDto,
      updatedBy: user._id,
    };

    return this.houseRulesRepo.updateById(id, updateData);
  }

  /**
   * Soft delete quy tắc nhà (với kiểm tra ownership)
   */
  async softDelete(id: string, user: JwtPayload) {
    // Kiểm tra ownership
    const existingRule = await this.houseRulesRepo.findByIdAndCreatedBy(id, user._id);
    if (!existingRule) {
      throw new NotFoundException(
        'Không tìm thấy quy tắc nhà hoặc bạn không có quyền xóa',
      );
    }

    return this.houseRulesRepo.softDelete(id, user._id);
  }

  /**
   * Khôi phục quy tắc nhà (với kiểm tra ownership)
   */
  async restore(id: string, user: JwtPayload) {
    // Kiểm tra ownership cho deleted record
    const existingRule = await this.houseRulesRepo.findByIdAndCreatedBy(
      id,
      user._id,
      true, // includeDeleted = true
    );
    
    if (!existingRule || !existingRule.isDeleted) {
      throw new NotFoundException(
        'Không tìm thấy quy tắc nhà, chưa bị xóa hoặc bạn không có quyền khôi phục',
      );
    }

    return this.houseRulesRepo.restore(id, user._id);
  }

  /**
   * Tìm kiếm quy tắc nhà (với filter theo user)
   */
  async search(query: string, userId?: string) {
    if (!query?.trim()) return [];

    const additionalFilters: FilterQuery<HouseRuleDocument> = userId 
      ? { createdBy: userId, isDeleted: { $ne: true } }
      : { isDeleted: { $ne: true } };

    try {
      const result = await this.houseRulesRepo.search(
        query,
        ['name', 'description'],
        additionalFilters,
        { sort: { created_at: -1 } }
      );
      return result.data;
    } catch {
      return [];
    }
  }

  /**
   * Tìm kiếm quy tắc nhà công khai (cho guest)
   */
  async searchPublic(query: string) {
    if (!query?.trim()) return [];

    const additionalFilters: FilterQuery<HouseRuleDocument> = {
      isDeleted: { $ne: true }
    };

    try {
      const result = await this.houseRulesRepo.search(
        query,
        ['name', 'description'],
        additionalFilters,
        { sort: { created_at: -1 } }
      );
      return result.data;
    } catch {
      return [];
    }
  }

  /**
   * Tìm kiếm quy tắc nhà với context của user (host hoặc guest)
   */
  async searchWithUserContext(query: string, user?: JwtPayload) {
    if (user?.role === 'host') {
      return this.search(query, user._id);
    } else {
      return this.searchPublic(query);
    }
  }
}
