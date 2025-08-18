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
import { extractMessageId, isValidObjectId } from './utils/message.util';
import {
  ReplyToMessage,
  UserProfileResponse,
} from './interfaces/message.interface';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationType,
  RecipientType,
  SentMethod,
} from '../notifications/schemas/notification.schema';
import { PropertyStaffAssignmentService } from '../property-staff-assignment/property-staff-assignment.service';

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
    private readonly notificationsService: NotificationsService,
    private readonly propertyStaffAssignmentService: PropertyStaffAssignmentService,
  ) {}

  async create(
    createMessageDto: CreateMessageDto,
    user: JwtPayload,
  ): Promise<Message> {
    try {
      // Kiểm tra nếu là property message
      if (createMessageDto.property_id) {
        const isAssigned =
          await this.propertyStaffAssignmentService.isStaffAssignedToProperty(
            new Types.ObjectId(user._id),
            new Types.ObjectId(createMessageDto.property_id),
          );
        if (!isAssigned) {
          throw new BadRequestException(
            'Staff không được assign cho property này',
          );
        }
      }

      // Kiểm tra reply message
      if (createMessageDto.reply_to_message_id) {
        const replyMessage = await this.messageModel.findById(
          createMessageDto.reply_to_message_id,
        );
        if (!replyMessage) {
          throw new BadRequestException('Tin nhắn reply không tồn tại');
        }
      }

      // Tạo message mới
      const messageData = {
        ...createMessageDto,
        sender_id: user._id,
        sent_at: new Date(),
        is_read: MessageStatus.SENT,
      };

      const savedMessage = await this.messageModel.create(messageData);

      // Populate thông tin đầy đủ
      const populatedMessage = await this.messageModel
        .findById(savedMessage._id)
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
        .exec();

      // Emit realtime notification
      try {
        const messageId = extractMessageId(savedMessage);
        if (messageId && populatedMessage) {
          // Format message với đầy đủ thông tin reply và reactions
          const formattedMessage =
            this.formatReactionResponse(populatedMessage);

          // Emit realtime đơn giản - CHỈ SỬ DỤNG new_message EVENT
          // Emit đến người nhận
          this.messagesGateway.emitNewMessage(
            formattedMessage,
            createMessageDto.receiver_id,
          );

          // Emit đến người gửi (sync across devices)
          this.messagesGateway.emitNewMessage(formattedMessage, user._id);

          // Update delivered status nếu user online
          if (this.messagesGateway.isUserOnline(createMessageDto.receiver_id)) {
            await this.update(
              messageId,
              { is_read: MessageStatus.DELIVERED },
              user,
            );
          }

          // Emit cập nhật tóm tắt cuộc trò chuyện cho cả hai phía
          const senderId = user._id;
          const receiverId = createMessageDto.receiver_id;

          try {
            const senderSummary = await this.computeConversationSummary(
              senderId,
              receiverId,
            );
            this.messagesGateway.emitConversationUpdate(senderId, {
              otherUserId: receiverId,
              ...senderSummary,
            });

            const receiverSummary = await this.computeConversationSummary(
              receiverId,
              senderId,
            );
            this.messagesGateway.emitConversationUpdate(receiverId, {
              otherUserId: senderId,
              ...receiverSummary,
            });
          } catch (err) {
            console.error('Failed to emit conversation summary:', err);
          }

          // Tự động gửi thông báo cho người nhận
          try {
            const sender = populatedMessage.sender_id as {
              _id?: Types.ObjectId | string;
              name?: string;
              username?: string;
              avatar_url?: string;
            };
            const senderName =
              typeof sender?.name === 'string'
                ? sender.name
                : typeof sender?.username === 'string'
                  ? sender.username
                  : 'Someone';
            const senderUserId = sender?._id ? sender._id.toString() : user._id;
            const avatar_url =
              typeof sender?.avatar_url === 'string' ? sender.avatar_url : '';
            await this.notificationsService.createAndSend({
              user_id: createMessageDto.receiver_id,
              recipient_type: RecipientType.GUEST, // Có thể cần logic để xác định role
              title: 'Bạn có tin nhắn mới',
              message: `Bạn vừa nhận được tin nhắn từ ${senderName}`,
              type: NotificationType.MESSAGE,
              sent_method: [SentMethod.IN_APP, SentMethod.PUSH],
              sender_user_id: senderUserId,
              avatar_url,
            });
          } catch (notificationError) {
            console.error(
              'Failed to send message notification:',
              notificationError,
            );
          }
        }
      } catch (error) {
        console.error('Failed to emit realtime message:', error);
      }

      return populatedMessage || savedMessage;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Không thể tạo tin nhắn');
    }
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
  ): Promise<unknown[]> {
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

      // Format all messages với emoji reactions
      return this.formatMessagesWithReactions(messages || []);
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

    const updated = await this.messageModel
      .findByIdAndUpdate(
        messageId,
        { is_read: MessageStatus.READ },
        { new: true },
      )
      .populate('sender_id', 'username email name avatar_url')
      .populate('receiver_id', 'username email name avatar_url')
      .exec();

    try {
      const senderId =
        (updated?.sender_id as any)?._id?.toString?.() ||
        (updated?.sender_id as any)?.toString?.();
      const receiverId =
        (updated?.receiver_id as any)?._id?.toString?.() ||
        (updated?.receiver_id as any)?.toString?.();
      if (senderId && receiverId) {
        const receiverSummary = await this.computeConversationSummary(
          receiverId,
          senderId,
        );
        this.messagesGateway.emitConversationUpdate(receiverId, {
          otherUserId: senderId,
          ...receiverSummary,
        });

        const senderSummary = await this.computeConversationSummary(
          senderId,
          receiverId,
        );
        this.messagesGateway.emitConversationUpdate(senderId, {
          otherUserId: receiverId,
          ...senderSummary,
        });
      }
    } catch (err) {
      console.error(
        'Failed to emit conversation summary after markAsRead:',
        err,
      );
    }

    return updated;
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

    try {
      const currentUserSummary = await this.computeConversationSummary(
        userId,
        otherUserId,
      );
      this.messagesGateway.emitConversationUpdate(userId, {
        otherUserId,
        ...currentUserSummary,
      });

      const otherUserSummary = await this.computeConversationSummary(
        otherUserId,
        userId,
      );
      this.messagesGateway.emitConversationUpdate(otherUserId, {
        otherUserId: userId,
        ...otherUserSummary,
      });
    } catch (err) {
      console.error(
        'Failed to emit conversation summary after markConversationAsRead:',
        err,
      );
    }

    return { modifiedCount: result.modifiedCount };
  }

  /**
   * Tính toán tóm tắt cuộc trò chuyện giữa 2 user
   */
  private async computeConversationSummary(
    userId: string,
    otherUserId: string,
  ): Promise<{
    lastMessage: {
      _id: string;
      content: string;
      senderId: string;
      type: string;
      sent_at: Date;
    } | null;
    lastMessageAt: Date | null;
    unreadCounts: Record<string, number>;
  }> {
    const userObjectId = new Types.ObjectId(userId);
    const otherUserObjectId = new Types.ObjectId(otherUserId);

    const matchBetweenUsers = {
      $or: [
        // ObjectId format
        { sender_id: userObjectId, receiver_id: otherUserObjectId },
        { sender_id: otherUserObjectId, receiver_id: userObjectId },
        // Legacy string format
        {
          sender_id: userId as unknown as any,
          receiver_id: otherUserId as unknown as any,
        },
        {
          sender_id: otherUserId as unknown as any,
          receiver_id: userId as unknown as any,
        },
      ],
    } as any;

    const lastMessageDoc = await this.messageModel
      .findOne(matchBetweenUsers)
      .sort({ sent_at: -1 })
      .select({ _id: 1, content: 1, sender_id: 1, sent_at: 1 })
      .lean();

    const normalizeId = (val: any): string => {
      if (!val) return '';
      if (typeof val === 'string') return val;
      if (val && typeof val === 'object') {
        if ('_id' in val && (val as any)._id) {
          const v = (val as any)._id;
          return typeof v === 'string' ? v : v.toString();
        }
        return (val as any).toString?.() || '';
      }
      return String(val);
    };

    const lastMessage = lastMessageDoc
      ? {
          _id: normalizeId((lastMessageDoc as any)._id),
          content: (lastMessageDoc as any).content || '',
          senderId: normalizeId((lastMessageDoc as any).sender_id),
          // Hiện tại chưa có phân loại type theo nội dung, default 'text'
          type: 'text',
          sent_at: (lastMessageDoc as any).sent_at as Date,
        }
      : null;

    const lastMessageAt = lastMessage ? (lastMessage.sent_at as Date) : null;

    // Đếm unread cho từng user
    const countUnreadFor = async (
      receiver: { id: string; obj: Types.ObjectId },
      sender: { id: string; obj: Types.ObjectId },
    ) =>
      this.messageModel.countDocuments({
        $and: [
          {
            $or: [{ receiver_id: receiver.obj }, { receiver_id: receiver.id }],
          },
          { $or: [{ sender_id: sender.obj }, { sender_id: sender.id }] },
          { is_read: { $ne: MessageStatus.READ } },
        ],
      });

    const [unreadForUser, unreadForOther] = await Promise.all([
      countUnreadFor(
        { id: userId, obj: userObjectId },
        { id: otherUserId, obj: otherUserObjectId },
      ),
      countUnreadFor(
        { id: otherUserId, obj: otherUserObjectId },
        { id: userId, obj: userObjectId },
      ),
    ]);

    const unreadCounts: Record<string, number> = {
      [userId]: unreadForUser,
      [otherUserId]: unreadForOther,
    };

    return { lastMessage, lastMessageAt, unreadCounts };
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
    const base = await this.findUserConversations(userId);
    const enriched = await Promise.all(
      (base || []).map(async (conv: any) => {
        const lastMsg = conv?.lastMessage || {};
        const rawSender = lastMsg?.sender_id;
        const rawReceiver = lastMsg?.receiver_id;
        const senderId =
          typeof rawSender === 'string'
            ? rawSender
            : rawSender?._id?.toString?.() || rawSender?.toString?.() || '';
        const receiverId =
          typeof rawReceiver === 'string'
            ? rawReceiver
            : rawReceiver?._id?.toString?.() || rawReceiver?.toString?.() || '';
        const otherUserId = senderId === userId ? receiverId : senderId;

        const summary = otherUserId
          ? await this.computeConversationSummary(userId, otherUserId)
          : { lastMessage: null, lastMessageAt: null, unreadCounts: {} };

        return {
          ...conv,
          unreadCount:
            summary?.unreadCounts && userId in summary.unreadCounts
              ? summary.unreadCounts[userId]
              : conv?.unreadCount || 0,
          lastMessage: summary.lastMessage,
          lastMessageAt: summary.lastMessageAt,
          unreadCounts: summary.unreadCounts,
        };
      }),
    );
    return enriched;
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

      // Chỉ áp dụng limit khi user chủ động truyền vào
      if (query?.limit && typeof query.limit === 'number' && query.limit > 0) {
        return messages.slice(0, query.limit);
      }

      // Trả về toàn bộ tin nhắn với reactions đã format
      return messages || [];
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
  ): Promise<unknown> {
    const dto = { ...addReactionDto, message_id: messageId };
    const message = await this.addReactionInternal(dto, user);
    return this.formatReactionResponse(message);
  }

  /**
   * Xóa reaction với messageId
   */
  async removeReaction(messageId: string, user: JwtPayload): Promise<unknown> {
    const removeReactionDto: RemoveReactionDto = {
      message_id: messageId,
      type: undefined,
    };
    const message = await this.removeReactionInternal(removeReactionDto, user);
    return this.formatReactionResponse(message);
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
      // Emit to both sender and receiver (sync all devices)
      this.messagesGateway.emitReactionUpdate(updatedMessage, senderId);
      this.messagesGateway.emitReactionUpdate(updatedMessage, receiverId);
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
    // Emoji mapping cho reactions
    const emojiMap = {
      [ReactionType.LIKE]: '👍',
      [ReactionType.LOVE]: '❤️',
      [ReactionType.LAUGH]: '😂',
      [ReactionType.WOW]: '😮',
      [ReactionType.SAD]: '😢',
      [ReactionType.ANGRY]: '😡',
    };

    const formattedReactions = message.reactions.map((reaction) => {
      // Type assertion with proper interface
      const populatedUser = reaction.user_id as unknown as {
        _id?: Types.ObjectId;
        username?: string;
        name?: string;
        avatar_url?: string;
      };

      return {
        userId:
          populatedUser?._id?.toString() ||
          reaction.user_id?.toString() ||
          'unknown',
        username:
          populatedUser?.username || populatedUser?.name || 'Unknown User',
        avatar_url: populatedUser?.avatar_url || null,
        type: reaction.type,
        emoji: emojiMap[reaction.type] || '👍',
        created_at:
          reaction.created_at?.toISOString() || new Date().toISOString(),
      };
    });

    // Format reply message if exists
    let formattedReply: ReplyToMessage | null = null;
    if (message.reply_to_message_id) {
      // Type assertion with proper interface
      const replyMessage = message.reply_to_message_id as unknown as {
        _id?: Types.ObjectId;
        content?: string;
        sender_id?: {
          _id?: Types.ObjectId;
          name?: string;
          username?: string;
        };
        sent_at?: Date;
      };

      formattedReply = {
        message_id: replyMessage._id?.toString() || '',
        content: replyMessage.content || '',
        sender_id:
          replyMessage.sender_id?._id?.toString() ||
          (replyMessage.sender_id as unknown as Types.ObjectId)?.toString() ||
          '',
        sender_name:
          replyMessage.sender_id?.name ||
          replyMessage.sender_id?.username ||
          'Unknown',
        sent_at: replyMessage.sent_at || new Date(),
      };
    }

    const messageObject = message.toObject() as Record<string, unknown>;
    return {
      ...messageObject,
      _id: (messageObject._id as Types.ObjectId).toString(),
      reactions: formattedReactions,
      reply_to: formattedReply,
      reply_to_message_id: undefined, // Remove this to avoid duplication
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
      // Emit to both sender and receiver (sync all devices)
      this.messagesGateway.emitReactionUpdate(updatedMessage, senderId);
      this.messagesGateway.emitReactionUpdate(updatedMessage, receiverId);
    } catch (error) {
      console.error('Failed to emit reaction update:', error);
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

      // Đồng bộ cập nhật tóm tắt cuộc trò chuyện sau khi thu hồi
      try {
        const senderSummary = await this.computeConversationSummary(
          senderId,
          receiverId,
        );
        this.messagesGateway.emitConversationUpdate(senderId, {
          otherUserId: receiverId,
          ...senderSummary,
        });

        const receiverSummary = await this.computeConversationSummary(
          receiverId,
          senderId,
        );
        this.messagesGateway.emitConversationUpdate(receiverId, {
          otherUserId: senderId,
          ...receiverSummary,
        });
      } catch (err) {
        console.error('Failed to emit conversation summary after recall:', err);
      }
    } catch (error) {
      console.error('Failed to emit message recall notification:', error);
    }

    return updatedMessage;
  }
}
