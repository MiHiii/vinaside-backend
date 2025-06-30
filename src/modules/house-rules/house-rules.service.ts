import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { HouseRulesRepo } from './house-rules.repo';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
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
  private validateManagePermission(user: JwtPayload): void {
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
    user: JwtPayload,
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
   * Lấy tất cả quy tắc nhà cho public (chỉ is_active: true)
   */
  async findAll(queryDto?: QueryHouseRuleDto): Promise<IHouseRuleResponse> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        search,
      } = queryDto || {};

      const result = await this.houseRulesRepo.findAllForPublic({
        page,
        limit,
        sortBy,
        sortOrder,
        search,
      });

      return {
        houseRules: result.data as unknown as IHouseRule[],
        meta: {
          ...result.meta,
          total: result.total,
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
   * Lấy tất cả quy tắc nhà cho admin (mặc định bao gồm cả đã xóa)
   */
  async findAllAdmin(
    queryDto?: QueryHouseRuleDto,
    user?: JwtPayload,
  ): Promise<IHouseRuleResponse> {
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
      } = queryDto || {};

      const result = await this.houseRulesRepo.findAllForAdmin({
        page,
        limit,
        sortBy,
        sortOrder,
        search,
        is_active,
        default_checked,
        includeDeleted,
        isDeleted,
      });

      return {
        houseRules: result.data as unknown as IHouseRule[],
        meta: {
          ...result.meta,
          total: result.total,
        },
      };
    } catch (error) {
      this.logger.error(
        'Error finding house rules for admin:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể lấy danh sách quy tắc nhà');
    }
  }

  /**
   * Lấy tất cả quy tắc nhà cho public (alias for findAll)
   */
  async findAllPublic(
    queryDto?: QueryHouseRuleDto,
  ): Promise<IHouseRuleResponse> {
    return this.findAll(queryDto);
  }

  /**
   * Lấy quy tắc nhà theo ID (Public - chỉ active và default_checked)
   */
  async findOnePublic(id: string): Promise<HouseRule> {
    this.validateObjectId(id);

    const houseRule = await this.houseRulesRepo.findActiveById(id);
    if (!houseRule) {
      throw new NotFoundException('Không tìm thấy quy tắc nhà');
    }

    // Kiểm tra thêm default_checked cho public
    if (!houseRule.default_checked) {
      throw new NotFoundException('Không tìm thấy quy tắc nhà');
    }

    return houseRule;
  }

  /**
   * @deprecated Use findOnePublic() instead
   */
  async findOne(id: string): Promise<HouseRule> {
    return this.findOnePublic(id);
  }

  /**
   * Lấy quy tắc nhà theo ID cho admin (mặc định lấy tất cả trạng thái)
   */
  async findOneAdmin(
    id: string,
    user: JwtPayload,
    includeDeleted = true,
  ): Promise<HouseRule> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    const houseRule = await this.houseRulesRepo.findByIdForAdmin(
      id,
      includeDeleted,
    );
    if (!houseRule) {
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
    user: JwtPayload,
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
  async remove(id: string, user: JwtPayload): Promise<{ success: boolean }> {
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
  async restore(id: string, user: JwtPayload): Promise<HouseRule> {
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
  async toggleStatus(id: string, user: JwtPayload): Promise<HouseRule> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    try {
      const updatedRule = await this.houseRulesRepo.toggleStatus(id, user._id);
      if (!updatedRule) {
        throw new NotFoundException('Không tìm thấy quy tắc nhà');
      }

      this.logger.log(
        `House rule status toggled: ${id} to ${updatedRule.is_active} by user: ${user._id}`,
      );

      return updatedRule;
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
   * Toggle trạng thái default_checked
   */
  async toggleDefaultChecked(id: string, user: JwtPayload): Promise<HouseRule> {
    this.validateManagePermission(user);
    this.validateObjectId(id);

    try {
      const updatedRule = await this.houseRulesRepo.toggleDefaultChecked(
        id,
        user._id,
      );
      if (!updatedRule) {
        throw new NotFoundException('Không tìm thấy quy tắc nhà');
      }

      this.logger.log(
        `House rule default_checked toggled: ${id} to ${updatedRule.default_checked} by user: ${user._id}`,
      );

      return updatedRule;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        'Error toggling house rule default_checked:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException(
        'Không thể thay đổi trạng thái default_checked của quy tắc nhà',
      );
    }
  }

  /**
   * Tìm kiếm quy tắc nhà cho admin (mặc định search tất cả trạng thái)
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
  ): Promise<{ data: IHouseRule[]; total: number }> {
    this.validateManagePermission(user);

    try {
      // Mặc định admin search tất cả trạng thái nếu không specify includeDeleted
      const defaultFilters = {
        includeDeleted: true,
        ...filters,
      };

      const searchResult = await this.houseRulesRepo.searchAdmin(
        query,
        defaultFilters,
      );

      return {
        data: searchResult.data as unknown as IHouseRule[],
        total: searchResult.total,
      };
    } catch (error) {
      this.logger.error(
        'Error searching house rules for admin:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Không thể tìm kiếm quy tắc nhà');
    }
  }

  // ==================== LEGACY METHODS FOR BACKWARD COMPATIBILITY ====================

  /**
   * @deprecated Use remove() instead
   */
  async softDelete(id: string, user: JwtPayload): Promise<HouseRule> {
    await this.remove(id, user);
    return this.findOne(id);
  }
}
