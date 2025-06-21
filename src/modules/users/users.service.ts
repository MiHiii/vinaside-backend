import { Injectable, NotFoundException } from '@nestjs/common';
import { FilterQuery, PopulateOptions } from 'mongoose';
import { UserDocument } from './schemas/user.schema';
import { compare } from 'bcryptjs';
import { UserRepo } from './users.repo';
import { QueryUserDto } from './dto/query-user.dto';
import { buildSearchFilter, parseSortString } from 'src/utils/common.util';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly userRepo: UserRepo) {}

  /**
   * Tạo người dùng mới và trả về dữ liệu định dạng
   */
  async createUser(createUserDto: CreateUserDto) {
    const user = await this.create(createUserDto);
    return { data: user };
  }

  /**
   * Tìm người dùng theo ID và trả về dữ liệu định dạng
   */
  async findOne(id: string) {
    const user = await this.findById(id);
    return { data: user };
  }

  /**
   * Cập nhật toàn bộ thông tin người dùng (PUT)
   */
  async updateFull(id: string, updateUserDto: UpdateUserDto) {
    // Validation đã được xử lý ở DTO
    // Có thể thêm validation bổ sung cho PUT (yêu cầu đầy đủ các trường)
    const user = await this.updateUser(id, updateUserDto);
    return { data: user };
  }

  /**
   * Cập nhật một phần thông tin người dùng (PATCH)
   */
  async updatePartial(id: string, updateUserDto: UpdateUserDto) {
    // Validation đã được xử lý ở DTO
    const user = await this.updateUser(id, updateUserDto);
    return { data: user };
  }

  /**
   * Chuyển đổi trạng thái người dùng và trả về dữ liệu định dạng
   */
  async toggleStatus(id: string) {
    const user = await this.toggleUserStatus(id);
    return { data: user };
  }

  /**
   * Xóa người dùng và trả về dữ liệu định dạng
   */
  async delete(id: string) {
    await this.deleteUserById(id);
    return { success: true };
  }

  /**
   * Đếm số lượng người dùng và trả về dữ liệu định dạng
   */
  async count() {
    const count = await this.countUsers();
    return { data: { count } };
  }

  /**
   * Tạo người dùng mới
   */
  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    return this.userRepo.create(createUserDto);
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
    users: UserDocument[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 10 } = options;

    // Gọi repository để lấy dữ liệu
    const { data, total } = await this.userRepo.findAll(query, options);

    // Trả về kết quả định dạng chuẩn RESTful
    return {
      users: data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Tìm người dùng theo tên đăng nhập
   */
  async findOneByUsername(username: string): Promise<UserDocument | null> {
    return this.userRepo.findByEmail(username);
  }

  /**
   * Tìm người dùng theo email
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userRepo.findByEmail(email);
  }

  /**
   * Kiểm tra mật khẩu
   */
  async isValidPassword(password: string, hash: string): Promise<boolean> {
    return await compare(password, hash);
  }

  /**
   * Tìm người dùng theo ID
   */
  async findById(id: string): Promise<UserDocument | null> {
    return this.userRepo.findById(id);
  }

  /**
   * Xác minh tài khoản người dùng
   */
  async verifyUser(userId: string): Promise<void> {
    const updated = await this.userRepo.updateById(userId, {
      is_verified: true,
    });

    if (!updated) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
  }

  /**
   * Cập nhật mật khẩu người dùng
   */
  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    const updated = await this.userRepo.updateById(userId, {
      password_hash: newPasswordHash,
    });

    if (!updated) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
  }

  /**
   * Xóa người dùng theo ID (soft delete)
   */
  async deleteUserById(id: string): Promise<void> {
    const user = await this.userRepo.findById(id);
    if (!user || user.isDeleted) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    await this.userRepo.softDelete(id);
  }

  /**
   * Tìm kiếm người dùng với các bộ lọc từ DTO
   */
  async findAllWithFilters(query: QueryUserDto): Promise<{
    users: UserDocument[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      sort,
      select,
      is_verified,
      isDeleted,
    } = query;

    // Xây dựng bộ lọc
    const filters: FilterQuery<UserDocument> = {};

    // Thêm bộ lọc tìm kiếm nếu có
    if (search) {
      filters.$or = buildSearchFilter(search, ['name', 'email', 'phone']);
    }

    // Thêm bộ lọc theo vai trò nếu có
    if (role) {
      filters.role = Array.isArray(role) ? { $in: role } : role;
    }

    // Lọc theo trạng thái xác minh
    if (is_verified !== undefined) {
      filters.is_verified = is_verified;
    }

    // Lọc theo trạng thái xóa

    // ======= FILTER CHUẨN cho isDeleted =======
    if (
      typeof isDeleted === 'string' &&
      isDeleted !== '' &&
      isDeleted !== 'all'
    ) {
      filters.isDeleted = isDeleted === 'true';
    } else if (typeof isDeleted === 'boolean') {
      filters.isDeleted = isDeleted;
    }
    // Nếu không truyền, hoặc truyền "all"/"" thì KHÔNG filter isDeleted => trả về tất cả
    // Chuyển đổi chuỗi sort thành object
    const sortOptions = parseSortString(sort);

    // Gọi repository để lấy dữ liệu
    return this.findAll(filters, {
      page,
      limit,
      sort: sortOptions,
      select,
    });
  }

  /**
   * Cập nhật thông tin người dùng
   */
  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const updatedUser = await this.userRepo.updateById(id, updateUserDto);
    if (!updatedUser) {
      throw new NotFoundException('Không thể cập nhật thông tin người dùng');
    }

    return updatedUser;
  }

  /**
   * Đếm số lượng người dùng
   */
  async countUsers(): Promise<number> {
    // Chỉ đếm người dùng chưa bị xóa
    return await this.userRepo.countUsers({ isDeleted: { $ne: true } });
  }

  /**
   * Chuyển đổi trạng thái người dùng (khóa/mở khóa)
   */
  async toggleUserStatus(id: string): Promise<UserDocument> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // Đảo ngược trạng thái isDeleted
    const isDeleted = !user.isDeleted;
    const updateData: { isDeleted: boolean; deletedAt: Date | null } = {
      isDeleted,
      deletedAt: isDeleted ? new Date() : null,
    };

    const updatedUser = await this.userRepo.updateById(id, updateData);
    if (!updatedUser) {
      throw new NotFoundException('Không thể cập nhật trạng thái người dùng');
    }

    return updatedUser;
  }
}
