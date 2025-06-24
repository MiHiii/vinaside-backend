import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RbacSeedService } from './seeds/rbac.seed';
import { PropertySeed } from './seeds/property.seed';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  // Get seed services
  const rbacSeedService = app.get(RbacSeedService);
  const propertySeed = app.get(PropertySeed);

  try {
    console.log('🌱 Starting database seeding...');

    // Run RBAC seed first
    await rbacSeedService.seedRbacData();

    // Run Property seed
    await propertySeed.seed();

    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
