import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { Message, MessageStatus } from './schemas/message.schema';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>,
  ) {}

  async create(createMessageDto: CreateMessageDto): Promise<Message> {
    const createdMessage = new this.messageModel({
      ...createMessageDto,
      sent_at: new Date(),
    });
    const savedMessage = (await createdMessage.save()) as Message & {
      _id: Types.ObjectId;
    };
    return savedMessage;
  }

  // Các phương thức khác giữ nguyên
  async findAll(): Promise<Message[]> {
    return await this.messageModel
      .find()
      .populate('sender_id', 'username email')
      .populate('receiver_id', 'username email')
      .sort({ sent_at: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Message | null> {
    return await this.messageModel
      .findById(id)
      .populate('sender_id', 'username email')
      .populate('receiver_id', 'username email')
      .exec();
  }

  async findConversation(userId1: string, userId2: string): Promise<Message[]> {
    return await this.messageModel
      .find({
        $or: [
          { sender_id: userId1, receiver_id: userId2 },
          { sender_id: userId2, receiver_id: userId1 },
        ],
      })
      .populate('sender_id', 'username email')
      .populate('receiver_id', 'username email')
      .sort({ sent_at: 1 })
      .exec();
  }

  async findUserConversations(userId: string): Promise<any[]> {
    const conversations = await this.messageModel.aggregate([
      {
        $match: {
          $or: [
            { sender_id: new Types.ObjectId(userId) },
            { receiver_id: new Types.ObjectId(userId) },
          ],
        },
      },
      {
        $sort: { sent_at: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender_id', new Types.ObjectId(userId)] },
              '$receiver_id',
              '$sender_id',
            ],
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver_id', new Types.ObjectId(userId)] },
                    { $ne: ['$is_read', MessageStatus.READ] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $project: {
          user: { username: 1, email: 1, avatar: 1 },
          lastMessage: 1,
          unreadCount: 1,
        },
      },
      {
        $sort: { 'lastMessage.sent_at': -1 },
      },
    ]);

    return conversations;
  }

  async update(
    id: string,
    updateMessageDto: UpdateMessageDto,
  ): Promise<Message | null> {
    return await this.messageModel
      .findByIdAndUpdate(id, updateMessageDto, { new: true })
      .populate('sender_id', 'username email')
      .populate('receiver_id', 'username email')
      .exec();
  }

  async markAsRead(messageId: string): Promise<Message | null> {
    return await this.messageModel
      .findByIdAndUpdate(
        messageId,
        { is_read: MessageStatus.READ },
        { new: true },
      )
      .exec();
  }

  async markConversationAsRead(
    userId: string,
    otherUserId: string,
  ): Promise<void> {
    await this.messageModel
      .updateMany(
        {
          sender_id: otherUserId,
          receiver_id: userId,
          is_read: { $ne: MessageStatus.READ },
        },
        { is_read: MessageStatus.READ },
      )
      .exec();
  }

  async remove(id: string): Promise<Message | null> {
    return await this.messageModel.findByIdAndDelete(id).exec();
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.messageModel
      .countDocuments({
        receiver_id: userId,
        is_read: { $ne: MessageStatus.READ },
      })
      .exec();
  }
}
