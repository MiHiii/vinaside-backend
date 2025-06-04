import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  createEntity,
  updateEntity,
  softDelete,
  findEntity,
  findAllEntity,
  restoreEntity,
  searchEntity,
} from 'src/utils/db.util';

import { HouseRule, HouseRuleDocument } from './schemas/house-rule.schema';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { CreateHouseRuleDto } from './dto/create-house-rule.dto';
import { UpdateHouseRuleDto } from './dto/update-house-rule.dto';

@Injectable()
export class HouseRulesService {
  constructor(
    @InjectModel(HouseRule.name)
    private houseRuleModel: Model<HouseRuleDocument>,
  ) {}

  /**
   * Kiểm tra user có phải host không
   */
  private validateHost(user: JwtPayload): void {
    if (user.role !== 'host') {
      throw new UnauthorizedException('Only hosts can create house rules');
    }
  }

  /**
   * Tạo quy tắc nhà mới (chỉ host)
   */
  async create(createDto: CreateHouseRuleDto, user: JwtPayload) {
    this.validateHost(user);
    return createEntity('HouseRule', this.houseRuleModel, createDto, user);
  }

  /**
   * Lấy tất cả quy tắc nhà của host hiện tại
   */
  async findAll(query = {}, options = {}) {
    try {
      return await findAllEntity(
        'HouseRule',
        this.houseRuleModel,
        query,
        options,
      );
    } catch (error) {
      return error instanceof NotFoundException
        ? []
        : Promise.reject(new Error('Database error'));
    }
  }

  /**
   * Lấy quy tắc nhà theo ID (với kiểm tra ownership nếu có userId)
   */
  async findOne(id: string, userId?: string) {
    if (userId) {
      // Sử dụng findAllEntity với filter để kiểm tra ownership
      try {
        const results = await findAllEntity(
          'HouseRule',
          this.houseRuleModel,
          { _id: id, createdBy: userId },
          { limit: 1 },
        );
        return results[0];
      } catch {
        throw new NotFoundException(
          'HouseRule not found or you do not have permission to access it',
        );
      }
    }
    return findEntity('HouseRule', this.houseRuleModel, id);
  }

  /**
   * Cập nhật quy tắc nhà (với kiểm tra ownership)
   */
  async update(id: string, updateDto: UpdateHouseRuleDto, user: JwtPayload) {
    await this.findOne(id, user._id); // Kiểm tra ownership
    return updateEntity('HouseRule', this.houseRuleModel, id, updateDto, user);
  }

  async softDelete(id: string, user: JwtPayload) {
    await this.findOne(id, user._id); // Kiểm tra ownership
    return softDelete('HouseRule', this.houseRuleModel, id, user);
  }

  /**
   * Khôi phục quy tắc nhà (với kiểm tra ownership)
   */
  async restore(id: string, user: JwtPayload) {
    // Kiểm tra ownership cho deleted record
    try {
      await findAllEntity(
        'HouseRule',
        this.houseRuleModel,
        { _id: id, createdBy: user._id },
        { includeDeleted: true, limit: 1 },
      );
    } catch {
      throw new NotFoundException(
        'HouseRule not found, not deleted, or you do not have permission to restore it',
      );
    }
    return restoreEntity('HouseRule', this.houseRuleModel, id, user);
  }

  /**
   * Tìm kiếm quy tắc nhà (với filter theo user)
   */
  async search(query: string, userId?: string) {
    if (!query?.trim()) return [];

    const userFilter = userId ? { createdBy: userId } : {};

    try {
      return await searchEntity(
        'HouseRule',
        this.houseRuleModel,
        query,
        ['name', 'description'],
        { sort: { createdAt: -1 } },
        userFilter,
      );
    } catch {
      return [];
    }
  }
}
