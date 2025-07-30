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
import { PropertyStaffResponseDto } from './dto/property-message.dto';
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

    // Nếu có property_id, kiểm tra staff assignment
    if (createMessageDto.property_id) {
      const isStaffAssigned =
        await this.propertyStaffAssignmentService.isStaffAssignedToProperty(
          new Types.ObjectId(createMessageDto.receiver_id),
          new Types.ObjectId(createMessageDto.property_id),
        );

      if (!isStaffAssigned) {
        throw new BadRequestException(
          'Staff không được assign cho property này',
        );
      }
    }

    // Convert string IDs to ObjectId before saving
    const messageData: any = {
      ...createMessageDto,
      sender_id: new Types.ObjectId(user._id),
      receiver_id: new Types.ObjectId(createMessageDto.receiver_id),
      sent_at: new Date(),
      is_read: MessageStatus.SENT,
    };

    // Add property_id if provided
    if (createMessageDto.property_id) {
      messageData.property_id = new Types.ObjectId(
        createMessageDto.property_id,
      );
    }

    // Add reply_to_message_id if provided
    if (createMessageDto.reply_to_message_id) {
      messageData.reply_to_message_id = new Types.ObjectId(
        createMessageDto.reply_to_message_id,
      );
    }

    const createdMessage = new this.messageModel(messageData);
    const savedMessage = await createdMessage.save();

    // Populate the saved message to get full data including reply info
    const populatedMessage = await this.messageModel
      .findById(savedMessage._id)
      .populate('sender_id', 'username email name avatar_url role')
      .populate('receiver_id', 'username email name avatar_url role')
      .populate('property_id', 'name address')
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

    // Emit realtime notification
    try {
      const messageId = extractMessageId(savedMessage);
      if (messageId && populatedMessage) {
        // Format message với đầy đủ thông tin reply và reactions
        const formattedMessage = this.formatReactionResponse(populatedMessage);

        // Emit realtime đơn giản - CHỈ SỬ DỤNG new_message EVENT
        // Emit đến người nhận
        this.messagesGateway.emitNewMessage(
          formattedMessage,
          createMessageDto.receiver_id,
        );

        // Emit đến người gửi (sync across devices)
        this.messagesGateway.emitNewMessage(formattedMessage, user._id);

        // Nếu có property_id, emit property message event
        if (createMessageDto.property_id) {
          this.messagesGateway.emitPropertyMessage(
            populatedMessage,
            createMessageDto.property_id,
          );
        }

        // Update delivered status nếu user online
        if (this.messagesGateway.isUserOnline(createMessageDto.receiver_id)) {
          await this.update(
            messageId,
            { is_read: MessageStatus.DELIVERED },
            user,
          );
        }

        // Tự động gửi thông báo cho người nhận
        try {
          const sender = populatedMessage.sender_id as {
            _id?: Types.ObjectId | string;
            name?: string;
            username?: string;
            avatar_url?: string;
          };
          const receiver = populatedMessage.receiver_id as {
            _id?: Types.ObjectId | string;
            role?: string;
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

          // Xác định recipient_type dựa trên role của người nhận
          let recipientType = RecipientType.GUEST;
          if (receiver?.role === 'staff') {
            recipientType = RecipientType.STAFF;
          } else if (receiver?.role === 'admin') {
            recipientType = RecipientType.ADMIN;
          }

          // Tạo message tùy theo loại tin nhắn
          let notificationTitle = 'Bạn có tin nhắn mới';
          let notificationMessage = `Bạn vừa nhận được tin nhắn từ ${senderName}`;

          // Nếu là tin nhắn property, thêm thông tin property
          if (createMessageDto.property_id) {
            const property = populatedMessage.property_id as {
              name?: string;
              address?: string;
            };
            const propertyName = property?.name || 'Property';
            notificationTitle = `Tin nhắn mới từ ${propertyName}`;
            notificationMessage = `${senderName} vừa gửi tin nhắn về ${propertyName}`;
          }

          await this.notificationsService.createAndSend({
            user_id: createMessageDto.receiver_id,
            recipient_type: recipientType,
            title: notificationTitle,
            message: notificationMessage,
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

        // Build filter
        const filter: any = {
          $or: [{ sender_id: userObjectId }, { receiver_id: userObjectId }],
        };

        // Add property_id filter if provided
        if (queryDto.property_id) {
          filter.property_id = new Types.ObjectId(queryDto.property_id);
        }

        messages = await this.messageModel
          .find(filter)
          .populate('sender_id', 'username email name avatar_url role')
          .populate('receiver_id', 'username email name avatar_url role')
          .populate('property_id', 'name address')
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
          .populate('sender_id', 'username email name avatar_url role')
          .populate('receiver_id', 'username email name avatar_url role')
          .populate('property_id', 'name address')
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
      .populate('sender_id', 'username email name avatar_url role')
      .populate('receiver_id', 'username email name avatar_url role')
      .populate('property_id', 'name address')
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
        .populate('sender_id', 'username email name avatar_url role')
        .populate('receiver_id', 'username email name avatar_url role')
        .populate('property_id', 'name address')
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
            as: 'userInfo',
          },
        },
        {
          $unwind: {
            path: '$userInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            'lastMessage.sender_id': {
              $cond: [
                { $eq: [{ $type: '$lastMessage.sender_id' }, 'objectId'] },
                '$lastMessage.sender_id',
                { $toObjectId: '$lastMessage.sender_id' },
              ],
            },
            'lastMessage.receiver_id': {
              $cond: [
                { $eq: [{ $type: '$lastMessage.receiver_id' }, 'objectId'] },
                '$lastMessage.receiver_id',
                { $toObjectId: '$lastMessage.receiver_id' },
              ],
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'lastMessage.sender_id',
            foreignField: '_id',
            as: 'senderInfo',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'lastMessage.receiver_id',
            foreignField: '_id',
            as: 'receiverInfo',
          },
        },
        {
          $unwind: {
            path: '$senderInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $unwind: {
            path: '$receiverInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            lastMessage: {
              _id: '$lastMessage._id',
              content: '$lastMessage.content',
              sent_at: '$lastMessage.sent_at',
              is_read: '$lastMessage.is_read',
              sender_id: {
                _id: '$senderInfo._id',
                username: '$senderInfo.username',
                email: '$senderInfo.email',
                name: '$senderInfo.name',
                avatar_url: '$senderInfo.avatar_url',
                role: '$senderInfo.role',
              },
              receiver_id: {
                _id: '$receiverInfo._id',
                username: '$receiverInfo.username',
                email: '$receiverInfo.email',
                name: '$receiverInfo.name',
                avatar_url: '$receiverInfo.avatar_url',
                role: '$receiverInfo.role',
              },
            },
            unreadCount: 1,
            userInfo: {
              _id: '$userInfo._id',
              username: '$userInfo.username',
              email: '$userInfo.email',
              name: '$userInfo.name',
              avatar_url: '$userInfo.avatar_url',
              role: '$userInfo.role',
            },
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
      const { keyword, limit = 10 } = searchDto;
      const userObjectId = new Types.ObjectId(user._id);

      if (!keyword || keyword.trim().length === 0) {
        return [];
      }

      const query: Record<string, any> = {
        $or: [{ sender_id: userObjectId }, { receiver_id: userObjectId }],
      };

      if (keyword && typeof keyword === 'string') {
        query.content = { $regex: keyword, $options: 'i' };
      }

      const messages = await this.messageModel
        .find(query)
        .populate('sender_id', 'username email name avatar_url role')
        .populate('receiver_id', 'username email name avatar_url role')
        .populate('property_id', 'name address')
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
        .limit(limit)
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
   * Xóa reaction với messageId và type
   */
  async removeReaction(
    messageId: string,
    type: ReactionType,
    user: JwtPayload,
  ): Promise<unknown> {
    const removeReactionDto: RemoveReactionDto = {
      message_id: messageId,
      type,
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

    const message = await this.messageModel
      .findById(message_id)
      .populate('sender_id', 'username email name avatar_url role')
      .populate('receiver_id', 'username email name avatar_url role')
      .populate('property_id', 'name address')
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

    // Authorization: chỉ sender hoặc receiver mới reaction được
    const senderId = message.sender_id.toString();
    const receiverId = message.receiver_id.toString();

    if (
      user.role !== 'admin' &&
      user._id !== senderId &&
      user._id !== receiverId
    ) {
      throw new ForbiddenException('Bạn chỉ có thể reaction tin nhắn của mình');
    }

    // Check if user already reacted with this type
    const existingReaction = message.reactions.find(
      (reaction) =>
        reaction.user_id.toString() === user._id && reaction.type === type,
    );

    if (existingReaction) {
      throw new BadRequestException(
        `Bạn đã reaction với ${type} cho tin nhắn này rồi`,
      );
    }

    // Add new reaction
    message.reactions.push({
      user_id: new Types.ObjectId(user._id),
      type,
      created_at: new Date(),
    });

    const updatedMessage = await message.save();

    // Format reactions với emoji
    return this.formatReactionResponse(updatedMessage) as Message;
  }

  private async removeReactionInternal(
    removeReactionDto: RemoveReactionDto,
    user: JwtPayload,
  ): Promise<Message> {
    const { message_id, type } = removeReactionDto;

    if (!isValidObjectId(message_id)) {
      throw new BadRequestException('Định dạng ID tin nhắn không hợp lệ');
    }

    const message = await this.messageModel
      .findById(message_id)
      .populate('sender_id', 'username email name avatar_url role')
      .populate('receiver_id', 'username email name avatar_url role')
      .populate('property_id', 'name address')
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

    // Authorization: chỉ sender hoặc receiver mới remove reaction được
    const senderId = message.sender_id.toString();
    const receiverId = message.receiver_id.toString();

    if (
      user.role !== 'admin' &&
      user._id !== senderId &&
      user._id !== receiverId
    ) {
      throw new ForbiddenException(
        'Bạn chỉ có thể remove reaction tin nhắn của mình',
      );
    }

    // Find and remove the reaction
    const reactionIndex = message.reactions.findIndex(
      (reaction) =>
        reaction.user_id.toString() === user._id && reaction.type === type,
    );

    if (reactionIndex === -1) {
      throw new BadRequestException(
        `Bạn chưa reaction với ${type} cho tin nhắn này`,
      );
    }

    message.reactions.splice(reactionIndex, 1);
    const updatedMessage = await message.save();

    // Format reactions với emoji
    return this.formatReactionResponse(updatedMessage) as Message;
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

    const message = await this.messageModel
      .findById(messageId)
      .populate('sender_id', 'username email name avatar_url role')
      .populate('receiver_id', 'username email name avatar_url role')
      .populate('property_id', 'name address')
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

    // Authorization: chỉ sender hoặc receiver mới reaction được
    const senderId = message.sender_id.toString();
    const receiverId = message.receiver_id.toString();

    if (
      user.role !== 'admin' &&
      user._id !== senderId &&
      user._id !== receiverId
    ) {
      throw new ForbiddenException('Bạn chỉ có thể reaction tin nhắn của mình');
    }

    // Check if user already reacted with this type
    const existingReactionIndex = message.reactions.findIndex(
      (reaction) =>
        reaction.user_id.toString() === user._id &&
        reaction.type === reactionType,
    );

    if (existingReactionIndex !== -1) {
      // Remove existing reaction
      message.reactions.splice(existingReactionIndex, 1);
      const updatedMessage = await message.save();

      // Emit reaction update to other participants
      const otherUserId = user._id === senderId ? receiverId : senderId;
      this.messagesGateway.emitReactionUpdate(updatedMessage, otherUserId);

      return {
        action: 'removed',
        message: this.formatReactionResponse(updatedMessage),
      };
    } else {
      // Add new reaction
      message.reactions.push({
        user_id: new Types.ObjectId(user._id),
        type: reactionType,
        created_at: new Date(),
      });

      const updatedMessage = await message.save();

      // Emit reaction update to other participants
      const otherUserId = user._id === senderId ? receiverId : senderId;
      this.messagesGateway.emitReactionUpdate(updatedMessage, otherUserId);

      return {
        action: 'added',
        message: this.formatReactionResponse(updatedMessage),
      };
    }
  }

  /**
   * Thu hồi tin nhắn
   */
  async recallMessage(messageId: string, user: JwtPayload): Promise<Message> {
    if (!isValidObjectId(messageId)) {
      throw new BadRequestException('Định dạng ID tin nhắn không hợp lệ');
    }

    const message = await this.messageModel
      .findById(messageId)
      .populate('sender_id', 'username email name avatar_url role')
      .populate('receiver_id', 'username email name avatar_url role')
      .populate('property_id', 'name address')
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

    // Authorization: chỉ sender mới recall được tin nhắn
    const senderId = message.sender_id.toString();

    if (user.role !== 'admin' && user._id !== senderId) {
      throw new ForbiddenException('Bạn chỉ có thể recall tin nhắn của mình');
    }

    // Check if message is within recall time limit (e.g., 5 minutes)
    const messageTime = new Date(message.sent_at);
    const currentTime = new Date();
    const timeDifference = currentTime.getTime() - messageTime.getTime();
    const recallTimeLimit = 5 * 60 * 1000; // 5 minutes in milliseconds

    if (timeDifference > recallTimeLimit) {
      throw new BadRequestException(
        'Chỉ có thể recall tin nhắn trong vòng 5 phút sau khi gửi',
      );
    }

    // Mark message as recalled
    message.is_recalled = true;
    message.recalled_at = new Date();
    message.content = '[Tin nhắn đã được thu hồi]';

    const updatedMessage = await message.save();

    // Emit recall notification to other participants
    const receiverId = message.receiver_id.toString();
    this.messagesGateway.emitMessageRecalled(updatedMessage, receiverId);

    // Format reactions với emoji
    return this.formatReactionResponse(updatedMessage) as Message;
  }

  // =========================== PROPERTY MESSAGES METHODS ===========================

  /**
   * Lấy danh sách staff của property
   */
  async getPropertyStaff(
    propertyId: string,
  ): Promise<PropertyStaffResponseDto[]> {
    const staffAssignments =
      await this.propertyStaffAssignmentService.getStaffByProperty(
        new Types.ObjectId(propertyId),
      );

    return staffAssignments.map((assignment) => ({
      _id: assignment.staffId.toString(),
      name: assignment.staffId['name'] || 'Unknown',
      email: assignment.staffId['email'] || '',
      phone: assignment.staffId['phone'] || '',
      avatar_url: assignment.staffId['avatar_url'] || '',
      role: assignment.staffId['role'] || 'staff',
      is_online: false, // Có thể tích hợp với online status sau
      last_seen: new Date(),
    }));
  }

  /**
   * Lấy danh sách properties mà staff được assign
   */
  async getStaffProperties(staffId: string): Promise<any[]> {
    const propertyAssignments =
      await this.propertyStaffAssignmentService.getPropertiesByStaff(
        new Types.ObjectId(staffId),
      );

    return propertyAssignments.map((assignment) => ({
      _id: assignment.propertyId._id.toString(),
      name: (assignment.propertyId as any).name || 'Unknown',
      type: (assignment.propertyId as any).type || '',
      address: (assignment.propertyId as any).address || '',
      assignedAt: assignment.assignedAt,
      assignedBy: assignment.assignedBy,
    }));
  }

  /**
   * Kiểm tra staff có được assign cho property không
   */
  async isStaffAssignedToProperty(
    staffId: string,
    propertyId: string,
  ): Promise<boolean> {
    return this.propertyStaffAssignmentService.isStaffAssignedToProperty(
      new Types.ObjectId(staffId),
      new Types.ObjectId(propertyId),
    );
  }
}
