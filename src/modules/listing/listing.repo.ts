import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Model,
  Types,
  FilterQuery,
  PopulateOptions,
  SortOrder,
} from 'mongoose';
import { Listing, ListingStatus } from './schemas/listing.schema';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

interface FindAllOptions {
  sort?: Record<string, SortOrder>;
  skip?: number;
  limit?: number;
  populate?: PopulateOptions | (string | PopulateOptions)[];
}

@Injectable()
export class ListingRepo {
  private readonly logger = new Logger(ListingRepo.name);

  constructor(
    @InjectModel(Listing.name) private readonly listingModel: Model<Listing>,
  ) {}

  async create(createDto: CreateListingDto, userId: string): Promise<Listing> {
    const { propertyId, ...restOfDto } = createDto;
    const newListing = new this.listingModel({
      ...restOfDto,
      propertyId: new Types.ObjectId(propertyId),
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });
    return newListing.save();
  }

  async findById(
    id: string,
    populate?: PopulateOptions | (string | PopulateOptions)[],
  ): Promise<Listing | null> {
    if (!Types.ObjectId.isValid(id)) {
      this.logger.warn(`Invalid listing ID: ${id}`);
      return null;
    }
    const query = this.listingModel.findById(id);
    if (populate) {
      query.populate(populate);
    }
    return query.exec();
  }

  async findAll(query: FilterQuery<Listing>, options: FindAllOptions = {}) {
    const { sort, skip, limit, populate } = options;

    const dataQuery = this.listingModel.find(query);

    if (sort) dataQuery.sort(sort);
    if (skip) dataQuery.skip(skip);
    if (limit) dataQuery.limit(limit);
    if (populate) dataQuery.populate(populate);

    const [total, data] = await Promise.all([
      this.listingModel.countDocuments(query),
      dataQuery.exec(),
    ]);

    return { data, total };
  }

  async updateById(
    id: string,
    updateDto: UpdateListingDto,
    userId: string,
  ): Promise<Listing | null> {
    return this.listingModel
      .findByIdAndUpdate(
        id,
        { ...updateDto, updatedBy: new Types.ObjectId(userId) },
        { new: true },
      )
      .exec();
  }

  async softDelete(id: string, userId: string): Promise<Listing | null> {
    return this.listingModel
      .findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: new Types.ObjectId(userId),
        },
        { new: true },
      )
      .exec();
  }

  async restore(id: string): Promise<Listing | null> {
    return this.listingModel
      .findByIdAndUpdate(
        id,
        { isDeleted: false, $unset: { deletedAt: 1, deletedBy: 1 } },
        { new: true },
      )
      .exec();
  }

  async updateStatus(
    id: string,
    status: ListingStatus,
    userId: string,
  ): Promise<Listing | null> {
    return this.listingModel
      .findByIdAndUpdate(
        id,
        { status, updatedBy: new Types.ObjectId(userId) },
        { new: true },
      )
      .exec();
  }

  /**
   * Tăng số lượt xem của listing
   */
  async incrementViewCount(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      this.logger.warn(`Invalid listing ID for view count increment: ${id}`);
      return;
    }

    await this.listingModel
      .findByIdAndUpdate(id, { $inc: { viewCount: 1 } }, { new: false })
      .exec();
  }
}
