import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../../decorators/require-permission.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { RbacService } from '../../modules/auth/services/rbac.service';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

interface CacheEntry {
  permissions: string[];
  expiredAt: number;
}

@Injectable()
export class PermissionGuard implements CanActivate {
  // Simple in-memory cache (5 phút)
  private permissionCache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private reflector: Reflector,
    private rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<string>(
      PERMISSION_KEY,
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true; // No permission required
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user: JwtPayload = request.user;

    if (!user) {
      return false; // No user found
    }

    // ✅ Bypass if admin
    if (user.role === 'admin') {
      return true;
    }

    try {
      // 🚀 Get permissions with cache
      const userPermissions = await this.getUserPermissionsWithCache(user._id);

      // Check if user has the required permission
      return userPermissions.includes(requiredPermission);
    } catch (error) {
      console.error('Error checking user permissions:', error);
      return false;
    }
  }

  private async getUserPermissionsWithCache(userId: string): Promise<string[]> {
    const now = Date.now();
    const cacheKey = userId;

    // Check cache first
    const cached = this.permissionCache.get(cacheKey);
    if (cached && cached.expiredAt > now) {
      return cached.permissions;
    }

    // Fetch from DB
    const permissions = await this.rbacService.getUserPermissions(userId);

    // Update cache
    this.permissionCache.set(cacheKey, {
      permissions,
      expiredAt: now + this.CACHE_TTL,
    });

    // Clean up expired entries occasionally
    if (Math.random() < 0.1) {
      // 10% chance
      this.cleanupExpiredCache();
    }

    return permissions;
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.permissionCache.entries()) {
      if (entry.expiredAt <= now) {
        this.permissionCache.delete(key);
      }
    }
  }

  // 🧹 Public method to clear cache for specific user or all users
  public clearUserPermissionCache(userId?: string): void {
    if (userId) {
      this.permissionCache.delete(userId);
    } else {
      this.permissionCache.clear(); // Clear all cache
    }
  }
}
