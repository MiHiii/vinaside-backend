import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Property, PropertyDocument } from '../schemas/property.schema';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { QueryPropertyDto } from '../dto/query-property.dto';
import { JwtPayload } from '../../../interfaces/jwt-payload.interface';

export interface PaginatedProperties {
  data: Property[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class PropertyService {
  constructor(
    @InjectModel(Property.name)
    private propertyModel: Model<PropertyDocument>,
  ) {}

  async create(
    createPropertyDto: CreatePropertyDto,
    user: JwtPayload,
  ): Promise<Property> {
    const propertyData = {
      ...createPropertyDto,
      createdBy: new Types.ObjectId(user._id),
      staffIds:
        createPropertyDto.staffIds?.map((id) => new Types.ObjectId(id)) || [],
    };

    const property = new this.propertyModel(propertyData);
    return property.save();
  }

  async findAll(queryDto: QueryPropertyDto): Promise<PaginatedProperties> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      ...filters
    } = queryDto;
    const skip = (page - 1) * limit;

    // Build filter object with proper typing
    const filterQuery: FilterQuery<PropertyDocument> = { isDeleted: false };

    if (filters.keyword) {
      filterQuery.$text = { $search: filters.keyword };
    }

    if (filters.type) {
      filterQuery.type = filters.type;
    }

    if (filters.status) {
      filterQuery.status = filters.status;
    }

    if (filters.isVerified !== undefined) {
      filterQuery.isVerified = filters.isVerified;
    }

    if (filters.city) {
      filterQuery['location.city'] = new RegExp(filters.city, 'i');
    }

    if (filters.district) {
      filterQuery['location.district'] = new RegExp(filters.district, 'i');
    }

    if (filters.name && typeof filters.name === 'string') {
      const nameValue = filters.name as string;
      if (nameValue.trim()) {
        filterQuery.name = { $regex: nameValue, $options: 'i' };
      }
    }

    // Geospatial search
    if (filters.lat && filters.lng && filters.radius) {
      filterQuery['location.lat'] = {
        $gte: filters.lat - filters.radius / 111, // Approximate conversion
        $lte: filters.lat + filters.radius / 111,
      };
      filterQuery['location.lng'] = {
        $gte:
          filters.lng -
          filters.radius / (111 * Math.cos((filters.lat * Math.PI) / 180)),
        $lte:
          filters.lng +
          filters.radius / (111 * Math.cos((filters.lat * Math.PI) / 180)),
      };
    }

    // Build sort object with proper typing
    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.propertyModel
        .find(filterQuery)
        .populate('staffIds', 'name email')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.propertyModel.countDocuments(filterQuery),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / (limit || 1)),
    };
  }

  async findOne(id: string): Promise<Property> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Định dạng ID tài sản không hợp lệ');
    }

    const property = await this.propertyModel
      .findOne({ _id: id, isDeleted: false })
      .populate('staffIds', 'name email phone')
      .exec();

    if (!property) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    return property;
  }

  async findByStaff(
    staffId: string,
    queryDto: QueryPropertyDto,
  ): Promise<PaginatedProperties> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryDto;
    const skip = (page - 1) * limit;

    const filterQuery: FilterQuery<PropertyDocument> = {
      isDeleted: false,
      staffIds: new Types.ObjectId(staffId),
    };

    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.propertyModel
        .find(filterQuery)
        .populate('staffIds', 'name email')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.propertyModel.countDocuments(filterQuery),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / (limit || 1)),
    };
  }

  async update(
    id: string,
    updatePropertyDto: UpdatePropertyDto,
  ): Promise<Property> {
    // Create a mutable update object
    const updateData: { [key: string]: any } = { ...updatePropertyDto };

    // Convert staffIds to ObjectIds if provided
    if (updateData.staffIds && Array.isArray(updateData.staffIds)) {
      updateData.staffIds = (updateData.staffIds as string[]).map(
        (staffId) => new Types.ObjectId(staffId),
      );
    }

    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('staffIds', 'name email')
      .exec();

    if (!updatedProperty) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    return updatedProperty;
  }

  async remove(id: string): Promise<void> {
    await this.propertyModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });
  }

  async restore(id: string, user: JwtPayload): Promise<Property> {
    // Only admin can restore
    if (user.role !== 'admin') {
      throw new ForbiddenException('Chỉ admin mới có thể khôi phục tài sản');
    }

    const property = await this.propertyModel
      .findByIdAndUpdate(
        id,
        {
          isDeleted: false,
          $unset: { deletedAt: 1 },
        },
        { new: true },
      )
      .populate('staffIds', 'name email')
      .exec();

    if (!property) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    return property;
  }

  async verify(id: string, isVerified: boolean): Promise<Property> {
    const property = await this.propertyModel
      .findByIdAndUpdate(id, { isVerified }, { new: true })
      .populate('staffIds', 'name email')
      .exec();

    if (!property) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    return property;
  }

  async updateStatus(id: string, status: string): Promise<Property> {
    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .populate('staffIds', 'name email')
      .exec();

    if (!updatedProperty) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    return updatedProperty;
  }

  async assignStaff(id: string, staffIds: string[]): Promise<Property> {
    const objectIdStaffIds = staffIds.map((id) => new Types.ObjectId(id));

    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, { staffIds: objectIdStaffIds }, { new: true })
      .populate('staffIds', 'name email')
      .exec();

    if (!updatedProperty) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    return updatedProperty;
  }

  async findNearby(
    lat: number,
    lng: number,
    radius: number = 10,
    queryDto: Omit<QueryPropertyDto, 'lat' | 'lng' | 'radius'> = {},
  ): Promise<Property[]> {
    return this.findAll({ ...queryDto, lat, lng, radius }).then(
      (result) => result.data,
    );
  }

  async getStats() {
    const [total, active, pending, verified, byType] = await Promise.all([
      this.propertyModel.countDocuments({ isDeleted: false }),
      this.propertyModel.countDocuments({ isDeleted: false, status: 'active' }),
      this.propertyModel.countDocuments({
        isDeleted: false,
        status: 'pending',
      }),
      this.propertyModel.countDocuments({ isDeleted: false, isVerified: true }),
      this.propertyModel.aggregate<{ _id: string; count: number }>([
        { $match: { isDeleted: false } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      total,
      active,
      pending,
      verified,
      byType: byType.reduce(
        (acc, item) => {
          acc[item._id] = item.count;
          return acc;
        },
        {} as { [key: string]: number },
      ),
    };
  }

  // ================== PUBLIC UTILITY METHODS FOR OTHER SERVICES ==================

  /**
   * Kiểm tra user có phải staff của property không
   */
  async isUserStaffOfProperty(
    propertyId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const property = await this.findOne(propertyId);

      interface PopulatedStaff {
        _id?: Types.ObjectId;
        toString?: () => string;
      }

      interface PopulatedProperty {
        staffIds: PopulatedStaff[];
      }
      const p = property as unknown as PopulatedProperty;

      const isStaff =
        p.staffIds?.some((staff) => {
          // Handle both populated objects and ObjectIds
          const staffIdStr = staff?._id
            ? staff._id.toString()
            : staff && typeof staff.toString === 'function'
              ? staff.toString()
              : '';
          return staffIdStr === userId;
        }) || false;

      return isStaff;
    } catch {
      return false;
    }
  }

  /**
   * Lấy danh sách property IDs mà user được gán làm staff
   */
  async getStaffPropertyIds(staffId: string): Promise<string[]> {
    try {
      const staffProperties = await this.findByStaff(staffId, {});
      interface PropertyWithId {
        _id: Types.ObjectId;
      }
      return staffProperties.data.map((prop) =>
        (prop as unknown as PropertyWithId)._id.toString(),
      );
    } catch {
      return [];
    }
  }
}
