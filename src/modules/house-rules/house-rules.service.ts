import { Injectable, NotFoundException } from '@nestjs/common';
import { HouseRulesRepo } from './house-rules.repo';

@Injectable()
export class HouseRulesService {
  constructor(private readonly houseRulesRepo: HouseRulesRepo) {}

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
  async findOne(id: string) {
    const houseRule = await this.houseRulesRepo.findById(id);
    if (!houseRule) {
      throw new NotFoundException('Không tìm thấy quy tắc nhà');
    }
    return houseRule;
  }

  /**
   * Tìm kiếm quy tắc nhà với context của user (staff hoặc guest)
   */
  async search(query: string): Promise<any> {
    // Simple search implementation
    return await this.houseRulesRepo.search(query);
  }
}
