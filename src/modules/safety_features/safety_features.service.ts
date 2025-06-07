import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateSafetyFeatureDto } from './dto/create-safety_feature.dto';
import { UpdateSafetyFeatureDto } from './dto/update-safety_feature.dto';
import { InjectModel } from '@nestjs/mongoose';
import {
  SafetyFeature,
  SafetyFeatureDocument,
} from './schemas/safety_feature.schema';
import { Model } from 'mongoose';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import {
  createEntity,
  findAllEntity,
  softDelete,
  updateEntity,
  restoreEntity,
  searchEntity,
} from 'src/utils/db.util';

@Injectable()
export class SafetyFeaturesService {

  constructor(
    @InjectModel(SafetyFeature.name)
    private safetyFeatureModel: Model<SafetyFeatureDocument>,
  ) {}

  private validateHost(user: JwtPayload): void {
    if (user.role !== 'host') {
      throw new UnauthorizedException('Only hosts can manage amenities');
    }
  }

  async create(
    createSafetyFeatureDto: CreateSafetyFeatureDto,
    user: JwtPayload,
  ) {
    this.validateHost(user);
    return createEntity(
      'SafetyFeature',
      this.safetyFeatureModel,
      createSafetyFeatureDto,
      user,
    );
  }

  async findAll(query = {}, options = {}) {
    try {
      return await findAllEntity(
        'SafetyFeature',
        this.safetyFeatureModel,
        query,
        options,
      );
    } catch (error) {
      return error instanceof NotFoundException
        ? []
        : Promise.reject(new Error('Database error'));
    }
  }

  async findOne(id: string, userId?: string) {
    if (userId) {
      try {
        const results = await findAllEntity(
          'SafetyFeature',
          this.safetyFeatureModel,
          { _id: id, createdBy: userId },
          { limit: 1 },
        );
        return results[0];
      } catch {
        throw new NotFoundException(
          'Safety feature not found or you do not have permission to access it',
        );
      }
    }
  }

  async update(
    id: string,
    updateSafetyFeatureDto: UpdateSafetyFeatureDto,
    user: JwtPayload,
  ) {
    this.validateHost(user);
    return updateEntity(
      'SafetyFeature',
      this.safetyFeatureModel,
      id,
      updateSafetyFeatureDto,
      user,
    );
  }

  async softDelete(id: string, user: JwtPayload) {
    await this.findOne(id, user._id);
    return softDelete('SafetyFeature', this.safetyFeatureModel, id, user);
  }

  async restore(id: string, user: JwtPayload) {
    this.validateHost(user);
    try {
      await findAllEntity(
        'SafetyFeature',
        this.safetyFeatureModel,
        { _id: id, createdBy: user._id },
        { includeDeleted: true, limit: 1 },
      );
    } catch {
      throw new NotFoundException(
        'Safety feature not found, not deleted, or you do not have permission to restore it',
      );
    }
    return restoreEntity('SafetyFeature', this.safetyFeatureModel, id, user);
  }

  async search(query: string, userId?: string, additionalFilter = {}) {
    if (!query?.trim()) return [];

    const userFilter = userId ? { createdBy: userId } : {};
    const finalFilter = { ...userFilter, ...additionalFilter };

    try {
      return await searchEntity(
        'SafetyFeature',
        this.safetyFeatureModel,
        query,
        ['name', 'description'],
        { sort: { createdAt: -1 } },
        finalFilter,
      );
    } catch {
      return [];
    }
  }
}
