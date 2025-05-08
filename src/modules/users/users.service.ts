import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { genSaltSync, hashSync, compare } from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  async createUser(createUserDto: CreateUserDto) {
    // 1. Kiểm tra xem email đã tồn tại chưa
    const existingUser = await this.userModel.findOne({
      email: createUserDto.email,
    });
    if (existingUser) {
      throw new ConflictException('Email is already in use');
    }

    // 2. Hash mật khẩu
    const salt = genSaltSync(10);
    const hashedPassword = hashSync(createUserDto.password, salt);

    // 3. Tạo user mới
    const user = new this.userModel({
      email: createUserDto.email,
      name: createUserDto.name,
      password: hashedPassword,
    });

    return await user.save();
  }

  async findAll() {
    return await this.userModel.find({});
  }

  findOneByUsername(username: string) {
    return this.userModel.findOne({
      email: username,
    });
  }

  async findByEmail(email: string) {
    return await this.userModel.findOne({ email });
  }

  async isValidPassword(password: string, hash: string) {
    return await compare(password, hash);
  }

  async findById(id: string) {
    return await this.userModel.findById(id);
  }

  async deleteUserById(id: string) {
    const user = await this.userModel.findById(id);
    if (!user || user.isDeleted) {
      throw new NotFoundException('User not found');
    }

    user.isDeleted = true;
    user.deletedAt = new Date();
    await user.save();

    return { message: 'User deleted successfully' };
  }
}
