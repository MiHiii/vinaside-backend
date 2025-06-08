import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

export const redisConfigFactory = (config: ConfigService): RedisOptions => ({
  host: config.get('REDIS_HOST', 'localhost'),
  port: config.get<number>('REDIS_PORT', 6380),
  // ✅ Bổ sung các config để tránh timeout
  keepAlive: 10000,
  connectTimeout: 15000,
  maxRetriesPerRequest: 5,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  reconnectOnError: () => true,
  enableOfflineQueue: true,
  enableReadyCheck: false,
  family: 4,
});
