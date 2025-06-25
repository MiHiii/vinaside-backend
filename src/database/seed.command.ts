import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RbacSeedService } from './seeds/rbac.seed';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  // Get seed services
  const rbacSeedService = app.get(RbacSeedService);

  try {
    console.log('🌱 Starting database seeding...');

    // Run RBAC seed
    await rbacSeedService.seedRbacData();

    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
