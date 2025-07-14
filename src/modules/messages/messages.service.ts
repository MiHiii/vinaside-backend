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
import {
  ReplyToMessage,
  UserProfileResponse,
} from './interfaces/message.interface';

// ============= TYPE DEFINITIONS =============

interface MessageQueryDto {
  page?: number;
  limit?: number;
  [key: string]: any;
}

interface ConversationQueryDto {
  limit?: number;
  page?: number;
  // Không có default limit để lấy toàn bộ tin nhắn
  [key: string]: any;
}

interface MessageSearchDto {
  keyword?: string;
  limit?: number;
  [key: string]: any;
}

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
      throw new BadRequestException('Định dạng ID người nhận không hợp lệ');
    }

    // Validate reply_to_message_id if provided
    if (createMessageDto.reply_to_message_id) {
      if (!isValidObjectId(createMessageDto.reply_to_message_id)) {
        throw new BadRequestException(
          'Định dạng ID tin nhắn reply không hợp lệ',
        );
      }

      // Check if reply message exists and user has permission to reply
      const replyToMessage = await this.messageModel.findById(
        createMessageDto.reply_to_message_id,
      );
      if (!replyToMessage) {
        throw new NotFoundException('Không tìm thấy tin nhắn để reply');
      }

      // Check if user is part of the conversation
      const replySenderId = replyToMessage.sender_id.toString();
      const replyReceiverId = replyToMessage.receiver_id.toString();
      if (user._id !== replySenderId && user._id !== replyReceiverId) {
        throw new ForbiddenException(
          'Bạn chỉ có thể reply tin nhắn trong cuộc trò chuyện của mình',
        );
      }
    }

    // Convert string IDs to ObjectId before saving
    const messageData: Record<string, unknown> = {
      ...createMessageDto,
      sender_id: new Types.ObjectId(user._id),
      receiver_id: new Types.ObjectId(createMessageDto.receiver_id),
      sent_at: new Date(),
      is_read: MessageStatus.SENT,
    };

    // Add reply_to_message_id if provided
    if (createMessageDto.reply_to_message_id) {
      messageData['reply_to_message_id'] = new Types.ObjectId(
        createMessageDto.reply_to_message_id,
      );
    }

    const createdMessage = new this.messageModel(messageData);
    const savedMessage = await createdMessage.save();

    // Populate the saved message to get full data including reply info
    const populatedMessage = await this.messageModel
      .findById(savedMessage._id)
      .populate('sender_id', 'username email name avatar_url')
      .populate('receiver_id', 'username email name avatar_url')
      .populate('reply_to_message_id', 'content sender_id receiver_id sent_at')
      .populate({
        path: 'reply_to_message_id',
        populate: {
          path: 'sender_id',
          select: 'username email name avatar_url',
        },
      })
      .exec();

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

    return populatedMessage || savedMessage;
  }

  /**
   * Lấy tất cả tin nhắn với phân trang
   */
  async findAll(queryDto?: MessageQueryDto, user?: JwtPayload): Promise<any[]> {
    try {
      let messages: Message[];

      // Implementation for backward compatibility
      if (queryDto && user) {
        // Filter messages for the specific user
        const userObjectId = new Types.ObjectId(user._id);

        messages = await this.messageModel
          .find({
            $or: [{ sender_id: userObjectId }, { receiver_id: userObjectId }],
          })
          .populate('sender_id', 'username email name avatar_url')
          .populate('receiver_id', 'username email name avatar_url')
          .populate('reactions.user_id', 'username email name avatar_url')
          .populate(
            'reply_to_message_id',
            'content sender_id receiver_id sent_at',
          )
          .populate({
            path: 'reply_to_message_id',
            populate: {
              path: 'sender_id',
              select: 'username email name avatar_url',
            },
          })
          .sort({ sent_at: -1 })
          .limit(queryDto?.limit || 10)
          .skip(
            queryDto?.page ? (queryDto.page - 1) * (queryDto.limit || 10) : 0,
          )
          .exec();
      } else {
        messages = await this.messageModel
          .find()
          .populate('sender_id', 'username email name avatar_url')
          .populate('receiver_id', 'username email name avatar_url')
          .populate('reactions.user_id', 'username email name avatar_url')
          .populate(
            'reply_to_message_id',
            'content sender_id receiver_id sent_at',
          )
          .populate({
            path: 'reply_to_message_id',
            populate: {
              path: 'sender_id',
              select: 'username email name avatar_url',
            },
          })
          .sort({ sent_at: -1 })
          .exec();
      }

      // Format all messages với emoji reactions
      return this.formatMessagesWithReactions(messages || []);
    } catch (error) {
      console.error('Error in findAll:', error);
      return [];
    }
  }

  async findOne(id: string, user: JwtPayload): Promise<Message | null> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Định dạng ID tin nhắn không hợp lệ');
    }

    const message = await this.messageModel
      .findById(id)
      .populate('sender_id', 'username email name avatar_url')
      .populate('receiver_id', 'username email name avatar_url')
      .populate('reactions.user_id', 'username email name avatar_url')
      .populate('reply_to_message_id', 'content sender_id receiver_id sent_at')
      .populate({
        path: 'reply_to_message_id',
        populate: {
          path: 'sender_id',
          select: 'username email name avatar_url',
        },
      })
      .exec();

    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    // Authorization: chỉ sender hoặc receiver mới xem được tin nhắn
    const senderId = message.sender_id.toString();
    const receiverId = message.receiver_id.toString();

    if (
      user.role !== 'admin' &&
      user._id !== senderId &&
      user._id !== receiverId
    ) {
      throw new ForbiddenException('Bạn chỉ có thể xem tin nhắn của mình');
    }

    // Format reactions với emoji
    return this.formatReactionResponse(message) as Message;
  }

  async findConversation(
    userId: string,
    otherUserId: string,
  ): Promise<Message[]> {
    if (!isValidObjectId(otherUserId)) {
      throw new BadRequestException('Định dạng ID người dùng không hợp lệ');
    }

    try {
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
        .populate('sender_id', 'username email name avatar_url')
        .populate('receiver_id', 'username email name avatar_url')
        .populate('reactions.user_id', 'username email name avatar_url')
        .populate(
          'reply_to_message_id',
          'content sender_id receiver_id sent_at',
        )
        .populate({
          path: 'reply_to_message_id',
          populate: {
            path: 'sender_id',
            select: 'username email name avatar_url',
          },
        })
        .sort({ sent_at: 1 })
        .exec();

      return messages || [];
    } catch (error) {
      console.error('Error in findConversation:', error);
      return [];
    }
  }

  async findUserConversations(userId: string): Promise<any[]> {
    try {
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
            user: { username: 1, email: 1, name: 1, avatar_url: 1 },
            lastMessage: 1,
            unreadCount: 1,
          },
        },
        {
          $sort: { 'lastMessage.sent_at': -1 },
        },
      ]);

      return conversations || [];
    } catch (error) {
      console.error('Error in findUserConversations:', error);
      return [];
    }
  }

  async update(
    id: string,
    updateMessageDto: UpdateMessageDto,
    user: JwtPayload,
  ): Promise<Message | null> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Định dạng ID tin nhắn không hợp lệ');
    }

    const message = await this.messageModel.findById(id);
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    // Authorization: chỉ sender mới có thể update tin nhắn
    if (user.role !== 'admin' && user._id !== message.sender_id.toString()) {
      throw new ForbiddenException('Bạn chỉ có thể cập nhật tin nhắn của mình');
    }

    const cleanedData = removeUndefinedObject(updateMessageDto);
    return await this.messageModel
      .findByIdAndUpdate(id, cleanedData, { new: true })
      .populate('sender_id', 'username email name avatar_url')
      .populate('receiver_id', 'username email name avatar_url')
      .exec();
  }

  /**
   * Đánh dấu đã đọc với user ID
   */
  async markAsRead(messageId: string, userId: string): Promise<Message | null> {
    if (!isValidObjectId(messageId)) {
      throw new BadRequestException('Định dạng ID tin nhắn không hợp lệ');
    }

    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    // Authorization: chỉ receiver mới có thể mark as read
    if (userId !== message.receiver_id.toString()) {
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
      .populate('sender_id', 'username email name avatar_url')
      .populate('receiver_id', 'username email name avatar_url')
      .exec();
  }

  async markConversationAsRead(
    userId: string,
    otherUserId: string,
  ): Promise<{ modifiedCount: number }> {
    if (!isValidObjectId(otherUserId)) {
      throw new BadRequestException('Định dạng ID người dùng không hợp lệ');
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
      throw new BadRequestException('Định dạng ID tin nhắn không hợp lệ');
    }

    const message = await this.messageModel.findById(id);
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    // Authorization: chỉ sender hoặc admin mới có thể xóa tin nhắn
    if (user.role !== 'admin' && user._id !== message.sender_id.toString()) {
      throw new ForbiddenException('Bạn chỉ có thể xóa tin nhắn của mình');
    }

    return await this.messageModel.findByIdAndDelete(id).exec();
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    try {
      const count = await this.messageModel
        .countDocuments({
          receiver_id: userId,
          is_read: { $ne: MessageStatus.READ },
        })
        .exec();

      return { count: count || 0 };
    } catch (error) {
      console.error('Error in getUnreadCount:', error);
      return { count: 0 };
    }
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
            avatar_url: '$user.avatar_url',
            name: '$user.name',
            role: '$user.role',
            lastMessageAt: '$lastMessage.sent_at',
          },
        },
        {
          $sort: { lastMessageAt: -1 },
        },
      ]);

      return users || [];
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
              avatar_url: 1,
              name: 1,
              role: 1,
            },
          },
        )
        .toArray();

      return users || [];
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  /**
   * Lấy thông tin profile của user cụ thể
   */
  async getUserProfile(
    userId: string,
    currentUserId: string,
  ): Promise<UserProfileResponse> {
    try {
      if (!isValidObjectId(userId)) {
        throw new BadRequestException('Định dạng ID người dùng không hợp lệ');
      }

      // Lấy thông tin user từ collection users
      const user = await this.messageModel.db.collection('users').findOne(
        { _id: new Types.ObjectId(userId) },
        {
          projection: {
            _id: 1,
            username: 1,
            email: 1,
            avatar_url: 1,
            name: 1,
            role: 1,
            phone: 1,
            is_verified: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      );

      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }

      // Lấy thêm thông tin chat history nếu có
      const hasMessageHistory = await this.messageModel.countDocuments({
        $or: [
          {
            sender_id: new Types.ObjectId(currentUserId),
            receiver_id: new Types.ObjectId(userId),
          },
          {
            sender_id: new Types.ObjectId(userId),
            receiver_id: new Types.ObjectId(currentUserId),
          },
        ],
      });

      return {
        ...user,
        hasMessageHistory: hasMessageHistory > 0,
      } as unknown as UserProfileResponse;
    } catch (error) {
      console.error('Error getting user profile:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Không thể lấy thông tin người dùng');
    }
  }

  /**
   * Lấy danh sách cuộc trò chuyện
   */
  async getConversations(userId: string): Promise<any[]> {
    return await this.findUserConversations(userId);
  }

  /**
   * Lấy tin nhắn trong cuộc trò chuyện
   */
  async getConversation(
    userId: string,
    otherUserId: string,
    query?: ConversationQueryDto,
  ): Promise<any[]> {
    try {
      const messages = await this.findConversation(userId, otherUserId);

      // Format all messages với emoji reactions
      const formattedMessages = this.formatMessagesWithReactions(messages);

      // Chỉ áp dụng limit khi user chủ động truyền vào
      if (query?.limit && typeof query.limit === 'number' && query.limit > 0) {
        return formattedMessages.slice(0, query.limit);
      }

      // Trả về toàn bộ tin nhắn với reactions đã format
      return formattedMessages || [];
    } catch (error) {
      console.error('Error in getConversation:', error);
      return [];
    }
  }

  /**
   * Tìm kiếm tin nhắn
   */
  async search(searchDto: MessageSearchDto, user: JwtPayload): Promise<any[]> {
    try {
      const userObjectId = new Types.ObjectId(user._id);

      const query: Record<string, any> = {
        $or: [{ sender_id: userObjectId }, { receiver_id: userObjectId }],
      };

      if (searchDto?.keyword && typeof searchDto.keyword === 'string') {
        query.content = { $regex: searchDto.keyword, $options: 'i' };
      }

      const messages = await this.messageModel
        .find(query)
        .populate('sender_id', 'username email name avatar_url')
        .populate('receiver_id', 'username email name avatar_url')
        .populate('reactions.user_id', 'username email name avatar_url')
        .populate(
          'reply_to_message_id',
          'content sender_id receiver_id sent_at',
        )
        .populate({
          path: 'reply_to_message_id',
          populate: {
            path: 'sender_id',
            select: 'username email name avatar_url',
          },
        })
        .sort({ sent_at: -1 })
        .limit(searchDto?.limit || 20)
        .exec();

      // Format all messages với emoji reactions
      return this.formatMessagesWithReactions(messages || []);
    } catch (error) {
      console.error('Error in search:', error);
      return [];
    }
  }

  /**
   * Thêm reaction với messageId
   */
  async addReaction(
    messageId: string,
    addReactionDto: AddReactionDto,
    user: JwtPayload,
  ): Promise<Message> {
    const dto = { ...addReactionDto, message_id: messageId };
    return await this.addReactionInternal(dto, user);
  }

  /**
   * Xóa reaction với messageId
   */
  async removeReaction(messageId: string, user: JwtPayload): Promise<Message> {
    const removeReactionDto: RemoveReactionDto = { message_id: messageId };
    return await this.removeReactionInternal(removeReactionDto, user);
  }

  // ==================== REACTIONS METHODS ====================

  private async addReactionInternal(
    addReactionDto: AddReactionDto,
    user: JwtPayload,
  ): Promise<Message> {
    const { message_id, type } = addReactionDto;

    if (!isValidObjectId(message_id)) {
      throw new BadRequestException('Định dạng ID tin nhắn không hợp lệ');
    }

    const message = await this.messageModel.findById(message_id);
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
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
      .populate('sender_id', 'username email name avatar_url')
      .populate('receiver_id', 'username email name avatar_url')
      .populate('reactions.user_id', 'username email name avatar_url')
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

  private async removeReactionInternal(
    removeReactionDto: RemoveReactionDto,
    user: JwtPayload,
  ): Promise<Message> {
    const { message_id } = removeReactionDto;

    if (!isValidObjectId(message_id)) {
      throw new BadRequestException('Định dạng ID tin nhắn không hợp lệ');
    }

    const message = await this.messageModel.findById(message_id);
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
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
      .populate('sender_id', 'username email name avatar_url')
      .populate('receiver_id', 'username email name avatar_url')
      .populate('reactions.user_id', 'username email name avatar_url')
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

  /**
   * Utility để format reaction response với emoji
   */
  private formatReactionResponse(message: Message): unknown {
    const formattedReactions = message.reactions.map((reaction) => {
      const populatedUser = reaction.user_id as unknown;
      const userObj = populatedUser as {
        _id?: unknown;
        username?: string;
        name?: string;
      };

      return {
        userId:
          typeof userObj === 'object' &&
          userObj &&
          '_id' in userObj &&
          typeof userObj._id === 'object' &&
          userObj._id &&
          'toString' in userObj._id
            ? (userObj._id as { toString(): string }).toString()
            : typeof reaction.user_id === 'object' &&
                reaction.user_id &&
                'toString' in reaction.user_id
              ? (reaction.user_id as { toString(): string }).toString()
              : 'unknown',
        username:
          typeof userObj === 'object' &&
          userObj &&
          'username' in userObj &&
          typeof userObj.username === 'string'
            ? userObj.username
            : typeof userObj === 'object' &&
                userObj &&
                'name' in userObj &&
                typeof userObj.name === 'string'
              ? userObj.name
              : 'Unknown User',
        type: reaction.type,
        created_at:
          reaction.created_at?.toISOString() || new Date().toISOString(),
      };
    });

    // Format reply message if exists
    let formattedReply: ReplyToMessage | null = null;
    if (message.reply_to_message_id) {
      const replyMessage = message.reply_to_message_id as unknown;
      const replyObj = replyMessage as {
        _id?: unknown;
        content?: string;
        sender_id?: unknown;
        sent_at?: Date;
      };

      if (typeof replyObj === 'object' && replyObj) {
        const senderId = replyObj.sender_id;
        const senderObj = senderId as {
          _id?: unknown;
          name?: string;
          username?: string;
          toString?(): string;
        };

        formattedReply = {
          message_id:
            typeof replyObj._id === 'object' &&
            replyObj._id &&
            'toString' in replyObj._id
              ? (replyObj._id as { toString(): string }).toString()
              : '',
          content: replyObj.content || '',
          sender_id:
            typeof senderObj === 'object' &&
            senderObj &&
            '_id' in senderObj &&
            typeof senderObj._id === 'object' &&
            senderObj._id &&
            'toString' in senderObj._id
              ? (senderObj._id as { toString(): string }).toString()
              : typeof senderObj === 'object' &&
                  senderObj &&
                  'toString' in senderObj &&
                  typeof senderObj.toString === 'function'
                ? senderObj.toString()
                : '',
          sender_name:
            typeof senderObj === 'object' &&
            senderObj &&
            'name' in senderObj &&
            typeof senderObj.name === 'string'
              ? senderObj.name
              : typeof senderObj === 'object' &&
                  senderObj &&
                  'username' in senderObj &&
                  typeof senderObj.username === 'string'
                ? senderObj.username
                : 'Unknown',
          sent_at: replyObj.sent_at || new Date(),
        };
      }
    }

    const messageObject = message.toObject() as Record<string, unknown>;
    const messageId = messageObject._id;
    return {
      ...messageObject,
      _id:
        typeof messageId === 'object' && messageId && 'toString' in messageId
          ? (messageId as { toString(): string }).toString()
          : '',
      reactions: formattedReactions,
      reply_to: formattedReply,
      reply_to_message_id: undefined,
    };
  }

  /**
   * Utility để format array of messages với emoji reactions
   */
  private formatMessagesWithReactions(messages: Message[]): unknown[] {
    return messages.map((message) => this.formatReactionResponse(message));
  }

  async toggleReaction(
    messageId: string,
    reactionType: ReactionType,
    user: JwtPayload,
  ): Promise<{ action: 'added' | 'removed'; message: unknown }> {
    if (!isValidObjectId(messageId)) {
      throw new BadRequestException('Định dạng ID tin nhắn không hợp lệ');
    }

    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    // Authorization check - user phải là sender hoặc receiver của cuộc trò chuyện
    const senderId = message.sender_id.toString();
    const receiverId = message.receiver_id.toString();

    if (user._id !== senderId && user._id !== receiverId) {
      throw new ForbiddenException(
        'Bạn chỉ có thể react vào tin nhắn trong cuộc trò chuyện của mình',
      );
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
          .populate('sender_id', 'username email name avatar_url')
          .populate('receiver_id', 'username email name avatar_url')
          .populate('reactions.user_id', 'username email name avatar_url')
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
          .populate('sender_id', 'username email name avatar_url')
          .populate('receiver_id', 'username email name avatar_url')
          .populate('reactions.user_id', 'username email name avatar_url')
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
        .populate('sender_id', 'username email name avatar_url')
        .populate('receiver_id', 'username email name avatar_url')
        .populate('reactions.user_id', 'username email name avatar_url')
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
      console.error('❌ Failed to emit reaction update:', error);
    }

    // Format response với emoji mapping
    const formattedMessage = this.formatReactionResponse(updatedMessage);

    return {
      action,
      message: formattedMessage,
    };
  }

  /**
   * Thu hồi tin nhắn
   */
  async recallMessage(messageId: string, user: JwtPayload): Promise<Message> {
    if (!isValidObjectId(messageId)) {
      throw new BadRequestException('Định dạng ID tin nhắn không hợp lệ');
    }

    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    // Authorization: chỉ người gửi mới có thể thu hồi tin nhắn của mình
    if (user.role !== 'admin' && user._id !== message.sender_id.toString()) {
      throw new ForbiddenException('Bạn chỉ có thể thu hồi tin nhắn của mình');
    }

    // Kiểm tra tin nhắn đã được thu hồi chưa
    if (message.is_recalled) {
      throw new BadRequestException('Tin nhắn đã được thu hồi trước đó');
    }

    // Cập nhật trạng thái thu hồi
    const updatedMessage = await this.messageModel
      .findByIdAndUpdate(
        messageId,
        {
          is_recalled: true,
          recalled_at: new Date(),
          content: 'Bạn đã thu hồi một tin nhắn', // Thay đổi nội dung để hiển thị
        },
        { new: true },
      )
      .populate('sender_id', 'username email name avatar_url')
      .populate('receiver_id', 'username email name avatar_url')
      .exec();

    if (!updatedMessage) {
      throw new NotFoundException('Failed to recall message');
    }

    // Emit real-time notification để cả 2 bên đều nhận được thông báo
    try {
      const senderId = message.sender_id.toString();
      const receiverId = message.receiver_id.toString();

      // Emit đến người nhận
      this.messagesGateway.emitMessageRecalled(updatedMessage, receiverId);

      // Emit đến người gửi (để sync trên các device khác)
      this.messagesGateway.emitMessageRecalled(updatedMessage, senderId);
    } catch (error) {
      console.error('Failed to emit message recall notification:', error);
    }

    return updatedMessage;
  }
}
