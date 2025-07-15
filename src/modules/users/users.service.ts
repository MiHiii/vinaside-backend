import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDocument } from './schemas/user.schema';
import { QueryUserDto } from './dto/query-user.dto';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { UserRepo } from './users.repo';
import { compare } from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly userRepo: UserRepo) {}

  /**
   * Tìm tất cả người dùng với filters
   */
  async findAllWithFilters(
    queryDto: QueryUserDto,
    currentUser: JwtPayload,
  ): Promise<any> {
    // Staff restrictions - can only see users in their scope
    if (currentUser.role === 'staff') {
      // Add any scope restrictions here if needed
    }

    // Extract pagination options from queryDto
    const { page = 1, limit = 10, sort, select, ...filters } = queryDto;

    // 🔥 FIX: Workaround cho boolean query issue - dùng $ne thay vị isDeleted: false
    const finalFilters: Record<string, any> = { ...filters }; // MongoDB query object

    // Remove undefined properties first
    Object.keys(finalFilters).forEach((key) => {
      if (finalFilters[key] === undefined) {
        delete finalFilters[key];
      }
    });

    // Apply isDeleted workaround
    if (!('isDeleted' in finalFilters)) {
      finalFilters.isDeleted = { $ne: true }; // Thay vì false, dùng $ne: true
    } else if (finalFilters.isDeleted === false) {
      finalFilters.isDeleted = { $ne: true }; // 🔥 WORKAROUND: Replace false with $ne: true
    }

    const options = {
      page,
      limit,
      sort: sort ? this.parseSortString(sort) : { createdAt: -1 as const },
      select: select || '',
    };

    const result = await this.userRepo.findAll(finalFilters, options);

    return {
      data: result.data,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(result.total / limit),
        totalItems: result.total,
        itemsPerPage: limit,
      },
    };
  }

  private parseSortString(sort: string): Record<string, 1 | -1> {
    const [field, direction] = sort.split(':');
    return { [field]: direction === 'desc' ? -1 : 1 };
  }

  /**
   * Đếm tổng số người dùng
   */
  async count(currentUser: JwtPayload): Promise<{ data: { count: number } }> {
    // Staff restrictions
    if (currentUser.role === 'staff') {
      // Add scope restrictions if needed
    }

    const count = await this.userRepo.countUsers({ isDeleted: { $ne: true } });
    return { data: { count } };
  }

  /**
   * Tìm người dùng theo ID
   */
  async findOne(
    id: string,
    currentUser: JwtPayload,
  ): Promise<{ data: UserDocument }> {
    // Staff can only view users in their scope
    if (currentUser.role === 'staff') {
      // Add scope validation here if needed
    }

    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return { data: user };
  }

  /**
   * Tạo người dùng mới
   */
  async createUser(
    createUserDto: CreateUserDto,
    currentUser: JwtPayload,
  ): Promise<{ data: UserDocument }> {
    // Staff restrictions on role assignment
    if (currentUser.role === 'staff' && createUserDto.role === 'admin') {
      throw new NotFoundException('Staff không thể tạo admin user');
    }

    const user = await this.userRepo.create(createUserDto);
    return { data: user };
  }

  /**
   * Cập nhật toàn bộ thông tin người dùng
   */
  async updateFull(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser: JwtPayload,
  ): Promise<{ data: UserDocument }> {
    const existingUser = await this.userRepo.findById(id);
    if (!existingUser) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // Staff restrictions
    if (currentUser.role === 'staff') {
      // Cannot change role
      if (updateUserDto.role && updateUserDto.role !== existingUser.role) {
        throw new NotFoundException('Staff không thể thay đổi role');
      }
    }

    const user = await this.userRepo.updateById(id, updateUserDto);
    if (!user) {
      throw new NotFoundException('Không thể cập nhật người dùng');
    }
    return { data: user };
  }

  /**
   * Cập nhật một phần thông tin người dùng
   */
  async updatePartial(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser: JwtPayload,
  ): Promise<{ data: UserDocument }> {
    return this.updateFull(id, updateUserDto, currentUser);
  }

  /**
   * Chuyển đổi trạng thái người dùng (khóa/mở khóa)
   */
  async toggleStatus(
    id: string,
    currentUser: JwtPayload,
  ): Promise<{ data: UserDocument }> {
    // Staff restrictions
    if (currentUser.role === 'staff') {
      // Add scope validation if needed
    }

    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const isDeleted = !user.isDeleted;
    const updatedUser = await this.userRepo.updateById(id, {
      isDeleted,
      deletedAt: isDeleted ? new Date() : null,
    });

    if (!updatedUser) {
      throw new NotFoundException('Không thể cập nhật trạng thái người dùng');
    }
    return { data: updatedUser };
  }

  /**
   * Xóa người dùng
   */
  async delete(
    id: string,
    currentUser: JwtPayload,
  ): Promise<{ data: { message: string } }> {
    // Staff restrictions
    if (currentUser.role === 'staff') {
      // Add scope validation if needed
    }

    const user = await this.userRepo.findById(id);
    if (!user || user.isDeleted) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    await this.userRepo.softDelete(id);
    return { data: { message: 'Xóa người dùng thành công' } };
  }

  // ==================== AUTH SERVICE METHODS ====================

  /**
   * Tìm người dùng theo ID
   */
  async findById(id: string): Promise<UserDocument | null> {
    return this.userRepo.findById(id);
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
   * Tạo người dùng mới
   */
  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    return this.userRepo.create(createUserDto);
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
}
