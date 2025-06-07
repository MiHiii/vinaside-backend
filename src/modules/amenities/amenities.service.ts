import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { UpdateAmenityDto } from './dto/update-amenity.dto';
import { Amenity, AmenityDocument } from './schemas/amenity.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import {
  createEntity,
  findAllEntity,
  findEntity,
  updateEntity,
  softDelete,
  restoreEntity,
  searchEntity,
} from 'src/utils/db.util';

@Injectable()
export class AmenitiesService {
  constructor(
    @InjectModel(Amenity.name)
    private amenityModel: Model<AmenityDocument>,
  ) {}

  private validateHost(user: JwtPayload): void {
    if (user.role !== 'host') {
      throw new UnauthorizedException('Only hosts can manage amenities');
    }
  }

  /**
   * Tạo tiện ích mới
   * @param createAmenityDto
   * @returns
   */
  async create(createAmenityDto: CreateAmenityDto, user: JwtPayload) {
    this.validateHost(user);
    return createEntity('Amenity', this.amenityModel, createAmenityDto, user);
  }

  /**
   * Lấy tất cả tiện ích
   * @param query
   * @param options
   * @returns
   */
  async findAll(query = {}, options = {}) {
    try {
      return await findAllEntity('Amenity', this.amenityModel, query, options);
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
          'Amenity',
          this.amenityModel,
          { _id: id, createdBy: userId },
          { limit: 1 },
        );
        return results[0];
      } catch {
        throw new NotFoundException(
          'Amenity not found or you do not have permission to access it',
        );
      }
    }
    return findEntity('Amenity', this.amenityModel, id);
  }

  async update(
    id: string,
    updateAmenityDto: UpdateAmenityDto,
    user: JwtPayload,
  ) {
    await this.findOne(id, user._id); // Kiểm tra ownership
    return updateEntity(
      'Amenity',
      this.amenityModel,
      id,
      updateAmenityDto,
      user,
    );
  }

  async softDelete(id: string, user: JwtPayload) {
    await this.findOne(id, user._id); // Kiểm tra ownership
    return softDelete('Amenity', this.amenityModel, id, user);
  }

  async restore(id: string, user: JwtPayload) {
    this.validateHost(user);
    // Kiểm tra ownership cho deleted record
    try {
      await findAllEntity(
        'Amenity',
        this.amenityModel,
        { _id: id, createdBy: user._id },
        { includeDeleted: true, limit: 1 },
      );
    } catch {
      throw new NotFoundException(
        'Amenity not found, not deleted, or you do not have permission to restore it',
      );
    }
    return restoreEntity('Amenity', this.amenityModel, id, user);
  }

  async search(query: string, userId?: string, additionalFilter = {}) {
    if (!query?.trim()) return [];

    const userFilter = userId ? { createdBy: userId } : {};
    const finalFilter = { ...userFilter, ...additionalFilter };

    try {
      return await searchEntity(
        'Amenity',
        this.amenityModel,
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
