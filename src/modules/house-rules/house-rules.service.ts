import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { FilterQuery, Types } from 'mongoose';
import { HouseRulesRepo } from './house-rules.repo';
import { UserWithPermissions } from '../../interfaces/user-with-permissions.interface';
import { CreateHouseRuleDto } from './dto/create-house-rule.dto';
import { UpdateHouseRuleDto } from './dto/update-house-rule.dto';
import { QueryHouseRuleDto } from './dto/query-house-rule.dto';
import { HouseRule } from './schemas/house-rule.schema';
import {
  IHouseRuleResponse,
  IHouseRule,
} from './interfaces/house-rule.interface';

// Using interface from interfaces folder
// export interface PaginatedHouseRules moved to interfaces/house-rule.interface.ts

@Injectable()
export class HouseRulesService {
  private readonly logger = new Logger(HouseRulesService.name);

  constructor(private readonly houseRulesRepo: HouseRulesRepo) {}

  /**
   * Kiểm tra quyền truy cập (chỉ admin và content_manager có thể quản lý)
   */
  private validateManagePermission(user: UserWithPermissions): void {
    if (
      user.role !== 'admin' &&
      !user.permissions?.includes('house_rule.manage')
    ) {
      throw new ForbiddenException('Bạn không có quyền quản lý quy tắc nhà');
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
   * Tạo quy tắc nhà mới
   */
  async create(
    createDto: CreateHouseRuleDto,
    user: UserWithPermissions,
  ): Promise<HouseRule> {
    this.validateManagePermission(user);

    try {
      const data = {
        ...createDto,
        createdBy: new Types.ObjectId(user._id),
      };

      const houseRule = await this.houseRulesRepo.create(data);
      this.logger.log(
        `House rule created: ${String(houseRule._id)} by user: ${user._id}`,
      );

      return houseRule;
    } catch (error) {
      this.logger.error(
        'Error creating house rule:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể tạo quy tắc nhà');
    }
  }

  /**
   * Lấy tất cả quy tắc nhà với filter và pagination
   */
  async findAll(queryDto?: QueryHouseRuleDto): Promise<IHouseRuleResponse> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        includeDeleted = false,
        search,
        is_active,
      } = queryDto || {};

      const query: FilterQuery<HouseRule> = {
        isDeleted: includeDeleted ? { $in: [true, false] } : false,
      };

      // Apply is_active filter if provided
      if (typeof is_active === 'boolean') {
        query.is_active = is_active;
      }

      // Text search
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      // Build sort object
      const sort: Record<string, 1 | -1> = {
        [sortBy]: sortOrder === 'asc' ? 1 : -1,
      };

      const result = await this.houseRulesRepo.findAll(query, {
        sort,
        limit,
        page,
        includeDeleted,
      });

      return {
        houseRules: result.data as unknown as IHouseRule[],
        meta: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / (limit || 1)),
          hasNext: page < Math.ceil(result.total / (limit || 1)),
          hasPrevious: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(
        'Error finding house rules:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể lấy danh sách quy tắc nhà');
    }
  }

  /**
   * Lấy quy tắc nhà theo ID
   */
  async findOne(id: string): Promise<HouseRule> {
    this.validateObjectId(id);

    const houseRule = await this.houseRulesRepo.findById(id);
    if (!houseRule || houseRule.isDeleted) {
      throw new NotFoundException('Không tìm thấy quy tắc nhà');
    }

    return houseRule;
  }

  /**
   * Cập nhật quy tắc nhà
   */
  async update(
    id: string,
    updateDto: UpdateHouseRuleDto,
    user: UserWithPermissions,
  ): Promise<HouseRule> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    try {
      const existingRule = await this.houseRulesRepo.findById(id);
      if (!existingRule || existingRule.isDeleted) {
        throw new NotFoundException('Không tìm thấy quy tắc nhà');
      }

      const updateData = {
        ...updateDto,
        updatedBy: new Types.ObjectId(user._id),
      };

      const updatedRule = await this.houseRulesRepo.updateById(id, updateData);
      this.logger.log(`House rule updated: ${id} by user: ${user._id}`);

      return updatedRule!;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        'Error updating house rule:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể cập nhật quy tắc nhà');
    }
  }

  /**
   * Xóa mềm quy tắc nhà
   */
  async remove(
    id: string,
    user: UserWithPermissions,
  ): Promise<{ success: boolean }> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    try {
      const existingRule = await this.houseRulesRepo.findById(id);
      if (!existingRule || existingRule.isDeleted) {
        throw new NotFoundException('Không tìm thấy quy tắc nhà');
      }

      await this.houseRulesRepo.softDelete(id, user._id);
      this.logger.log(`House rule soft deleted: ${id} by user: ${user._id}`);

      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        'Error deleting house rule:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể xóa quy tắc nhà');
    }
  }

  /**
   * Khôi phục quy tắc nhà đã xóa
   */
  async restore(id: string, user: UserWithPermissions): Promise<HouseRule> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    try {
      const restoredRule = await this.houseRulesRepo.restore(id, user._id);
      if (!restoredRule) {
        throw new NotFoundException('Không thể khôi phục quy tắc nhà');
      }

      this.logger.log(`House rule restored: ${id} by user: ${user._id}`);
      return restoredRule;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        'Error restoring house rule:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể khôi phục quy tắc nhà');
    }
  }

  /**
   * Toggle trạng thái active/inactive
   */
  async toggleStatus(
    id: string,
    user: UserWithPermissions,
  ): Promise<HouseRule> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    try {
      const existingRule = await this.houseRulesRepo.findById(id);
      if (!existingRule || existingRule.isDeleted) {
        throw new NotFoundException('Không tìm thấy quy tắc nhà');
      }

      const newStatus = !existingRule.is_active;
      const updateData = {
        is_active: newStatus,
        updatedBy: new Types.ObjectId(user._id),
      };

      const updatedRule = await this.houseRulesRepo.updateById(id, updateData);
      this.logger.log(
        `House rule status toggled: ${id} to ${newStatus} by user: ${user._id}`,
      );

      return updatedRule!;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        'Error toggling house rule status:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException(
        'Không thể thay đổi trạng thái quy tắc nhà',
      );
    }
  }

  /**
   * Tìm kiếm quy tắc nhà
   */
  async search(query: string): Promise<{ data: IHouseRule[]; total: number }> {
    if (!query || query.trim().length === 0) {
      return { data: [], total: 0 };
    }

    try {
      const searchResult = await this.houseRulesRepo.search(
        query.trim(),
        ['name', 'description'],
        {
          isDeleted: false,
        },
      );

      return {
        data: searchResult.data as unknown as IHouseRule[],
        total: searchResult.total,
      };
    } catch (error) {
      this.logger.error(
        'Error searching house rules:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể tìm kiếm quy tắc nhà');
    }
  }

  // ==================== LEGACY METHODS FOR BACKWARD COMPATIBILITY ====================

  /**
   * @deprecated Use remove() instead
   */
  async softDelete(id: string, user: UserWithPermissions): Promise<HouseRule> {
    await this.remove(id, user);
    return this.findOne(id);
  }
}
