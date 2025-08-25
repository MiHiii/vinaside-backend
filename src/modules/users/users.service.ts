import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { AdminCreateUserDto } from '../auth/dto/admin-create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDocument } from './schemas/user.schema';
import { QueryUserDto } from './dto/query-user.dto';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { UserRepo } from './users.repo';
import { compare } from 'bcryptjs';
import * as bcrypt from 'bcryptjs';

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
   * Admin tạo người dùng mới với custom roles
   */
  async createUser(createUserDto: AdminCreateUserDto): Promise<UserDocument> {
    // Kiểm tra email đã tồn tại
    const existingUser = await this.userRepo.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('Email đã tồn tại trong hệ thống');
    }

    try {
      const passwordHash = await bcrypt.hash(createUserDto.password, 10);

      // Prepare data for database
      const dataForDB = {
        name: createUserDto.name,
        email: createUserDto.email,
        phone: createUserDto.phone,
        avatar_url: createUserDto.avatar_url,
        role: createUserDto.role || 'staff', // Default to staff for admin-created
        customRoles: createUserDto.customRoles || [],
        language: createUserDto.language,
        is_verified: createUserDto.is_verified ?? true, // Auto-verify admin-created users
        password_hash: passwordHash,
      };

      const result = await this.userRepo.create(dataForDB);
      return result;
    } catch (error: unknown) {
      // Handle duplicate key errors (11000)
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new ConflictException('Email đã tồn tại trong hệ thống');
      }

      // Re-throw other errors
      throw new BadRequestException('Không thể tạo người dùng');
    }
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

    // Kiểm tra email trùng lặp nếu có cập nhật email
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const userWithSameEmail = await this.userRepo.findByEmail(
        updateUserDto.email,
      );
      if (
        userWithSameEmail &&
        (userWithSameEmail._id as { toString(): string }).toString() !== id
      ) {
        throw new ConflictException('Email đã tồn tại trong hệ thống');
      }
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
   * Tạo user mới cho staff booking (không cần password vì chỉ dành cho booking)
   */
  async createUserForStaffBooking(userData: {
    name: string;
    email: string;
    phone: string;
    role: string;
  }): Promise<UserDocument> {
    // Kiểm tra email đã tồn tại chưa
    const existingUser = await this.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictException(
        'Email đã được sử dụng. Vui lòng chọn user có sẵn.',
      );
    }

    // Tạo password tạm thời (user có thể reset sau)
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const newUserData = {
      ...userData,
      password_hash: hashedPassword,
      is_verified: false, // User cần verify email sau
      created_by_staff: true, // Đánh dấu user được tạo bởi staff
    };

    return this.userRepo.create(newUserData);
  }

  /**
   * Kiểm tra mật khẩu
   */
  async isValidPassword(password: string, hash: string): Promise<boolean> {
    return await compare(password, hash);
  }

  /**
   * Register người dùng mới (public registration)
   */
  async register(createUserDto: CreateUserDto): Promise<UserDocument> {
    // Kiểm tra email đã tồn tại chưa
    const existingUser = await this.userRepo.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('Email đã tồn tại trong hệ thống');
    }

    try {
      const passwordHash = await bcrypt.hash(createUserDto.password, 10);
      // Prepare data for database
      const dataForDB = {
        name: createUserDto.name,
        email: createUserDto.email,
        phone: createUserDto.phone,
        avatar_url: createUserDto.avatar_url,
        role: createUserDto.role,
        customRoles: createUserDto.customRoles || [],
        language: createUserDto.language,
        is_verified: createUserDto.is_verified,
        password_hash: passwordHash,
      };
      const result = await this.userRepo.create(dataForDB);
      return result;
    } catch (error: unknown) {
      // Handle duplicate key errors (11000)
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new ConflictException('Email đã tồn tại trong hệ thống');
      }

      // Re-throw other errors
      throw new BadRequestException('Không thể đăng ký người dùng');
    }
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
