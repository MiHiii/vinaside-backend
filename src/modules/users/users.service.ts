import { Injectable, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { compare } from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  async create(data: Partial<User>) {
    const user = new this.userModel(data);
    return user.save();
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

  async verifyUser(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      is_verified: true,
    });
  }

  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      password_hash: newPasswordHash,
    });
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
