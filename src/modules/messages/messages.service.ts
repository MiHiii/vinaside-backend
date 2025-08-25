import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { AddReactionDto, RemoveReactionDto } from './dto/reaction.dto';
import { Message, MessageStatus, ReactionType } from './schemas/message.schema';
import { Conversation } from './schemas/conversation.schema';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { MessagesGateway } from './messages.gateway';
import { removeUndefinedObject } from '../../utils/common.util';
import { isValidObjectId } from './utils/message.util';
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

// ==== SAFE TYPES FOR LEAN DOCS & HELPERS ====
type ReadAtDict = Record<string, Date>;

interface ConversationLeanBasic {
  _id: Types.ObjectId;
  property_id: Types.ObjectId;
  guest_id: Types.ObjectId;
  staff_ids?: Types.ObjectId[];
  last_message_at?: Date | null;
  last_active_staff_id?: Types.ObjectId | null;
  read_at?: ReadAtDict;
}

interface LeanMessageMinimal {
  _id: Types.ObjectId;
  content?: string;
  sender_id:
    | Types.ObjectId
    | {
        _id: Types.ObjectId;
        name?: string;
        username?: string;
        avatar_url?: string | null;
        role?: string;
      };
  sent_at: Date;
  is_read: MessageStatus;
}

interface PropertyLeanBasic {
  _id: Types.ObjectId;
  name?: string;
  thumbnail?: string | null;
  status?: string;
  isVerified?: boolean;
}

interface UserLeanBasic {
  _id: Types.ObjectId;
  name?: string;
  username?: string;
  avatar_url?: string | null;
  role?: string;
}

type ConversationDisplay = {
  title: string;
  subtitle: string;
  avatar_url: string | null;
  badge: null | { text: string; avatar_url: string | null };
  unreadCount: number;
};

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
    @Inject(forwardRef(() => MessagesGateway))
    private readonly messagesGateway: MessagesGateway,
    private readonly notificationsService: NotificationsService,
    private readonly propertyStaffAssignmentService: PropertyStaffAssignmentService,
  ) {}

  async create(
    createMessageDto: CreateMessageDto,
    user: JwtPayload,
  ): Promise<Message> {
    // New conversation-based flow only
    if (
      createMessageDto.conversation_id ||
      createMessageDto.property_id ||
      createMessageDto.guest_id
    ) {
      return this.createByConversationFlow(createMessageDto, user);
    }
    throw new BadRequestException(
      'Legacy direct message flow đã deprecated. Vui lòng dùng conversation-based (conversation_id/property_id + guest_id).',
    );
  }

  // ==================== NEW CONVERSATION-BASED FLOW ====================
  private async resolveConversationV2(
    dto: CreateMessageDto,
    user: JwtPayload,
  ): Promise<{
    conversation: ConversationLeanBasic;
    propertyId: Types.ObjectId;
    guestId: Types.ObjectId;
  }> {
    if (dto.conversation_id) {
      const convId = dto.conversation_id;
      if (!isValidObjectId(convId)) {
        throw new BadRequestException('conversation_id không hợp lệ');
      }
      const conversation = await this.conversationModel
        .findById(convId)
        .lean<ConversationLeanBasic | null>();
      if (!conversation) {
        throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
      }
      const propertyId: Types.ObjectId = conversation.property_id;
      const guestId: Types.ObjectId = conversation.guest_id;
      if (user.role !== 'admin') {
        if (user.role === 'guest') {
          if (guestId.toString() !== user._id) {
            throw new ForbiddenException(
              'Bạn không có quyền trong conversation',
            );
          }
        } else if (user.role === 'staff') {
          const assigned =
            await this.propertyStaffAssignmentService.isStaffAssignedToProperty(
              new Types.ObjectId(user._id),
              propertyId,
            );
          if (!assigned) {
            throw new ForbiddenException(
              'Staff không được assign property này',
            );
          }
        }
      }
      return { conversation, propertyId, guestId };
    }

    const propertyIdStr = dto.property_id;
    if (!propertyIdStr || !isValidObjectId(propertyIdStr)) {
      throw new BadRequestException('Thiếu hoặc sai property_id');
    }
    const propertyId = new Types.ObjectId(propertyIdStr);

    let guestId: Types.ObjectId;
    if (user.role === 'guest') {
      guestId = new Types.ObjectId(user._id);
    } else if (user.role === 'staff') {
      const guestIdStr = dto.guest_id;
      if (!guestIdStr || !isValidObjectId(guestIdStr)) {
        throw new BadRequestException('Thiếu hoặc sai guest_id cho staff');
      }
      const assigned =
        await this.propertyStaffAssignmentService.isStaffAssignedToProperty(
          new Types.ObjectId(user._id),
          propertyId,
        );
      if (!assigned) {
        throw new ForbiddenException('Staff không được assign property này');
      }
      guestId = new Types.ObjectId(guestIdStr);
    } else {
      const guestIdStr = dto.guest_id;
      if (!guestIdStr || !isValidObjectId(guestIdStr)) {
        throw new BadRequestException('Thiếu guest_id');
      }
      guestId = new Types.ObjectId(guestIdStr);
    }

    const conversationDoc = await this.conversationModel.findOneAndUpdate(
      {
        type: 'property',
        property_id: propertyId,
        guest_id: guestId,
      },
      {
        $setOnInsert: {
          type: 'property',
          property_id: propertyId,
          guest_id: guestId,
          read_at: {},
        },
      },
      { new: true, upsert: true },
    );
    const conversation = (await this.conversationModel
      .findById(conversationDoc._id)
      .lean<ConversationLeanBasic>()) as ConversationLeanBasic;

    return { conversation, propertyId, guestId };
  }

  private async createByConversationFlow(
    dto: CreateMessageDto,
    user: JwtPayload,
  ): Promise<Message> {
    const { conversation, propertyId, guestId } =
      await this.resolveConversationV2(dto, user);

    // Validate reply_to_message_id belongs to the same conversation
    if (dto.reply_to_message_id) {
      if (!isValidObjectId(dto.reply_to_message_id)) {
        throw new BadRequestException('reply_to_message_id không hợp lệ');
      }
      const ref = await this.messageModel
        .findById(dto.reply_to_message_id)
        .lean();
      if (
        !ref ||
        this.getIdString(ref.conversation_id) !==
          this.getIdString(conversation._id)
      ) {
        throw new BadRequestException(
          'reply_to_message_id không thuộc conversation này',
        );
      }
    }

    const payload: Partial<Message> = {
      conversation_id: conversation._id,
      property_id: propertyId,
      guest_id: guestId,
      sender_id: new Types.ObjectId(user._id),
      receiver_id: dto.receiver_id
        ? new Types.ObjectId(dto.receiver_id)
        : undefined,
      content: dto.content,
      sent_at: new Date(),
      is_read: MessageStatus.SENT,
      reply_to_message_id: dto.reply_to_message_id
        ? new Types.ObjectId(dto.reply_to_message_id)
        : undefined,
    } as Partial<Message>;

    const saved = await this.messageModel.create(payload);

    // Update conversation summary
    const now = new Date();
    const update: {
      $set: Record<string, unknown>;
      $addToSet?: Record<string, unknown>;
    } = {
      $set: { last_message_id: saved._id, last_message_at: now },
    };
    if (user.role === 'staff') {
      update.$addToSet = { staff_ids: new Types.ObjectId(user._id) };
      update.$set.last_active_staff_id = new Types.ObjectId(user._id);
      update.$set.last_active_staff_at = now;
    }
    await this.conversationModel.updateOne({ _id: conversation._id }, update);

    const populated = await this.messageModel
      .findById(saved._id)
      .populate('sender_id', 'username email name avatar_url role')
      .populate('receiver_id', 'username email name avatar_url')
      .populate('reactions.user_id', 'username email name avatar_url')
      .populate('reply_to_message_id', 'content sender_id receiver_id sent_at')
      .exec();

    // Realtime: emit to guest and assigned staff + conversation updates
    try {
      const formatted = this.formatReactionResponse(populated as Message);
      // Emit to all participants
      const conv = await this.conversationModel
        .findById(conversation._id)
        .lean();
      const participantIds = await this.participantsOfConversation(conv);

      console.log('🔍 Emitting new message to participants:', {
        conversationId: this.getIdString(conversation._id),
        senderId: user._id,
        participantIds,
        formattedMessage: {
          content: formatted.content,
          sender_id: formatted.sender_id,
          sent_at: formatted.sent_at,
        },
      });

      // Emit to all participants (non-blocking per user)
      for (const uid of participantIds) {
        console.log(`🔍 Emitting to participant: ${uid}`);
        const isUserOnline = this.messagesGateway.isUserOnline(uid);
        console.log(`🔍 Participant ${uid} online status: ${isUserOnline}`);
        try {
          void this.messagesGateway.emitNewMessage(formatted, uid);
          console.log(`🔍 Successfully emitted to participant: ${uid}`);
        } catch (emitError) {
          console.error(`🔍 Failed to emit to participant ${uid}:`, emitError);
        }
      }

      // Emit to admin broadcast room for admin users
      try {
        this.messagesGateway.emitNewMessageToAdminBroadcast(
          formatted,
          this.getIdString(conversation._id),
          this.getIdString(propertyId),
          this.getIdString(guestId),
        );
        console.log(
          '🔍 Emitted new message to admin broadcast room with data:',
          {
            messageId: formatted._id,
            conversationId: this.getIdString(conversation._id),
            content: formatted.content,
            sender_id: formatted.sender_id,
          },
        );
      } catch (adminEmitError) {
        console.error(
          '🔍 Failed to emit to admin broadcast room:',
          adminEmitError,
        );
      }

      // Notifications: notify all participants except sender
      try {
        const recipients = participantIds.filter((id) => id !== user._id);
        for (const rid of recipients) {
          await this.notificationsService.createAndSend({
            user_id: rid,
            recipient_type: RecipientType.GUEST, // or STAFF; unknown here so default to guest for now
            title: 'Tin nhắn mới',
            message: saved.content || '',
            type: NotificationType.MESSAGE,
            sent_method: [SentMethod.IN_APP, SentMethod.PUSH],
            sender_user_id: user._id,
            metadata: {
              conversationId: this.getIdString(conversation._id),
              messageId: this.getIdString(saved._id),
              propertyId: this.getIdString(propertyId),
              guestId: this.getIdString(guestId),
            },
          });
        }
      } catch {
        // swallow notification errors
      }

      // Conversation summary
      const lastMessage = {
        _id: this.getIdString(saved._id),
        content: saved.content || '',
        sender_id: this.getIdString(saved.sender_id),
        sender_role:
          this.getIdString(saved.sender_id) === this.getIdString(guestId)
            ? 'guest'
            : 'staff',
        sent_at: saved.sent_at,
        is_read: saved.is_read,
      } as {
        _id: string;
        content: string;
        sender_id: string;
        sender_role: 'guest' | 'staff' | 'admin';
        sent_at: Date;
        is_read: MessageStatus;
      };

      console.log('🔍 [Service] Created lastMessage object:', {
        _id: lastMessage._id,
        content: lastMessage.content,
        sender_id: lastMessage.sender_id,
        sender_role: lastMessage.sender_role,
        contentLength: lastMessage.content?.length || 0,
      });

      // Emit per-user unread counts
      const resolveReadAt = this.resolveReadAt(
        conversation.read_at as unknown as
          | Map<string, Date>
          | Record<string, Date>,
      );

      // Guest - Emit immediately for realtime
      const guestReadAt = resolveReadAt(guestId.toString());
      const guestUnread = await this.messageModel.countDocuments({
        conversation_id: conversation._id,
        sent_at: { $gt: guestReadAt },
      });

      // Emit conversation update V2 immediately
      this.messagesGateway.emitConversationUpdateV2(guestId.toString(), {
        conversationId: this.getIdString(conversation._id),
        lastMessage,
        lastMessageAt: saved.sent_at,
        unreadCount: guestUnread,
      });

      // Emit conversation list update immediately for guest
      try {
        // Debug connection status
        this.messagesGateway.debugConnectionStatus(guestId.toString());

        const guestConversations = await this.getConversationsUI(
          { _id: guestId.toString(), role: 'guest' } as JwtPayload,
          'guest',
        );
        this.emitConversationListUpdateToGuest(
          guestConversations,
          guestId.toString(),
          'guest',
        );
        console.log(
          `🔍 [Immediate] Emitted conversation list update to guest ${guestId.toString()}`,
        );

        // Also emit new message event for immediate UI update
        try {
          void this.messagesGateway.emitNewMessage(
            formatted,
            guestId.toString(),
          );
          console.log(
            `🔍 [Immediate] Emitted new message to guest ${guestId.toString()}`,
          );
        } catch {
          console.warn(
            'Failed to emit new message, but continuing with other updates',
          );
        }
      } catch (guestUpdateError) {
        console.error(
          'Failed to emit immediate guest update:',
          guestUpdateError,
        );
      }

      // Staffs
      for (const uid of participantIds) {
        if (uid === guestId.toString()) continue;
        const readAt = resolveReadAt(uid);
        const unread = await this.messageModel.countDocuments({
          conversation_id: conversation._id,
          sent_at: { $gt: readAt },
        });
        this.messagesGateway.emitConversationUpdateV2(uid, {
          conversationId: this.getIdString(conversation._id),
          lastMessage,
          lastMessageAt: saved.sent_at,
          unreadCount: unread,
        });
      }

      // Emit conversation update V2 to admin broadcast room for admin users
      try {
        this.messagesGateway.emitConversationUpdateV2ToAdminBroadcast({
          conversationId: this.getIdString(conversation._id),
          lastMessage,
          lastMessageAt: saved.sent_at,
          unreadCount: 0, // Admin sẽ tính toán unread count riêng
        });
        console.log(
          '🔍 Emitted conversation update V2 to admin broadcast room',
        );
      } catch (adminEmitError) {
        console.error(
          '🔍 Failed to emit V2 to admin broadcast room:',
          adminEmitError,
        );
      }

      // Use optimized realtime update method
      try {
        await this.emitRealtimeUpdatesForNewMessage(
          this.getIdString(conversation._id),
          {
            _id: this.getIdString(saved._id),
            content: saved.content,
            sender_id: this.getIdString(saved.sender_id),
            sender_role:
              this.getIdString(saved.sender_id) === this.getIdString(guestId)
                ? 'guest'
                : 'staff',
            sent_at: saved.sent_at,
            is_read: saved.is_read,
          },
          participantIds,
          user._id,
        );
        console.log('🔍 [Optimized] Emitted realtime updates for new message');
      } catch (realtimeError) {
        console.error(
          'Failed to emit optimized realtime updates:',
          realtimeError,
        );
      }
    } catch (err) {
      console.error('Failed to emit realtime message:', err);
    }

    return (populated as Message) || saved;
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

  async findOne(id: string, user: JwtPayload): Promise<unknown> {
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

    // Authorization: user must be a participant of the conversation (guest/assigned staff) or admin
    const conv = await this.conversationModel
      .findById(message.conversation_id)
      .lean();
    if (!conv) throw new NotFoundException('Conversation không tồn tại');
    const convData = conv as {
      guest_id: Types.ObjectId | string;
      property_id: Types.ObjectId | string;
    };
    const isGuest = this.getIdString(convData.guest_id) === user._id;
    const isStaff =
      user.role === 'staff'
        ? await this.propertyStaffAssignmentService.isStaffAssignedToProperty(
            new Types.ObjectId(user._id),
            new Types.ObjectId(this.getIdString(convData.property_id)),
          )
        : false;
    if (!isGuest && !isStaff && user.role !== 'admin') {
      throw new ForbiddenException(
        'Không có quyền xem tin nhắn của conversation này',
      );
    }

    // Format reactions với emoji
    return this.formatReactionResponse(message);
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
    if (!message.receiver_id || userId !== message.receiver_id.toString()) {
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

    // For legacy direct message, try to emit minimal V2-like updates if conversation exists
    try {
      if (updated?.conversation_id) {
        const conv = await this.conversationModel
          .findById(updated.conversation_id)
          .lean();
        if (conv) {
          const convLean = conv as unknown as {
            _id: Types.ObjectId;
            guest_id: Types.ObjectId | string;
            property_id: Types.ObjectId | string;
            read_at?: Map<string, Date> | Record<string, Date>;
            last_message_at?: Date;
          };
          const convId = this.getIdString(convLean._id);
          const participants = await this.participantsOfConversation(convLean);
          const resolve = this.resolveReadAt(convLean.read_at);
          interface LeanMessageMinimal {
            _id: Types.ObjectId;
            content?: string;
            sender_id:
              | Types.ObjectId
              | {
                  _id: Types.ObjectId;
                  name?: string;
                  username?: string;
                  avatar_url?: string | null;
                  role?: string;
                };
            sent_at: Date;
            is_read: MessageStatus;
          }
          for (const uid of participants) {
            const readAt = resolve(uid);
            const unread = await this.messageModel.countDocuments({
              conversation_id: updated.conversation_id,
              sent_at: { $gt: readAt },
            });
            const lastDoc = await this.messageModel
              .findOne({ conversation_id: updated.conversation_id })
              .sort({ sent_at: -1 })
              .select({
                _id: 1,
                content: 1,
                sender_id: 1,
                sent_at: 1,
                is_read: 1,
              })
              .lean<LeanMessageMinimal | null>();
            const lastMessage = lastDoc
              ? ({
                  _id: this.getIdString(lastDoc._id),
                  content: lastDoc.content || '',
                  sender_id: this.getIdString(lastDoc.sender_id),
                  sender_role:
                    this.getIdString(lastDoc.sender_id) ===
                    this.getIdString(convLean.guest_id)
                      ? 'guest'
                      : 'staff',
                  sent_at: lastDoc.sent_at,
                  is_read: lastDoc.is_read,
                } as {
                  _id: string;
                  content: string;
                  sender_id: string;
                  sender_role: 'guest' | 'staff' | 'admin';
                  sent_at: Date;
                  is_read: MessageStatus;
                })
              : null;
            this.messagesGateway.emitConversationUpdateV2(uid, {
              conversationId: convId,
              lastMessage,
              lastMessageAt:
                lastDoc?.sent_at || convLean.last_message_at || null,
              unreadCount: unread,
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to emit v2 update after markAsRead:', err);
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

    // Legacy endpoint; no V2 emit here to avoid ambiguity across conversations

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

    const matchBetweenUsers: FilterQuery<Message> = {
      $or: [
        // ObjectId format
        { sender_id: userObjectId, receiver_id: otherUserObjectId },
        { sender_id: otherUserObjectId, receiver_id: userObjectId },
        // Legacy string format
        { sender_id: userId, receiver_id: otherUserId },
        { sender_id: otherUserId, receiver_id: userId },
      ],
    };

    interface LeanMessage {
      _id: Types.ObjectId | string;
      content?: string;
      sender_id: Types.ObjectId | string;
      sent_at: Date;
    }

    const lastMessageDoc = await this.messageModel
      .findOne(matchBetweenUsers)
      .sort({ sent_at: -1 })
      .select({ _id: 1, content: 1, sender_id: 1, sent_at: 1 })
      .lean<LeanMessage>();

    const normalizeId = (val: unknown): string => this.getIdString(val);

    const lastMessage = lastMessageDoc
      ? {
          _id: normalizeId(lastMessageDoc._id),
          content: lastMessageDoc.content || '',
          senderId: normalizeId(lastMessageDoc.sender_id),
          // Hiện tại chưa có phân loại type theo nội dung, default 'text'
          type: 'text',
          sent_at: lastMessageDoc.sent_at,
        }
      : null;

    const lastMessageAt = lastMessage ? lastMessage.sent_at : null;

    // Đếm unread cho từng user
    const countUnreadFor = async (
      receiver: { id: string; obj: Types.ObjectId },
      sender: { id: string; obj: Types.ObjectId },
    ): Promise<number> => {
      const filter: FilterQuery<Message> = {
        $and: [
          {
            $or: [{ receiver_id: receiver.obj }, { receiver_id: receiver.id }],
          },
          { $or: [{ sender_id: sender.obj }, { sender_id: sender.id }] },
          { is_read: { $ne: MessageStatus.READ } },
        ],
      };
      return this.messageModel.countDocuments(filter);
    };

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

  async getAvailableProperties(currentUserId: string): Promise<any[]> {
    try {
      const userObjectId = new Types.ObjectId(currentUserId);

      // Check if user has any property messages
      const messageCount = await this.messageModel.countDocuments({
        $or: [
          { sender_id: userObjectId },
          { receiver_id: userObjectId },
          { sender_id: currentUserId },
          { receiver_id: currentUserId },
        ],
        property_id: { $exists: true, $ne: null },
      });

      if (messageCount === 0) {
        return [];
      }

      // Lấy properties đã từng chat với current user
      const properties = await this.messageModel.aggregate([
        {
          $match: {
            $or: [
              { sender_id: userObjectId },
              { receiver_id: userObjectId },
              { sender_id: currentUserId },
              { receiver_id: currentUserId },
            ],
            property_id: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$property_id',
            lastMessage: { $first: '$$ROOT' },
            messageCount: { $sum: 1 },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$receiver_id', userObjectId] },
                      { $ne: ['$is_read', 'read'] },
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
            propertyIdToLookup: {
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
            from: 'properties',
            localField: 'propertyIdToLookup',
            foreignField: '_id',
            as: 'property',
          },
        },
        {
          $unwind: '$property',
        },
        {
          $project: {
            _id: '$property._id',
            name: '$property.name',
            type: '$property.type',
            thumbnail: '$property.thumbnail',
            status: '$property.status',
            isVerified: '$property.isVerified',
            lastMessageAt: '$lastMessage.sent_at',
            messageCount: '$messageCount',
            unreadCount: '$unreadCount',
            lastMessage: {
              content: '$lastMessage.content',
              sender_id: '$lastMessage.sender_id',
              is_read: '$lastMessage.is_read',
            },
          },
        },
        {
          $sort: { lastMessageAt: -1 },
        },
      ]);

      return properties || [];
    } catch (error) {
      console.error('Error in getAvailableProperties:', error);
      return [];
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

  // ==================== CONVERSATION-BASED QUERIES ====================
  async getConversationsUI(
    user: JwtPayload,
    ui_for?: 'guest' | 'staff' | 'admin',
  ): Promise<any[]> {
    const role = ui_for || user.role;

    console.log('🔍 getConversationsUI Debug:', {
      userId: user._id,
      userRole: user.role,
      ui_for,
      finalRole: role,
    });

    let filter: FilterQuery<Conversation> = {};
    if (role === 'guest') {
      filter = {
        guest_id: new Types.ObjectId(user._id),
      } as FilterQuery<Conversation>;
      console.log('🔍 Guest filter:', filter);
    } else if (role === 'staff') {
      const assignments =
        await this.propertyStaffAssignmentService.getPropertiesByStaff(
          new Types.ObjectId(user._id),
        );
      console.log('🔍 Staff assignments:', assignments);

      const propertyIds = assignments.map((a) => {
        // Handle populated propertyId object
        if (typeof a.propertyId === 'object' && a.propertyId !== null) {
          return new Types.ObjectId(a.propertyId._id || a.propertyId);
        }
        return new Types.ObjectId(a.propertyId);
      });
      filter = {
        property_id: { $in: propertyIds },
      } as FilterQuery<Conversation>;
      console.log('🔍 Staff filter:', filter, 'Property IDs:', propertyIds);
    } else if (role === 'admin') {
      // Admin can see all conversations - no filter needed
      filter = {} as FilterQuery<Conversation>;
      console.log('🔍 Admin filter (no filter):', filter);
    }

    // Check total conversations in database
    const totalConversations = await this.conversationModel.countDocuments({});
    console.log('🔍 Total conversations in database:', totalConversations);

    const conversations = await this.conversationModel
      .find(filter)
      .sort({ last_message_at: -1 })
      .lean<ConversationLeanBasic[]>();

    console.log('🔍 Found conversations with filter:', conversations.length);
    console.log(
      '🔍 Conversations:',
      conversations.map((c) => ({
        _id: c._id.toString(),
        property_id: c.property_id.toString(),
        guest_id: c.guest_id.toString(),
        last_message_at: c.last_message_at,
      })),
    );

    const results: any[] = [];
    for (const conv of conversations) {
      const convId = conv._id;
      const propertyId = conv.property_id;
      const guestId = conv.guest_id;

      const [property, guest, lastMessageDoc, messageCount] = await Promise.all(
        [
          this.messageModel.db
            .collection<PropertyLeanBasic>('properties')
            .findOne(
              { _id: propertyId },
              {
                projection: {
                  _id: 1,
                  name: 1,
                  thumbnail: 1,
                  status: 1,
                  isVerified: 1,
                },
              },
            ),
          this.messageModel.db.collection<UserLeanBasic>('users').findOne(
            { _id: guestId },
            {
              projection: {
                _id: 1,
                name: 1,
                username: 1,
                avatar_url: 1,
                role: 1,
              },
            },
          ),
          this.messageModel
            .findOne({ conversation_id: convId })
            .sort({ sent_at: -1 })
            .select({
              _id: 1,
              content: 1,
              sender_id: 1,
              sent_at: 1,
              is_read: 1,
            })
            .populate('sender_id', 'username email name avatar_url role')
            .lean<LeanMessageMinimal | null>(),
          this.messageModel.countDocuments({ conversation_id: convId }),
        ],
      );

      const readAtResolver = this.resolveReadAt(conv.read_at);
      const readAt = readAtResolver(user._id);
      const unreadCount = await this.messageModel.countDocuments({
        conversation_id: convId,
        sent_at: { $gt: readAt },
      });

      let sender_role: 'guest' | 'staff' | 'admin' | null = null;
      if (lastMessageDoc) {
        const senderIdStr = this.getIdString(lastMessageDoc.sender_id);
        // Check if sender is guest
        if (senderIdStr === guestId.toString()) {
          sender_role = 'guest';
        } else {
          // Check the actual role from populated sender data
          if (
            lastMessageDoc.sender_id &&
            typeof lastMessageDoc.sender_id === 'object'
          ) {
            const senderRole = (lastMessageDoc.sender_id as { role?: string })
              .role;
            sender_role = senderRole === 'admin' ? 'admin' : 'staff';
          } else {
            // Fallback to staff if we can't determine the role
            sender_role = 'staff';
          }
        }
      }

      const lastContent = lastMessageDoc?.content ?? '';
      const propertyName = property?.name ?? 'Property';
      const guestName = guest?.name ?? 'Guest';

      // For admin view, get all participants (guest + all assigned staff)
      const allParticipants: any[] = [];
      if (role === 'admin') {
        // Get guest info
        if (guest) {
          allParticipants.push({
            _id: guest._id.toString(),
            name: guest.name || 'Guest',
            username: (guest as { username?: string }).username || '',
            avatar_url: guest.avatar_url || null,
            role: (guest as { role?: string }).role || 'guest',
            type: 'guest',
          });
        }

        // Get all assigned staff for this property
        const propertyObjectId = new Types.ObjectId(propertyId.toString());
        const assignedStaff =
          await this.propertyStaffAssignmentService.getStaffByProperty(
            propertyObjectId,
          );

        for (const staffAssignment of assignedStaff) {
          const staffId = this.getIdString(
            (staffAssignment as { staffId: Types.ObjectId | string }).staffId,
          );
          const staffInfo = await this.messageModel.db
            .collection<UserLeanBasic>('users')
            .findOne(
              { _id: new Types.ObjectId(staffId) },
              {
                projection: {
                  _id: 1,
                  name: 1,
                  username: 1,
                  avatar_url: 1,
                  role: 1,
                },
              },
            );

          if (staffInfo) {
            allParticipants.push({
              _id: staffInfo._id.toString(),
              name: staffInfo.name || 'Staff',
              username: (staffInfo as { username?: string }).username || '',
              avatar_url: staffInfo.avatar_url || null,
              role: (staffInfo as { role?: string }).role || 'staff',
              type: 'staff',
            });
          }
        }
      }

      const display: ConversationDisplay =
        role === 'guest'
          ? {
              title: propertyName,
              subtitle: `${sender_role === 'guest' ? 'Bạn' : sender_role === 'admin' ? 'Admin' : 'Nhân viên'}: ${lastContent}`,
              avatar_url: property?.thumbnail ?? null,
              badge: null,
              unreadCount,
            }
          : {
              title: guestName,
              subtitle: `Người gửi cuối: ${lastContent}`,
              avatar_url: guest?.avatar_url ?? null,
              badge: {
                text: propertyName,
                avatar_url: property?.thumbnail ?? null,
              },
              unreadCount,
            };

      const lastActive = conv.last_active_staff_id
        ? await this.messageModel.db.collection('users').findOne(
            { _id: conv.last_active_staff_id },
            {
              projection: {
                _id: 1,
                name: 1,
                username: 1,
                avatar_url: 1,
                role: 1,
              },
            },
          )
        : null;

      const result: any = {
        _id: convId.toString(),
        thread_type: 'property',
        property: property || null,
        guest: guest || null,
        staff_summary: {
          count: Array.isArray(conv.staff_ids) ? conv.staff_ids.length : 0,
          last_active: lastActive,
        },
        lastMessage: lastMessageDoc
          ? {
              _id: this.getIdString(lastMessageDoc._id),
              content: lastMessageDoc.content || '',
              sender_id: this.getIdString(lastMessageDoc.sender_id),
              sender_role: sender_role || 'guest',
              sent_at: lastMessageDoc.sent_at,
              is_read: lastMessageDoc.is_read,
              // Add full sender information if populated
              sender:
                lastMessageDoc.sender_id &&
                typeof lastMessageDoc.sender_id === 'object'
                  ? {
                      _id: this.getIdString(
                        (
                          lastMessageDoc.sender_id as {
                            _id?: Types.ObjectId | string;
                          }
                        )._id,
                      ),
                      name:
                        (lastMessageDoc.sender_id as { name?: string }).name ||
                        '',
                      username:
                        (lastMessageDoc.sender_id as { username?: string })
                          .username || '',
                      avatar_url:
                        (
                          lastMessageDoc.sender_id as {
                            avatar_url?: string | null;
                          }
                        ).avatar_url || null,
                      role:
                        (lastMessageDoc.sender_id as { role?: string }).role ||
                        'guest',
                    }
                  : null,
            }
          : null,
        lastMessageAt: conv.last_message_at || null,
        messageCount,
        ui_for: role === 'admin' ? 'staff' : role,
        display,
      };

      // Add participants array for admin view
      if (role === 'admin') {
        (result as Record<string, unknown>).participants = allParticipants;
        (result as Record<string, unknown>).participant_count =
          allParticipants.length;
      }

      results.push(result);
    }

    return results;
  }

  async getConversationMessages(
    user: JwtPayload,
    conversationId: string,
    query: { limit?: number; page?: number },
    ui_for?: 'guest' | 'staff' | 'admin',
  ): Promise<any[]> {
    if (!isValidObjectId(conversationId)) {
      throw new BadRequestException('conversationId không hợp lệ');
    }
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Không tìm thấy conversation');

    const propertyId = conv.property_id;
    const guestId = conv.guest_id;
    if (user.role !== 'admin') {
      if (user.role === 'guest') {
        if (guestId.toString() !== user._id) {
          throw new ForbiddenException(
            'Bạn không có quyền xem cuộc trò chuyện',
          );
        }
      } else if (user.role === 'staff') {
        const assigned =
          await this.propertyStaffAssignmentService.isStaffAssignedToProperty(
            new Types.ObjectId(user._id),
            propertyId,
          );
        if (!assigned)
          throw new ForbiddenException('Staff không được assign property này');
      }
    }

    // For realtime conversation, get all messages by default
    // Only apply pagination if explicitly requested
    const limit = query.limit && query.limit > 0 ? query.limit : undefined;
    const page = query.page && query.page > 0 ? query.page : 1;

    const messagesQ = this.messageModel
      .find({ conversation_id: conv._id })
      .sort({ sent_at: 1 }) // Ensure messages are sorted chronologically (newest at the end)
      .populate('sender_id', 'username email name avatar_url role');

    // Only apply pagination if limit is specified
    if (limit) {
      messagesQ.limit(limit).skip((page - 1) * limit);
    }
    // If no limit specified, get all messages for realtime support

    const docs = await messagesQ.exec();

    const ui = ui_for || user.role;
    const currentUserId = user._id;

    return docs.map((m) => {
      const mine = this.getIdString(m.sender_id) === currentUserId;
      const senderIdStr = this.getIdString(m.sender_id);
      const senderIsGuest = senderIdStr === guestId.toString();

      // Logic show_sender_meta cải thiện
      let show_sender_meta = false;
      if (ui === 'guest') {
        // Guest UI: chỉ hiển thị sender meta cho tin nhắn không phải của guest
        show_sender_meta = !senderIsGuest;
      } else if (ui === 'staff') {
        // Staff UI: hiển thị sender meta cho tin nhắn của guest hoặc tin nhắn không phải của mình
        show_sender_meta = senderIsGuest || !mine;
      } else if (ui === 'admin') {
        // Admin UI: hiển thị sender meta cho tất cả tin nhắn không phải của admin
        show_sender_meta = !mine;
      }

      const sender = m.sender_id as unknown as {
        name?: string;
        avatar_url?: string;
      };
      return {
        ...this.formatReactionResponse(m),
        ui_for: ui, // Giữ nguyên ui_for được truyền vào
        ui: {
          mine,
          show_sender_meta,
          sender_display_name: sender?.name || '',
          sender_avatar_url: sender?.avatar_url || null,
        },
      };
    });
  }

  async markConversationRead(
    user: JwtPayload,
    conversationId: string,
  ): Promise<{ ok: boolean }> {
    if (!isValidObjectId(conversationId)) {
      throw new BadRequestException('conversationId không hợp lệ');
    }
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Không tìm thấy conversation');

    if (user.role !== 'admin') {
      const propertyId = conv.property_id;
      const guestId = conv.guest_id;
      if (user.role === 'guest') {
        if (guestId.toString() !== user._id) {
          throw new ForbiddenException('Bạn không có quyền');
        }
      } else if (user.role === 'staff') {
        const assigned =
          await this.propertyStaffAssignmentService.isStaffAssignedToProperty(
            new Types.ObjectId(user._id),
            propertyId,
          );
        if (!assigned) throw new ForbiddenException('Không có quyền');
      }
    }

    await this.conversationModel.updateOne(
      { _id: conv._id },
      { $set: { [`read_at.${user._id}`]: new Date() } },
    );

    // Emit updated conversation summary for current user (unreadCount = 0)
    try {
      interface LeanMessageMinimal {
        _id: Types.ObjectId;
        content?: string;
        sender_id:
          | Types.ObjectId
          | {
              _id: Types.ObjectId;
              name?: string;
              username?: string;
              avatar_url?: string | null;
              role?: string;
            };
        sent_at: Date;
        is_read: MessageStatus;
      }
      const lastDoc = await this.messageModel
        .findOne({ conversation_id: conv._id })
        .sort({ sent_at: -1 })
        .select({ _id: 1, content: 1, sender_id: 1, sent_at: 1, is_read: 1 })
        .lean<LeanMessageMinimal | null>();

      const lastMessage = lastDoc
        ? ({
            _id: this.getIdString(lastDoc._id),
            content: lastDoc.content || '',
            sender_id: this.getIdString(lastDoc.sender_id),
            sender_role:
              this.getIdString(lastDoc.sender_id) ===
              this.getIdString(conv.guest_id)
                ? 'guest'
                : 'staff',
            sent_at: lastDoc.sent_at,
            is_read: lastDoc.is_read,
          } as {
            _id: string;
            content: string;
            sender_id: string;
            sender_role: 'guest' | 'staff' | 'admin';
            sent_at: Date;
            is_read: MessageStatus;
          })
        : null;

      this.messagesGateway.emitConversationUpdateV2(user._id, {
        conversationId: this.getIdString(conv._id),
        lastMessage,
        lastMessageAt: lastDoc?.sent_at || conv.last_message_at || null,
        unreadCount: 0,
      });
    } catch {
      // swallow
    }

    return { ok: true };
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
    try {
      const userObjectId = new Types.ObjectId(userId);

      // Lấy tất cả cuộc trò chuyện (cả user-to-user và property messages)
      const conversations = await this.messageModel.aggregate([
        {
          $match: {
            $or: [
              { sender_id: userObjectId },
              { receiver_id: userObjectId },
              { sender_id: userId },
              { receiver_id: userId },
            ],
          },
        },
        {
          $addFields: {
            conversationId: {
              $cond: [
                { $ne: ['$property_id', null] },
                { type: 'property', id: '$property_id' },
                {
                  type: 'user',
                  id: {
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
              ],
            },
          },
        },
        {
          $group: {
            _id: '$conversationId',
            lastMessage: { $first: '$$ROOT' },
            messageCount: { $sum: 1 },
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
            firstMessageAt: { $min: '$sent_at' },
            lastMessageAt: { $max: '$sent_at' },
          },
        },
        {
          $addFields: {
            conversationType: '$_id.type',
            conversationId: '$_id.id',
          },
        },
        {
          $lookup: {
            from: 'properties',
            localField: 'conversationId',
            foreignField: '_id',
            as: 'property',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'conversationId',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $addFields: {
            conversationInfo: {
              $cond: [
                { $eq: ['$conversationType', 'property'] },
                {
                  $arrayElemAt: ['$property', 0],
                },
                {
                  $arrayElemAt: ['$user', 0],
                },
              ],
            },
          },
        },
        {
          $project: {
            _id: '$conversationId',
            type: '$conversationType',
            name: '$conversationInfo.name',
            avatar_url: '$conversationInfo.thumbnail',
            status: '$conversationInfo.status',
            isVerified: '$conversationInfo.isVerified',
            lastMessage: {
              content: '$lastMessage.content',
              sender_id: '$lastMessage.sender_id',
              is_read: '$lastMessage.is_read',
              sent_at: '$lastMessage.sent_at',
            },
            messageCount: '$messageCount',
            unreadCount: '$unreadCount',
            firstMessageAt: '$firstMessageAt',
            lastMessageAt: '$lastMessageAt',
            // Thông tin về người đang trả lời
            lastSender: {
              _id: '$lastMessage.sender_id',
              isCurrentUser: {
                $or: [
                  { $eq: ['$lastMessage.sender_id', userObjectId] },
                  { $eq: ['$lastMessage.sender_id', userId] },
                ],
              },
            },
          },
        },
        {
          $sort: { lastMessageAt: -1 },
        },
      ]);

      return conversations || [];
    } catch (error) {
      console.error('Error in getConversations:', error);
      return [];
    }
  }

  /**
   * Lấy tin nhắn trong cuộc trò chuyện
   */
  async getConversation(
    userId: string,
    otherUserId: string,
    query?: ConversationQueryDto,
    user?: JwtPayload, // Add user parameter for role checking
  ): Promise<any[]> {
    try {
      // If user is admin, allow access to any conversation
      if (user?.role === 'admin') {
        // For admin, we need to find the conversation between these users
        // First try to find existing conversation
        const conversation = await this.conversationModel
          .findOne({
            $or: [
              { guest_id: new Types.ObjectId(userId) },
              { guest_id: new Types.ObjectId(otherUserId) },
            ],
          })
          .sort({ last_message_at: -1 });

        if (conversation) {
          // Use the new conversation-based system for admin
          return this.getConversationMessages(
            user,
            (conversation._id as Types.ObjectId).toString(),
            query || {},
          );
        }
      }

      // Fallback to legacy direct messaging for non-admin users
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

    // Authorization: participant of conversation (guest/assigned staff) or admin
    const conv = await this.conversationModel
      .findById(message.conversation_id)
      .lean();
    if (!conv) throw new NotFoundException('Conversation không tồn tại');
    const isGuest =
      this.getIdString((conv as unknown as Conversation).guest_id) === user._id;
    const isStaff =
      user.role === 'staff'
        ? await this.propertyStaffAssignmentService.isStaffAssignedToProperty(
            new Types.ObjectId(user._id),
            (conv as unknown as Conversation).property_id,
          )
        : false;
    if (!isGuest && !isStaff && user.role !== 'admin') {
      throw new ForbiddenException(
        'Không có quyền tác động vào message của conversation này',
      );
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

    // Emit real-time notification to all participants
    try {
      const convDoc = await this.conversationModel
        .findById(updatedMessage.conversation_id)
        .lean();
      const uids = await this.participantsOfConversation(
        convDoc as {
          guest_id: Types.ObjectId | string;
          property_id: Types.ObjectId | string;
        } | null,
      );
      uids.forEach((uid) =>
        this.messagesGateway.emitReactionUpdate(updatedMessage, uid),
      );

      // Emit reaction update to admin broadcast room for admin users
      try {
        this.messagesGateway.emitReactionUpdateToAdminBroadcast(
          updatedMessage as any,
        );
        console.log('🔍 Emitted reaction update to admin broadcast room');
      } catch (adminEmitError) {
        console.error(
          '🔍 Failed to emit reaction to admin broadcast room:',
          adminEmitError,
        );
      }
    } catch (error) {
      console.error('Failed to emit reaction update:', error);
    }

    // Notification: inform original sender if different from reactor
    try {
      const senderIdStr = this.getIdString(message.sender_id);
      if (senderIdStr && senderIdStr !== user._id) {
        await this.notificationsService.createAndSend({
          user_id: senderIdStr,
          recipient_type: RecipientType.GUEST,
          title: 'Có reaction mới',
          message: `đã ${type} tin nhắn của bạn`,
          type: NotificationType.MESSAGE,
          sent_method: [SentMethod.IN_APP],
          sender_user_id: user._id,
          metadata: { messageId: this.getIdString(message._id) },
        });
      }
    } catch {
      // swallow
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

    // Authorization: participant of conversation (guest/assigned staff) or admin
    const conv = await this.conversationModel
      .findById(message.conversation_id)
      .lean();
    if (!conv) throw new NotFoundException('Conversation không tồn tại');
    const isGuest =
      this.getIdString((conv as unknown as Conversation).guest_id) === user._id;
    const isStaff =
      user.role === 'staff'
        ? await this.propertyStaffAssignmentService.isStaffAssignedToProperty(
            new Types.ObjectId(user._id),
            (conv as unknown as Conversation).property_id,
          )
        : false;
    if (!isGuest && !isStaff && user.role !== 'admin') {
      throw new ForbiddenException(
        'Không có quyền tác động vào message của conversation này',
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

    // Emit real-time notification to all participants
    try {
      const convDoc = await this.conversationModel
        .findById(updatedMessage.conversation_id)
        .lean();
      const uids = await this.participantsOfConversation(
        convDoc as {
          guest_id: Types.ObjectId | string;
          property_id: Types.ObjectId | string;
        } | null,
      );
      uids.forEach((uid) =>
        this.messagesGateway.emitReactionUpdate(updatedMessage, uid),
      );

      // Emit reaction update to admin broadcast room for admin users
      try {
        this.messagesGateway.emitReactionUpdateToAdminBroadcast(
          updatedMessage as any,
        );
        console.log('🔍 Emitted reaction removal to admin broadcast room');
      } catch (adminEmitError) {
        console.error(
          '🔍 Failed to emit reaction removal to admin broadcast room:',
          adminEmitError,
        );
      }
    } catch (error) {
      console.error('Failed to emit reaction update:', error);
    }

    // Notification: toggle can add or change reaction – notify original sender
    try {
      const senderIdStr = this.getIdString(message.sender_id);
      if (senderIdStr && senderIdStr !== user._id) {
        await this.notificationsService.createAndSend({
          user_id: senderIdStr,
          recipient_type: RecipientType.GUEST,
          title: 'Có reaction mới',
          message: 'Tin nhắn của bạn vừa có reaction',
          type: NotificationType.MESSAGE,
          sent_method: [SentMethod.IN_APP],
          sender_user_id: user._id,
          metadata: { messageId: this.getIdString(message._id) },
        });
      }
    } catch {
      // swallow
    }

    return updatedMessage;
  }

  /**
   * Utility để format reaction response với emoji
   */
  private formatReactionResponse(message: Message): Record<string, unknown> {
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
      _id: this.getIdString(messageObject._id),
      reactions: formattedReactions,
      reply_to: formattedReply,
      reply_to_message_id: undefined, // Remove this to avoid duplication
    };
  }

  /**
   * Utility để format array of messages với emoji reactions
   */
  private formatMessagesWithReactions(
    messages: Message[],
  ): Record<string, unknown>[] {
    return messages.map((message) => this.formatReactionResponse(message));
  }

  // ==================== ID NORMALIZATION UTILS ====================
  private getIdString(val: unknown): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      const obj = val as { _id?: unknown; toString?: () => string };
      if (obj._id) {
        const v = obj._id;
        if (typeof v === 'string') return v;
        try {
          // Prefer ObjectId hex string when available
          const s = (v as { toString: () => string }).toString?.();
          return typeof s === 'string' ? s : '';
        } catch {
          return '';
        }
      }
      try {
        const s = obj.toString?.();
        return typeof s === 'string' ? s : '';
      } catch {
        return '';
      }
    }
    if (
      typeof val === 'number' ||
      typeof val === 'boolean' ||
      typeof val === 'bigint' ||
      typeof val === 'symbol'
    ) {
      return String(val);
    }
    return '';
  }

  // ==================== READ_AT HELPER ====================
  private resolveReadAt(
    readAt: Map<string, Date> | Record<string, Date> | undefined,
  ): (userId: string) => Date {
    return (userId: string): Date => {
      if (!readAt) return new Date(0);
      if (readAt instanceof Map) {
        const v = readAt.get(userId);
        return v instanceof Date ? v : new Date(0);
      }
      const v = readAt[userId];
      return v instanceof Date ? v : new Date(0);
    };
  }

  // ==================== PARTICIPANTS HELPER ====================
  private async participantsOfConversation(
    conv: {
      guest_id: Types.ObjectId | string;
      property_id: Types.ObjectId | string;
    } | null,
  ): Promise<string[]> {
    if (!conv) return [];
    const guestId = this.getIdString(conv.guest_id);
    const propertyObjectId = new Types.ObjectId(
      this.getIdString(conv.property_id),
    );
    const staffs =
      await this.propertyStaffAssignmentService.getStaffByProperty(
        propertyObjectId,
      );
    const staffIds = staffs
      .map((s) =>
        this.getIdString((s as { staffId: Types.ObjectId | string }).staffId),
      )
      .filter(Boolean);
    return [guestId, ...staffIds];
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

    // Authorization: participant of conversation (guest/assigned staff) or admin
    const conv = await this.conversationModel
      .findById(message.conversation_id)
      .lean<ConversationLeanBasic | null>();
    if (!conv) throw new NotFoundException('Conversation không tồn tại');
    const isGuest = this.getIdString(conv.guest_id) === user._id;
    const isStaff =
      user.role === 'staff'
        ? await this.propertyStaffAssignmentService.isStaffAssignedToProperty(
            new Types.ObjectId(user._id),
            conv.property_id,
          )
        : false;
    if (!isGuest && !isStaff && user.role !== 'admin') {
      throw new ForbiddenException(
        'Không có quyền tác động vào message của conversation này',
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

    // Emit real-time notification to all participants
    try {
      const convDoc = await this.conversationModel
        .findById(updatedMessage.conversation_id)
        .lean();
      const uids = await this.participantsOfConversation(
        convDoc as {
          guest_id: Types.ObjectId | string;
          property_id: Types.ObjectId | string;
        } | null,
      );
      uids.forEach((uid) =>
        this.messagesGateway.emitReactionUpdate(updatedMessage, uid),
      );

      // Emit reaction update to admin broadcast room for admin users
      try {
        this.messagesGateway.emitReactionUpdateToAdminBroadcast(
          updatedMessage as any,
        );
        console.log('🔍 Emitted toggle reaction to admin broadcast room');
      } catch (adminEmitError) {
        console.error(
          '🔍 Failed to emit toggle reaction to admin broadcast room:',
          adminEmitError,
        );
      }
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

    // Emit real-time notification tới tất cả participants
    try {
      const conv = await this.conversationModel
        .findById(updatedMessage.conversation_id)
        .lean();
      const uids = await this.participantsOfConversation(
        conv as {
          guest_id: Types.ObjectId | string;
          property_id: Types.ObjectId | string;
        } | null,
      );
      uids.forEach((uid) =>
        this.messagesGateway.emitMessageRecalled(updatedMessage, uid),
      );

      // Emit message recall to admin broadcast room for admin users
      try {
        this.messagesGateway.emitMessageRecalledToAdminBroadcast(
          updatedMessage as any,
        );
        console.log('🔍 Emitted message recall to admin broadcast room');
      } catch (adminEmitError) {
        console.error(
          '🔍 Failed to emit message recall to admin broadcast room:',
          adminEmitError,
        );
      }
    } catch (error) {
      console.error('Failed to emit message recall notification:', error);
    }

    // Notification: inform remaining participants except sender
    try {
      const conv = await this.conversationModel
        .findById(updatedMessage.conversation_id)
        .lean();
      const uids = await this.participantsOfConversation(
        conv as {
          guest_id: Types.ObjectId | string;
          property_id: Types.ObjectId | string;
        } | null,
      );
      const recipients = uids.filter((id) => id !== user._id);
      for (const rid of recipients) {
        await this.notificationsService.createAndSend({
          user_id: rid,
          recipient_type: RecipientType.GUEST,
          title: 'Tin nhắn đã được thu hồi',
          message: '',
          type: NotificationType.MESSAGE,
          sent_method: [SentMethod.IN_APP],
          sender_user_id: user._id,
          metadata: { messageId: this.getIdString(updatedMessage._id) },
        });
      }
    } catch {
      // swallow
    }

    return updatedMessage;
  }

  /**
   * Emit conversation update to all participants when conversation is accessed
   * This enables realtime updates for the @Get('conversation') API
   */
  async emitConversationUpdateToParticipants(
    conversationId: string,
    currentUserId: string,
    messages: any[],
  ): Promise<void> {
    try {
      if (!isValidObjectId(conversationId)) {
        console.warn('Invalid conversationId for emission:', conversationId);
        return;
      }

      const conv = await this.conversationModel.findById(conversationId).lean();
      if (!conv) {
        console.warn('Conversation not found for emission:', conversationId);
        return;
      }

      // Get all participants
      const participantIds = await this.participantsOfConversation(conv);

      console.log('🔍 Emitting conversation update to participants:', {
        conversationId,
        currentUserId,
        participantCount: participantIds.length,
        participants: participantIds,
      });

      // Emit to all participants except the current user
      for (const participantId of participantIds) {
        if (participantId === currentUserId) {
          continue; // Skip current user
        }

        try {
          const isOnline = this.messagesGateway.isUserOnline(participantId);
          console.log(
            `🔍 Participant ${participantId} online status: ${isOnline}`,
          );

          if (isOnline) {
            // Emit conversation update event
            this.messagesGateway.emitConversationUpdate(participantId, {
              conversationId,
              messages,
              updatedBy: currentUserId,
              timestamp: new Date().toISOString(),
              messageCount: messages.length,
            });

            console.log(
              `🔍 Emitted conversation update to participant: ${participantId}`,
            );
          } else {
            console.log(
              `🔍 Participant ${participantId} is offline, skipping emit`,
            );
          }
        } catch (emitError) {
          console.error(
            `🔍 Failed to emit to participant ${participantId}:`,
            emitError,
          );
        }
      }

      // Emit to admin broadcast room for admin users
      try {
        this.messagesGateway.server
          .to('admin_broadcast')
          .emit('conversation_update', {
            conversationId,
            messages,
            updatedBy: currentUserId,
            timestamp: new Date().toISOString(),
            messageCount: messages.length,
            type: 'conversation_update',
          });
        console.log('🔍 Emitted conversation update to admin broadcast room');
      } catch (adminEmitError) {
        console.error(
          '🔍 Failed to emit to admin broadcast room:',
          adminEmitError,
        );
      }
    } catch (error) {
      console.error('🔍 Failed to emit conversation update:', error);
    }
  }

  /**
   * Get WebSocket connection status
   */
  getWebSocketStatus() {
    return this.messagesGateway.getConnectionStatus();
  }

  /**
   * Test WebSocket emission
   */
  testWebSocketEmission(userId: string, testData: { message: string }) {
    try {
      const isOnline = this.messagesGateway.isUserOnline(userId);

      if (!isOnline) {
        return {
          success: false,
          message: `User ${userId} is not online`,
          onlineUsers: this.messagesGateway.getConnectionStatus(),
        };
      }

      // Test emit a message
      const testMessage = {
        content: testData.message,
        sender_id: 'test-sender',
        receiver_id: userId,
        sent_at: new Date().toISOString(),
        is_read: 'sent',
      };

      void this.messagesGateway.emitNewMessage(testMessage, userId);

      return {
        success: true,
        message: `Test message emitted to user ${userId}`,
        testMessage,
        onlineUsers: this.messagesGateway.getConnectionStatus(),
      };
    } catch (error) {
      console.error('Error testing WebSocket emission:', error);
      return {
        success: false,
        error: (error as Error).message,
        onlineUsers: this.messagesGateway.getConnectionStatus(),
      };
    }
  }

  /**
   * Debug method to check conversation data
   */
  async debugConversationData(): Promise<any> {
    try {
      // Check total conversations
      const totalConversations = await this.conversationModel.countDocuments(
        {},
      );

      // Get sample conversations
      const sampleConversations = await this.conversationModel
        .find({})
        .limit(5)
        .lean();

      // Check total messages
      const totalMessages = await this.messageModel.countDocuments({});

      // Get sample messages
      const sampleMessages = await this.messageModel.find({}).limit(5).lean();

      return {
        conversations: {
          total: totalConversations,
          sample: sampleConversations.map((c) => ({
            _id: this.getIdString(c._id),
            property_id: this.getIdString(c.property_id),
            guest_id: this.getIdString(c.guest_id),
            last_message_at: c.last_message_at,
            staff_ids: c.staff_ids?.map((id) => this.getIdString(id)) || [],
          })),
        },
        messages: {
          total: totalMessages,
          sample: sampleMessages.map((m) => ({
            _id: this.getIdString(m._id),
            conversation_id: m.conversation_id
              ? this.getIdString(m.conversation_id)
              : undefined,
            property_id: m.property_id
              ? this.getIdString(m.property_id)
              : undefined,
            guest_id: m.guest_id ? this.getIdString(m.guest_id) : undefined,
            sender_id: m.sender_id ? this.getIdString(m.sender_id) : undefined,
            content: m.content,
            sent_at: m.sent_at,
          })),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error in debugConversationData:', error);
      return {
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Find conversation between two users for realtime emission (used by deprecated API)
   */
  async findConversationForRealtime(
    userId1: string,
    userId2: string,
  ): Promise<{ _id: Types.ObjectId } | null> {
    try {
      // Try to find existing conversation between these users
      const conversation = await this.conversationModel
        .findOne({
          $or: [
            { guest_id: new Types.ObjectId(userId1) },
            { guest_id: new Types.ObjectId(userId2) },
          ],
        })
        .select({ _id: 1 })
        .lean();

      return conversation as { _id: Types.ObjectId } | null;
    } catch (error) {
      console.error('Error finding conversation for realtime:', error);
      return null;
    }
  }

  /**
   * Emit conversation list update to admin broadcast room
   */
  emitConversationListUpdateToAdminBroadcast(
    conversations: any[],
    userId: string,
    ui_for: string,
  ): void {
    try {
      this.messagesGateway.emitConversationListUpdateToAdminBroadcast({
        conversations,
        updatedBy: userId,
        ui_for,
        timestamp: new Date().toISOString(),
        type: 'conversation_list_update',
      });
      console.log(
        '🔍 [Service] Emitted conversation list update to admin broadcast room',
      );
    } catch (error) {
      console.error(
        '🔍 [Service] Failed to emit conversation list update:',
        error,
      );
    }
  }

  /**
   * Emit conversation list update to guest
   */
  emitConversationListUpdateToGuest(
    conversations: any[],
    userId: string,
    ui_for: string,
  ): void {
    try {
      this.messagesGateway.emitConversationListUpdateToGuest({
        conversations,
        updatedBy: userId,
        ui_for,
        timestamp: new Date().toISOString(),
        type: 'conversation_list_update',
      });
      console.log('🔍 [Service] Emitted conversation list update to guest');
    } catch (error) {
      console.error(
        '🔍 [Service] Failed to emit conversation list update to guest:',
        error,
      );
    }
  }

  /**
   * Optimized method to emit realtime updates for new messages
   */
  async emitRealtimeUpdatesForNewMessage(
    conversationId: string,
    message: {
      _id: string;
      content: string | null;
      sender_id: string;
      sender_role: 'guest' | 'staff' | 'admin';
      sent_at: Date;
      is_read: MessageStatus;
    },
    participants: string[],
    senderId: string,
  ): Promise<void> {
    try {
      const conversation = await this.conversationModel
        .findById(conversationId)
        .lean();
      if (!conversation) return;

      const resolveReadAt = this.resolveReadAt(
        conversation.read_at as
          | Record<string, Date>
          | Map<string, Date>
          | undefined,
      );

      for (const participantId of participants) {
        if (participantId === senderId) continue; // Skip sender

        const isOnline = this.messagesGateway.isUserOnline(participantId);
        const readAt = resolveReadAt(participantId);
        const unreadCount = await this.messageModel.countDocuments({
          conversation_id: conversationId,
          sent_at: { $gt: readAt },
        });

        // Emit conversation update V2
        this.messagesGateway.emitConversationUpdateV2(participantId, {
          conversationId,
          lastMessage: {
            _id: message._id,
            content: message.content || '',
            sender_id: message.sender_id,
            sender_role: message.sender_role || 'guest',
            sent_at: message.sent_at,
            is_read: message.is_read,
          },
          lastMessageAt: message.sent_at,
          unreadCount,
        });

        // Emit new message event for immediate UI update
        if (isOnline) {
          void this.messagesGateway.emitNewMessage(message, participantId);
        }

        // Emit conversation list update
        try {
          const userRole =
            participantId === conversation.guest_id.toString()
              ? 'guest'
              : 'staff';
          const userConversations = await this.getConversationsUI(
            { _id: participantId, role: userRole } as JwtPayload,
            userRole,
          );

          if (userRole === 'guest') {
            this.emitConversationListUpdateToGuest(
              userConversations,
              participantId,
              'guest',
            );
          } else {
            this.emitConversationListUpdateToAdminBroadcast(
              userConversations,
              participantId,
              'staff',
            );
          }
        } catch (listUpdateError) {
          console.error(
            'Failed to emit conversation list update:',
            listUpdateError,
          );
        }
      }
    } catch (error) {
      console.error('Failed to emit realtime updates:', error);
    }
  }

  /**
   * Get messagesGateway for testing purposes
   */
  getMessagesGateway() {
    return this.messagesGateway;
  }
}
