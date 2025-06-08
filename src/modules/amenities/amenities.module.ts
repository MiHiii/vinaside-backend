import { Module } from '@nestjs/common';
import { AmenitiesService } from './amenities.service';
import { AmenitiesController } from './amenities.controller';
import { AmenitiesRepo } from './amenities.repo';
import { MongooseModule } from '@nestjs/mongoose';
import { Amenity, AmenitySchema } from './schemas/amenity.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Amenity.name, schema: AmenitySchema }]),
  ],
  controllers: [AmenitiesController],
  providers: [AmenitiesService, AmenitiesRepo],
})
export class AmenitiesModule {}
