import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { Location } from '../../schemas/location.schema';

interface GooglePlacePrediction {
  place_id: string;
  description: string;
  [key: string]: any;
}

interface GooglePlacesResponse {
  predictions: GooglePlacePrediction[];
  status: string;
}

interface GooglePlaceDetails {
  place_id: string;
  name?: string;
  formatted_address?: string;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  [key: string]: any;
}

interface GooglePlaceDetailsResponse {
  result: GooglePlaceDetails;
  status: string;
}

@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);
  private readonly baseUrl =
    'https://maps.googleapis.com/maps/api/place/autocomplete/json';
  private readonly detailsUrl =
    'https://maps.googleapis.com/maps/api/place/details/json';
  private readonly apiKey = process.env.GOOGLE_PLACES_API_KEY;

  constructor(
    @InjectModel(Location.name) private locationModel: Model<Location>,
  ) {}

  /**
   * Autocomplete địa điểm với cache DB
   */
  async autocomplete(
    input: string,
  ): Promise<Array<{ place_id: string; description: string }>> {
    try {
      // Kiểm tra cache trong DB trước
      const cached = await this.locationModel
        .find({
          description: { $regex: new RegExp(input, 'i') },
          isActive: true,
        })
        .limit(10);

      if (cached.length > 0) {
        this.logger.log(`Found ${cached.length} cached results for: ${input}`);
        return cached.map((c) => ({
          place_id: c.place_id,
          description: c.description,
        }));
      }

      // Nếu chưa có → gọi Google Places API
      this.logger.log(`Calling Google Places API for: ${input}`);
      const response = await axios.get<GooglePlacesResponse>(this.baseUrl, {
        params: {
          input,
          key: this.apiKey,
          types: '(cities)',
          language: 'vi',
          components: 'country:vn',
        },
      });

      const predictions = response.data.predictions || [];

      if (predictions.length === 0) {
        return [];
      }

      // Chuẩn bị data để lưu vào DB
      const locationsToSave = predictions.map((p: GooglePlacePrediction) => ({
        place_id: p.place_id,
        description: p.description,
        raw: p,
      }));

      // Lưu vào DB (insertMany sẽ skip duplicate place_id)
      await this.locationModel
        .insertMany(locationsToSave, { ordered: false })
        .catch((error: Error & { code?: number }) => {
          // Ignore duplicate key errors
          if (error.code !== 11000) {
            this.logger.error('Error saving locations to DB:', error);
          }
        });

      return locationsToSave.map(({ place_id, description }) => ({
        place_id,
        description,
      }));
    } catch (error) {
      this.logger.error('Error in autocomplete:', error);
      return [];
    }
  }

  /**
   * Lấy chi tiết địa điểm theo place_id
   */
  async getPlaceDetails(placeId: string): Promise<Location | null> {
    try {
      // Kiểm tra cache trước
      const cached = await this.locationModel.findOne({
        place_id: placeId,
        isActive: true,
      });

      if (cached && cached.geometry) {
        return cached;
      }

      // Gọi Google Places Details API
      const response = await axios.get<GooglePlaceDetailsResponse>(
        this.detailsUrl,
        {
          params: {
            place_id: placeId,
            key: this.apiKey,
            fields: 'place_id,name,formatted_address,geometry',
          },
        },
      );

      const result = response.data.result;
      if (!result) {
        return null;
      }

      // Cập nhật hoặc tạo mới location với geometry
      const location = await this.locationModel.findOneAndUpdate(
        { place_id: placeId },
        {
          place_id: result.place_id,
          description: result.formatted_address || result.name,
          geometry: result.geometry,
          raw: result,
          isActive: true,
        },
        { upsert: true, new: true },
      );

      return location;
    } catch (error) {
      this.logger.error(`Error getting place details for ${placeId}:`, error);
      return null;
    }
  }

  /**
   * Search listings trong bán kính từ place_id
   */
  async getLocationCoordinates(
    placeId: string,
  ): Promise<{ lat: number; lng: number } | null> {
    const location = await this.getPlaceDetails(placeId);
    return location?.geometry?.location || null;
  }
}
