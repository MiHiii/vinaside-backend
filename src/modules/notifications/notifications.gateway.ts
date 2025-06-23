import {
  WebSocketGateway,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import {
  ConnectedUser,
  FormattedNotification,
} from './interfaces/notification.interface';
import {
  extractUserIdFromAuth,
  handleSocketError,
  buildUserNotificationRoom,
  buildBroadcastRoom,
} from './utils/notification.util';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/ws/notifications',
  path: '/socket.io',
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('NotificationsGateway');
  private connectedUsers: Map<string, ConnectedUser> = new Map();

  afterInit(): void {
    this.logger.log('Notifications WebSocket Gateway initialized');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected to notifications: ${client.id}`);
    const userId = extractUserIdFromAuth(client.handshake.auth);

    if (userId) {
      this.connectedUsers.set(userId, {
        userId,
        socketId: client.id,
      });
      void client.join(buildUserNotificationRoom(userId));
      this.logger.log(
        `Auto joined ${buildUserNotificationRoom(userId)} from handshake`,
      );
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected from notifications: ${client.id}`);
    for (const [userId, user] of this.connectedUsers.entries()) {
      if (user.socketId === client.id) {
        this.connectedUsers.delete(userId);
        break;
      }
    }
  }

  @SubscribeMessage('join_notifications')
  async handleJoinNotifications(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { userId } = data;
      this.connectedUsers.set(userId, {
        userId,
        socketId: client.id,
      });
      await client.join(buildUserNotificationRoom(userId));
      this.logger.log(
        `User ${userId} joined notifications room with socket ${client.id}`,
      );
      return {
        success: true,
        message: 'Joined notifications room successfully',
      };
    } catch (error: unknown) {
      this.logger.error('Error joining notifications room:', error);
      return { success: false, message: handleSocketError(error) };
    }
  }

  @SubscribeMessage('mark_notification_read')
  handleMarkRead(
    @MessageBody() data: { notificationId: string; userId: string },
  ): { success: boolean; message?: string; error?: string } {
    try {
      const { notificationId, userId } = data;
      this.logger.log(
        `Notification ${notificationId} marked as read by user ${userId}`,
      );

      // Broadcast to user's notification room
      const userRoom = buildUserNotificationRoom(userId);
      this.server.to(userRoom).emit('notification_read', {
        notificationId,
        userId,
        timestamp: new Date().toISOString(),
      });

      return { success: true, message: 'Notification marked as read' };
    } catch (error: unknown) {
      this.logger.error('Error marking notification as read:', error);
      return { success: false, error: handleSocketError(error) };
    }
  }

  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Method để emit notification mới đến user cụ thể
  emitNewNotification(
    notification: FormattedNotification,
    userId: string,
  ): void {
    const userRoom = buildUserNotificationRoom(userId);
    this.server.to(userRoom).emit('new_notification', notification);
    this.logger.log(`Emitted new_notification to ${userRoom}`);
  }

  // Method để emit notification update
  emitNotificationUpdate(
    notification: FormattedNotification,
    userId: string,
  ): void {
    const userRoom = buildUserNotificationRoom(userId);
    this.server.to(userRoom).emit('notification_updated', notification);
    this.logger.log(`Emitted notification_updated to ${userRoom}`);
  }

  // Method để emit notification đã được đọc
  emitNotificationRead(notificationId: string, userId: string): void {
    const userRoom = buildUserNotificationRoom(userId);
    this.server.to(userRoom).emit('notification_read', {
      notificationId,
      userId,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Emitted notification_read to ${userRoom}`);
  }

  // Method để emit unread count update
  emitUnreadCountUpdate(userId: string, unreadCount: number): void {
    const userRoom = buildUserNotificationRoom(userId);
    this.server.to(userRoom).emit('unread_count_updated', {
      unreadCount,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(
      `Emitted unread_count_updated to ${userRoom}: ${unreadCount}`,
    );
  }

  // Method để broadcast notification theo role/type
  broadcastNotification(
    notification: FormattedNotification,
    broadcastType: string,
  ): void {
    const broadcastRoom = buildBroadcastRoom(broadcastType);
    this.server.to(broadcastRoom).emit('broadcast_notification', notification);
    this.logger.log(`Broadcasted notification to ${broadcastRoom}`);
  }

  // Getter để có thể access server từ service nếu cần
  get socketServer(): Server {
    return this.server;
  }
}
