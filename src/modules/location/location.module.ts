import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Location, LocationSchema } from '../../schemas/location.schema';
import { GooglePlacesService } from './google-places.service';
import { LocationController } from './location.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Location.name, schema: LocationSchema },
    ]),
  ],
  controllers: [LocationController],
  providers: [GooglePlacesService],
  exports: [GooglePlacesService],
})
export class LocationModule {}
