import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  createEntity,
  updateEntity,
  softDelete,
  findEntity,
  findAllEntity,
} from 'src/utils/db.util';

import { HouseRule, HouseRuleDocument } from './schemas/house-rule.schema';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { CreateHouseRuleDto } from './dto/create-house-rule.dto';
import { UpdateHouseRuleDto } from './dto/update-house-rule.dto';

@Injectable()
export class HouseRulesService {
  constructor(
    @InjectModel(HouseRule.name) private HouseRuleModel: Model<HouseRuleDocument>,
  ) {}

  /**
   * Tạo một quy tắc nhà mới
   */
  async create(createDto: CreateHouseRuleDto, user: JwtPayload) {
    return createEntity<HouseRuleDocument, CreateHouseRuleDto>(
      'HouseRule', 
      this.HouseRuleModel, 
      createDto, 
      user);
  }

  /**
   * Tìm tất cả các quy tắc nhà theo điều kiện
   */
  async findAll(query = {}, options = {}) {
    return findAllEntity<HouseRuleDocument>(
      'HouseRule', 
      this.HouseRuleModel, 
      query, 
      options);
  }

  /**
   * Tìm một quy tắc nhà theo ID
   */
  async findOne(id: string) {
    return findEntity<HouseRuleDocument>(
      'HouseRule', 
      this.HouseRuleModel, 
      id);
  }

  /**
   * Cập nhật thông tin quy tắc nhà
   */
  async update(id: string, updateDto: UpdateHouseRuleDto, user: JwtPayload) {
    return updateEntity<HouseRuleDocument, UpdateHouseRuleDto>(
      'HouseRule', 
      this.HouseRuleModel, 
      id, 
      updateDto, 
      user);
  }

  /**
   * Xóa mềm một quy tắc nhà
   */
  async softDelete(id: string, user: JwtPayload) {
    return softDelete<HouseRuleDocument>(
      'HouseRule', 
      this.HouseRuleModel, 
      id, 
      user);
  }
}