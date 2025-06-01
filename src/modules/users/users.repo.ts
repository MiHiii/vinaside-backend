import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PopulateOptions, UpdateQuery } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UserRepo {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  /**
   * Tìm người dùng theo ID
   */
  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  /**
   * Tìm người dùng theo email
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  /**
   * Tạo người dùng mới
   */
  async create(data: Partial<User>): Promise<UserDocument> {
    const user = new this.userModel(data);
    return user.save();
  }

  /**
   * Cập nhật thông tin người dùng theo ID
   */
  async updateById(
    id: string,
    updateData: UpdateQuery<User>,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  /**
   * Đánh dấu xóa người dùng (soft delete)
   */
  async softDelete(id: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          deletedAt: new Date(),
        },
        { new: true },
      )
      .exec();
  }

  /**
   * Tìm tất cả người dùng với phân trang và lọc
   */
  async findAll(
    query: FilterQuery<UserDocument> = {},
    options: {
      page?: number;
      limit?: number;
      sort?: Record<string, 1 | -1>;
      select?: string;
      populate?: PopulateOptions | (string | PopulateOptions)[];
    } = {},
  ): Promise<{
    data: UserDocument[];
    total: number;
  }> {
    const { page = 1, limit = 10, sort, select, populate } = options;
    const skip = (page - 1) * limit;

    // Thêm filter loại bỏ các tài khoản bị xóa
    const finalQuery = {
      ...query,
      isDeleted: { $ne: true },
    };

    // Đếm tổng số bản ghi
    const total = await this.userModel.countDocuments(finalQuery);

    // Thực thi query
    const data = await this.userModel
      .find(finalQuery)
      .limit(limit)
      .skip(skip)
      .sort(sort || { createdAt: -1 })
      .select(select || '')
      .populate(populate || [])
      .exec();

    return {
      data,
      total,
    };
  }

  /**
   * Đếm số lượng người dùng với filter
   */
  async countUsers(filter: FilterQuery<User> = {}): Promise<number> {
    return this.userModel.countDocuments(filter).exec();
  }
}
