import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  Document,
  Model,
  FilterQuery,
  UpdateQuery,
  QueryOptions,
  Types,
  SortOrder,
} from 'mongoose';

@Injectable()
export abstract class BaseRepo<T extends Document> {
  protected readonly logger: Logger;

  constructor(protected readonly model: Model<T>) {
    this.logger = new Logger(this.constructor.name);
  }

  async create(doc: Record<string, any>, userId?: string): Promise<T> {
    try {
      const docWithUser = {
        ...doc,
        createdBy: userId ? new Types.ObjectId(userId) : undefined,
        updatedBy: userId ? new Types.ObjectId(userId) : undefined,
      };
      const createdDocument = new this.model(docWithUser);
      return await createdDocument.save();
    } catch (error) {
      this.logger.error(`Error creating document: ${error}`);
      throw new InternalServerErrorException('Could not create document.');
    }
  }
  async findById(id: string, options?: QueryOptions): Promise<T | null> {
    return this.model.findById(id, null, options).exec();
  }

  async findOne(
    filter: FilterQuery<T>,
    options?: QueryOptions,
  ): Promise<T | null> {
    return this.model.findOne(filter, null, options).exec();
  }

  async findAll(
    filter: FilterQuery<T> = {},
    options?: QueryOptions & {
      skip?: number;
      limit?: number;
      sort?: Record<string, SortOrder>;
      populate?: any;
    },
  ): Promise<{ data: T[]; total: number }> {
    let query = this.model.find(filter);

    // Apply options
    if (options?.skip) query = query.skip(options.skip);
    if (options?.limit) query = query.limit(options.limit);
    if (options?.sort) query = query.sort(options.sort);
    if (options?.populate) {
      if (Array.isArray(options.populate)) {
        options.populate.forEach((populateOption) => {
          query = query.populate(populateOption);
        });
      } else {
        query = query.populate(options.populate);
      }
    }

    const [data, total] = await Promise.all([
      query.exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { data, total };
  }

  async updateById(
    id: string,
    update: UpdateQuery<T>,
    userId?: string,
  ): Promise<T | null> {
    console.log('[DEBUG] BaseRepo.updateById called with:', {
      id,
      update,
      userId,
    });

    const updateWithUser = {
      ...update,
      updatedBy: userId ? new Types.ObjectId(userId) : undefined,
    };

    console.log('[DEBUG] BaseRepo.updateById updateWithUser:', updateWithUser);

    const result = await this.model
      .findByIdAndUpdate(id, updateWithUser, { new: true })
      .exec();

    console.log('[DEBUG] BaseRepo.updateById result:', result);

    return result;
  }

  async softDelete(id: string, userId: string): Promise<T | null> {
    const update = {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: new Types.ObjectId(userId),
    } as UpdateQuery<T>;
    return this.model.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async restore(id: string, userId?: string): Promise<T | null> {
    const update = {
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      updatedBy: userId ? new Types.ObjectId(userId) : undefined,
    } as UpdateQuery<T>;
    return this.model.findByIdAndUpdate(id, update, { new: true }).exec();
  }
}
