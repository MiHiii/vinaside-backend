import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { AddReactionDto, RemoveReactionDto } from './dto/reaction.dto';
import { Message, MessageStatus, ReactionType } from './schemas/message.schema';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { MessagesGateway } from './messages.gateway';
import { removeUndefinedObject } from '../../utils/common.util';
import {
  extractMessageId,
  isValidObjectId,
  createRealtimeMessage,
} from './utils/message.util';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @Inject(forwardRef(() => MessagesGateway))
    private readonly messagesGateway: MessagesGateway,
  ) {}

  async create(
    createMessageDto: CreateMessageDto,
    user: JwtPayload,
  ): Promise<Message> {
    // Validation
    if (!isValidObjectId(createMessageDto.receiver_id)) {
      throw new BadRequestException('Invalid receiver ID format');
    }

    // Convert string IDs to ObjectId before saving
    const messageData = {
      ...createMessageDto,
      sender_id: new Types.ObjectId(user._id),
      receiver_id: new Types.ObjectId(createMessageDto.receiver_id),
      sent_at: new Date(),
      is_read: MessageStatus.SENT,
    };

    const createdMessage = new this.messageModel(messageData);
    const savedMessage = await createdMessage.save();

    // Emit realtime notification
    try {
      const messageId = extractMessageId(savedMessage);
      if (messageId) {
        const realtimeMessage = createRealtimeMessage({
          messageId,
          content: createMessageDto.content,
          senderId: user._id,
          receiverId: createMessageDto.receiver_id,
          is_read: MessageStatus.SENT,
        });

        // Emit thông báo new message
        this.messagesGateway.emitNewMessage(
          realtimeMessage,
          createMessageDto.receiver_id,
        );

        // Update delivered status nếu user online
        if (this.messagesGateway.isUserOnline(createMessageDto.receiver_id)) {
          await this.update(
            messageId,
            { is_read: MessageStatus.DELIVERED },
            user,
          );
        }
      }
    } catch (error) {
      console.error('Failed to emit realtime message:', error);
    }

    return savedMessage;
  }

  async findAll(): Promise<Message[]> {
    return await this.messageModel
      .find()
      .populate('sender_id', 'username email')
      .populate('receiver_id', 'username email')
      .sort({ sent_at: -1 })
      .exec();
  }

  async findOne(id: string, user: JwtPayload): Promise<Message | null> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid message ID format');
    }

    const message = await this.messageModel
      .findById(id)
      .populate('sender_id', 'username email')
      .populate('receiver_id', 'username email')
      .exec();

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Authorization: chỉ sender hoặc receiver mới xem được tin nhắn
    const senderId = message.sender_id.toString();
    const receiverId = message.receiver_id.toString();

    if (
      user.role !== 'admin' &&
      user._id !== senderId &&
      user._id !== receiverId
    ) {
      throw new ForbiddenException('You can only view your own messages');
    }

    return message;
  }

  async findConversation(
    userId: string,
    otherUserId: string,
  ): Promise<Message[]> {
    if (!isValidObjectId(otherUserId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    // Handle both string and ObjectId formats for backward compatibility
    const userObjectId = new Types.ObjectId(userId);
    const otherUserObjectId = new Types.ObjectId(otherUserId);

    const messages = await this.messageModel
      .find({
        $or: [
          // Handle ObjectId format (new data)
          { sender_id: userObjectId, receiver_id: otherUserObjectId },
          { sender_id: otherUserObjectId, receiver_id: userObjectId },
          // Handle string format (legacy data)
          { sender_id: userId, receiver_id: otherUserId },
          { sender_id: otherUserId, receiver_id: userId },
        ],
      })
      .populate('sender_id', 'username email')
      .populate('receiver_id', 'username email')
      .sort({ sent_at: 1 })
      .exec();

    return messages;
  }

  async findUserConversations(userId: string): Promise<any[]> {
    // Handle both string and ObjectId formats for backward compatibility
    const userObjectId = new Types.ObjectId(userId);

    const conversations = await this.messageModel.aggregate([
      {
        $match: {
          $or: [
            // Handle ObjectId format (new data)
            { sender_id: userObjectId },
            { receiver_id: userObjectId },
            // Handle string format (legacy data)
            { sender_id: userId },
            { receiver_id: userId },
          ],
        },
      },
      {
        $sort: { sent_at: -1 },
      },
      {
        $addFields: {
          otherUserId: {
            $cond: [
              {
                $or: [
                  { $eq: ['$sender_id', userObjectId] },
                  { $eq: ['$sender_id', userId] },
                ],
              },
              '$receiver_id',
              '$sender_id',
            ],
          },
        },
      },
      {
        $group: {
          _id: '$otherUserId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $or: [
                        { $eq: ['$receiver_id', userObjectId] },
                        { $eq: ['$receiver_id', userId] },
                      ],
                    },
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
        $addFields: {
          userIdToLookup: {
            $cond: [
              { $eq: [{ $type: '$_id' }, 'objectId'] },
              '$_id',
              { $toObjectId: '$_id' },
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userIdToLookup',
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
    user: JwtPayload,
  ): Promise<Message | null> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid message ID format');
    }

    const message = await this.messageModel.findById(id);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Authorization: chỉ sender mới có thể update tin nhắn
    if (user.role !== 'admin' && user._id !== message.sender_id.toString()) {
      throw new ForbiddenException('You can only update your own messages');
    }

    const cleanedData = removeUndefinedObject(updateMessageDto);
    return await this.messageModel
      .findByIdAndUpdate(id, cleanedData, { new: true })
      .populate('sender_id', 'username email')
      .populate('receiver_id', 'username email')
      .exec();
  }

  async markAsRead(
    messageId: string,
    user: JwtPayload,
  ): Promise<Message | null> {
    if (!isValidObjectId(messageId)) {
      throw new BadRequestException('Invalid message ID format');
    }

    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Authorization: chỉ receiver mới có thể mark as read
    if (user.role !== 'admin' && user._id !== message.receiver_id.toString()) {
      throw new ForbiddenException(
        'You can only mark messages sent to you as read',
      );
    }

    return await this.messageModel
      .findByIdAndUpdate(
        messageId,
        { is_read: MessageStatus.READ },
        { new: true },
      )
      .populate('sender_id', 'username email')
      .populate('receiver_id', 'username email')
      .exec();
  }

  async markConversationAsRead(
    userId: string,
    otherUserId: string,
  ): Promise<{ modifiedCount: number }> {
    if (!isValidObjectId(otherUserId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const result = await this.messageModel
      .updateMany(
        {
          sender_id: otherUserId,
          receiver_id: userId,
          is_read: { $ne: MessageStatus.READ },
        },
        { is_read: MessageStatus.READ },
      )
      .exec();

    return { modifiedCount: result.modifiedCount };
  }

  async remove(id: string, user: JwtPayload): Promise<Message | null> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid message ID format');
    }

    const message = await this.messageModel.findById(id);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Authorization: chỉ sender hoặc admin mới có thể xóa tin nhắn
    if (user.role !== 'admin' && user._id !== message.sender_id.toString()) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    return await this.messageModel.findByIdAndDelete(id).exec();
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.messageModel
      .countDocuments({
        receiver_id: userId,
        is_read: { $ne: MessageStatus.READ },
      })
      .exec();

    return { count };
  }

  async getAvailableUsers(currentUserId: string): Promise<any[]> {
    try {
      const userObjectId = new Types.ObjectId(currentUserId);

      // Check if user has any messages (handle both string and ObjectId)
      const messageCount = await this.messageModel.countDocuments({
        $or: [
          // Handle ObjectId format (new data)
          { sender_id: userObjectId },
          { receiver_id: userObjectId },
          // Handle string format (legacy data)
          { sender_id: currentUserId },
          { receiver_id: currentUserId },
        ],
      });

      if (messageCount === 0) {
        return [];
      }

      // Logic production: lấy users đã từng chat với current user
      const users = await this.messageModel.aggregate([
        {
          $match: {
            $or: [
              // Handle ObjectId format (new data)
              { sender_id: userObjectId },
              { receiver_id: userObjectId },
              // Handle string format (legacy data)
              { sender_id: currentUserId },
              { receiver_id: currentUserId },
            ],
          },
        },
        {
          $addFields: {
            otherUserId: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$sender_id', userObjectId] },
                    { $eq: ['$sender_id', currentUserId] },
                  ],
                },
                '$receiver_id',
                '$sender_id',
              ],
            },
          },
        },
        {
          $group: {
            _id: '$otherUserId',
            lastMessage: { $first: '$$ROOT' },
          },
        },
        {
          $addFields: {
            userIdToLookup: {
              $cond: [
                { $eq: [{ $type: '$_id' }, 'objectId'] },
                '$_id',
                { $toObjectId: '$_id' },
              ],
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userIdToLookup',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: '$user',
        },
        {
          $project: {
            _id: '$user._id',
            username: '$user.username',
            email: '$user.email',
            avatar: '$user.avatar',
            name: '$user.name',
            role: '$user.role',
            lastMessageAt: '$lastMessage.sent_at',
          },
        },
        {
          $sort: { lastMessageAt: -1 },
        },
      ]);

      return users;
    } catch (error) {
      console.error('Error getting available users:', error);
      return [];
    }
  }

  async getAllUsers(currentUserId: string): Promise<any[]> {
    try {
      // Truy vấn trực tiếp vào collection users
      const users = await this.messageModel.db
        .collection('users')
        .find(
          { _id: { $ne: new Types.ObjectId(currentUserId) } },
          {
            projection: {
              _id: 1,
              username: 1,
              email: 1,
              avatar: 1,
              name: 1,
              role: 1,
            },
          },
        )
        .toArray();

      return users;
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  // ==================== REACTIONS METHODS ====================

  async addReaction(
    addReactionDto: AddReactionDto,
    user: JwtPayload,
  ): Promise<Message> {
    const { message_id, type } = addReactionDto;

    if (!isValidObjectId(message_id)) {
      throw new BadRequestException('Invalid message ID format');
    }

    const message = await this.messageModel.findById(message_id);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Authorization: chỉ sender hoặc receiver mới có thể react
    const senderId = message.sender_id.toString();
    const receiverId = message.receiver_id.toString();

    if (user._id !== senderId && user._id !== receiverId) {
      throw new ForbiddenException('You can only react to your own messages');
    }

    // Remove existing reaction from this user (if any)
    await this.messageModel.updateOne(
      { _id: message_id },
      { $pull: { reactions: { user_id: new Types.ObjectId(user._id) } } },
    );

    // Add new reaction
    const updatedMessage = await this.messageModel
      .findByIdAndUpdate(
        message_id,
        {
          $push: {
            reactions: {
              user_id: new Types.ObjectId(user._id),
              type,
              created_at: new Date(),
            },
          },
        },
        { new: true },
      )
      .populate('sender_id', 'username email')
      .populate('receiver_id', 'username email')
      .populate('reactions.user_id', 'username email')
      .exec();

    if (!updatedMessage) {
      throw new NotFoundException('Failed to update message');
    }

    // Emit real-time notification
    try {
      const otherUserId = user._id === senderId ? receiverId : senderId;
      this.messagesGateway.emitReactionUpdate(updatedMessage, otherUserId);
    } catch (error) {
      console.error('Failed to emit reaction update:', error);
    }

    return updatedMessage;
  }

  async removeReaction(
    removeReactionDto: RemoveReactionDto,
    user: JwtPayload,
  ): Promise<Message> {
    const { message_id } = removeReactionDto;

    if (!isValidObjectId(message_id)) {
      throw new BadRequestException('Invalid message ID format');
    }

    const message = await this.messageModel.findById(message_id);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Authorization: chỉ sender hoặc receiver mới có thể react
    const senderId = message.sender_id.toString();
    const receiverId = message.receiver_id.toString();

    if (user._id !== senderId && user._id !== receiverId) {
      throw new ForbiddenException(
        'You can only remove reactions from your own messages',
      );
    }

    // Remove reaction
    const updatedMessage = await this.messageModel
      .findByIdAndUpdate(
        message_id,
        { $pull: { reactions: { user_id: new Types.ObjectId(user._id) } } },
        { new: true },
      )
      .populate('sender_id', 'username email')
      .populate('receiver_id', 'username email')
      .populate('reactions.user_id', 'username email')
      .exec();

    if (!updatedMessage) {
      throw new NotFoundException('Failed to update message');
    }

    // Emit real-time notification
    try {
      const otherUserId = user._id === senderId ? receiverId : senderId;
      this.messagesGateway.emitReactionUpdate(updatedMessage, otherUserId);
    } catch (error) {
      console.error('Failed to emit reaction update:', error);
    }

    return updatedMessage;
  }

  async toggleReaction(
    messageId: string,
    reactionType: ReactionType,
    user: JwtPayload,
  ): Promise<{ action: 'added' | 'removed'; message: Message }> {
    if (!isValidObjectId(messageId)) {
      throw new BadRequestException('Invalid message ID format');
    }

    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Authorization check
    const senderId = message.sender_id.toString();
    const receiverId = message.receiver_id.toString();

    if (user._id !== senderId && user._id !== receiverId) {
      throw new ForbiddenException('You can only react to your own messages');
    }

    // Check if user already has a reaction
    const existingReaction = message.reactions.find(
      (reaction) => reaction.user_id.toString() === user._id,
    );

    let action: 'added' | 'removed';
    let updatedMessage: Message;

    if (existingReaction) {
      if (existingReaction.type === reactionType) {
        // Same reaction type - remove it
        const result = await this.messageModel
          .findByIdAndUpdate(
            messageId,
            { $pull: { reactions: { user_id: new Types.ObjectId(user._id) } } },
            { new: true },
          )
          .populate('sender_id', 'username email')
          .populate('receiver_id', 'username email')
          .populate('reactions.user_id', 'username email')
          .exec();

        if (!result) {
          throw new NotFoundException('Failed to update message');
        }
        updatedMessage = result;
        action = 'removed';
      } else {
        // Different reaction type - update it
        await this.messageModel.updateOne(
          { _id: messageId, 'reactions.user_id': new Types.ObjectId(user._id) },
          { $set: { 'reactions.$.type': reactionType } },
        );
        const result = await this.messageModel
          .findById(messageId)
          .populate('sender_id', 'username email')
          .populate('receiver_id', 'username email')
          .populate('reactions.user_id', 'username email')
          .exec();

        if (!result) {
          throw new NotFoundException('Failed to find updated message');
        }
        updatedMessage = result;
        action = 'added';
      }
    } else {
      // No existing reaction - add new one
      const result = await this.messageModel
        .findByIdAndUpdate(
          messageId,
          {
            $push: {
              reactions: {
                user_id: new Types.ObjectId(user._id),
                type: reactionType,
                created_at: new Date(),
              },
            },
          },
          { new: true },
        )
        .populate('sender_id', 'username email')
        .populate('receiver_id', 'username email')
        .populate('reactions.user_id', 'username email')
        .exec();

      if (!result) {
        throw new NotFoundException('Failed to update message');
      }
      updatedMessage = result;
      action = 'added';
    }

    // Emit real-time notification
    try {
      const otherUserId = user._id === senderId ? receiverId : senderId;
      this.messagesGateway.emitReactionUpdate(updatedMessage, otherUserId);
    } catch (error) {
      console.error('Failed to emit reaction update:', error);
    }

    return { action, message: updatedMessage };
  }
}
