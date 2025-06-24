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
import { UserWithPermissions } from '../../../interfaces/user-with-permissions.interface';

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

  private checkPermission(
    property: Property,
    user: UserWithPermissions,
    message: string = 'You do not have permission to perform this action',
  ) {
    if (user.role === 'admin') {
      return;
    }

    // Define an interface to help TypeScript understand the shape of the populated object
    interface PopulatedProperty {
      ownerId: { toString: () => string };
      staffIds: { toString: () => string }[];
    }

    const p = property as unknown as PopulatedProperty;

    const isOwner = p.ownerId?.toString() === user._id;
    const isStaff =
      p.staffIds && p.staffIds.some((id) => id?.toString() === user._id);

    if (!isOwner && !isStaff) {
      throw new ForbiddenException(message);
    }
  }

  async create(
    createPropertyDto: CreatePropertyDto,
    user: UserWithPermissions,
  ): Promise<Property> {
    const propertyData = {
      ...createPropertyDto,
      ownerId: new Types.ObjectId(user._id),
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

    if (filters.ownerId) {
      filterQuery.ownerId = new Types.ObjectId(filters.ownerId);
    }

    if (filters.city) {
      filterQuery['location.city'] = new RegExp(filters.city, 'i');
    }

    if (filters.district) {
      filterQuery['location.district'] = new RegExp(filters.district, 'i');
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
        .populate('ownerId', 'name email')
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
      throw new NotFoundException('Invalid property ID format');
    }

    const property = await this.propertyModel
      .findOne({ _id: id, isDeleted: false })
      .populate('ownerId', 'name email phone')
      .populate('staffIds', 'name email phone')
      .exec();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return property;
  }

  async findByOwner(
    ownerId: string,
    queryDto: QueryPropertyDto,
  ): Promise<PaginatedProperties> {
    return this.findAll({ ...queryDto, ownerId });
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
        .populate('ownerId', 'name email')
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
    user: UserWithPermissions,
  ): Promise<Property> {
    const property = await this.findOne(id);
    this.checkPermission(
      property,
      user,
      'You can only update your own properties',
    );

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
      .populate('ownerId', 'name email')
      .populate('staffIds', 'name email')
      .exec();

    if (!updatedProperty) {
      throw new NotFoundException('Property not found');
    }

    return updatedProperty;
  }

  async remove(id: string, user: UserWithPermissions): Promise<void> {
    const property = await this.findOne(id);
    this.checkPermission(
      property,
      user,
      'You can only delete your own properties',
    );

    await this.propertyModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });
  }

  async restore(id: string, user: UserWithPermissions): Promise<Property> {
    // Only admin can restore
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only admin can restore properties');
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
      .populate('ownerId', 'name email')
      .populate('staffIds', 'name email')
      .exec();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return property;
  }

  async verify(id: string, isVerified: boolean): Promise<Property> {
    const property = await this.propertyModel
      .findByIdAndUpdate(id, { isVerified }, { new: true })
      .populate('ownerId', 'name email')
      .exec();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return property;
  }

  async updateStatus(
    id: string,
    status: string,
    user: UserWithPermissions,
  ): Promise<Property> {
    const property = await this.findOne(id);
    this.checkPermission(property, user, 'You can only update property status');

    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .populate('ownerId', 'name email')
      .populate('staffIds', 'name email')
      .exec();

    if (!updatedProperty) {
      throw new NotFoundException('Property not found');
    }

    return updatedProperty;
  }

  async assignStaff(
    id: string,
    staffIds: string[],
    user: UserWithPermissions,
  ): Promise<Property> {
    const property = await this.findOne(id);
    // Only owner or admin can assign staff
    this.checkPermission(
      property,
      user,
      'You can only manage your own properties',
    );

    const objectIdStaffIds = staffIds.map((id) => new Types.ObjectId(id));

    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, { staffIds: objectIdStaffIds }, { new: true })
      .populate('ownerId', 'name email')
      .populate('staffIds', 'name email')
      .exec();

    if (!updatedProperty) {
      throw new NotFoundException('Property not found');
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
}
