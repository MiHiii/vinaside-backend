import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Property,
  PropertyDocument,
} from '../../modules/properties/schemas/property.schema';

@Injectable()
export class PropertySeed {
  constructor(
    @InjectModel(Property.name)
    private propertyModel: Model<PropertyDocument>,
  ) {}

  async seed() {
    console.log('🏡 Starting Property seed...');

    // Check if properties already exist
    const existingCount = await this.propertyModel.countDocuments();
    if (existingCount > 0) {
      console.log('✅ Properties already exist, skipping seed');
      return;
    }

    const sampleProperties = [
      {
        name: 'Villa Gió Biển Vũng Tàu',
        type: 'villa',
        description:
          'Villa cao cấp view biển với không gian thoáng mát, phù hợp cho gia đình và nhóm bạn. Có hồ bơi riêng và khu vườn xinh đẹp.',
        thumbnail: 'https://cdn.vinaside.vn/properties/villa-gio-bien.jpg',
        images: [
          'https://cdn.vinaside.vn/properties/villa-gio-bien-1.jpg',
          'https://cdn.vinaside.vn/properties/villa-gio-bien-2.jpg',
          'https://cdn.vinaside.vn/properties/villa-gio-bien-3.jpg',
        ],
        location: {
          lat: 10.3456,
          lng: 107.0855,
          address: '123 Trần Phú, Phường 1, Thành phố Vũng Tàu',
          city: 'Vũng Tàu',
          district: 'Thành phố Vũng Tàu',
          ward: 'Phường 1',
        },
        amenities: [
          'Hồ bơi riêng',
          'Khu vườn',
          'BBQ',
          'Wifi miễn phí',
          'Điều hòa',
          'Bếp đầy đủ',
          'Chỗ đậu xe',
          'Ban công view biển',
        ],
        checkInTime: '14:00',
        checkOutTime: '12:00',
        houseRules: [
          'Không hút thuốc trong nhà',
          'Không được phép nuôi thú cưng',
          'Giữ yên lặng sau 22:00',
          'Tối đa 10 khách',
        ],
        contactPhone: '+84 909 123 456',
        contactEmail: 'villa.giobie@gmail.com',
        status: 'active',
        isVerified: true,
        // ownerId will be set during seeding
        staffIds: [],
      },
      {
        name: 'Homestay Mộc Châu Valley',
        type: 'homestay',
        description:
          'Homestay ấm áp giữa núi rừng Mộc Châu, trải nghiệm cuộc sống địa phương với gia đình chủ nhà thân thiện.',
        thumbnail: 'https://cdn.vinaside.vn/properties/homestay-moc-chau.jpg',
        images: [
          'https://cdn.vinaside.vn/properties/homestay-moc-chau-1.jpg',
          'https://cdn.vinaside.vn/properties/homestay-moc-chau-2.jpg',
        ],
        location: {
          lat: 20.8566,
          lng: 104.6627,
          address: 'Bản Áng, Xã Phiêng Luông, Huyện Mộc Châu',
          city: 'Sơn La',
          district: 'Mộc Châu',
          ward: 'Phiêng Luông',
        },
        amenities: [
          'Trải nghiệm nông trại',
          'Thức ăn địa phương',
          'Trekking',
          'Wifi',
          'Điều hòa',
          'Chỗ đậu xe',
        ],
        checkInTime: '14:00',
        checkOutTime: '11:00',
        houseRules: [
          'Tôn trọng văn hóa địa phương',
          'Không hút thuốc trong nhà',
          'Tham gia hoạt động gia đình',
        ],
        contactPhone: '+84 912 345 678',
        contactEmail: 'homestay.mocchau@gmail.com',
        status: 'active',
        isVerified: true,
        staffIds: [],
      },
      {
        name: 'Resort Phú Quốc Paradise',
        type: 'resort',
        description:
          'Resort sang trọng trên đảo Phú Quốc với dịch vụ 5 sao, spa, và các hoạt động thể thao nước.',
        thumbnail: 'https://cdn.vinaside.vn/properties/resort-phu-quoc.jpg',
        images: [
          'https://cdn.vinaside.vn/properties/resort-phu-quoc-1.jpg',
          'https://cdn.vinaside.vn/properties/resort-phu-quoc-2.jpg',
          'https://cdn.vinaside.vn/properties/resort-phu-quoc-3.jpg',
          'https://cdn.vinaside.vn/properties/resort-phu-quoc-4.jpg',
        ],
        location: {
          lat: 10.2899,
          lng: 103.984,
          address: 'Bãi Trường, Dương Tơ, Phú Quốc',
          city: 'Kiên Giang',
          district: 'Phú Quốc',
          ward: 'Dương Tơ',
        },
        amenities: [
          'Spa',
          'Hồ bơi vô cực',
          'Nhà hàng',
          'Bar',
          'Thể thao nước',
          'Gym',
          'Kids club',
          'Wifi miễn phí',
          'Dịch vụ phòng 24/7',
        ],
        checkInTime: '15:00',
        checkOutTime: '12:00',
        houseRules: [
          'Dress code tại nhà hàng',
          'Không mang đồ ăn từ bên ngoài',
          'Giờ yên lặng từ 22:00-06:00',
        ],
        contactPhone: '+84 297 123 4567',
        contactEmail: 'info@phuquocparadise.com',
        status: 'active',
        isVerified: true,
        staffIds: [],
      },
      {
        name: 'Apartment Saigon Center',
        type: 'apartment',
        description:
          'Căn hộ hiện đại tại trung tâm Sài Gòn, tiện nghi đầy đủ, gần các trung tâm mua sắm và văn phòng.',
        thumbnail: 'https://cdn.vinaside.vn/properties/apartment-saigon.jpg',
        location: {
          lat: 10.7769,
          lng: 106.7009,
          address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
          city: 'TP.HCM',
          district: 'Quận 1',
          ward: 'Phường Bến Nghé',
        },
        amenities: [
          'Wifi miễn phí',
          'Điều hòa',
          'Bếp đầy đủ',
          'Máy giặt',
          'TV màn hình phẳng',
          'Thang máy',
          'Bảo vệ 24/7',
        ],
        checkInTime: '14:00',
        checkOutTime: '12:00',
        houseRules: ['Không hút thuốc', 'Không ồn ào', 'Tối đa 4 khách'],
        contactPhone: '+84 908 765 432',
        contactEmail: 'apartment.saigon@gmail.com',
        status: 'pending',
        isVerified: false,
        staffIds: [],
      },
      {
        name: 'Hotel Da Lat Luxury',
        type: 'hotel',
        description:
          'Khách sạn boutique tại Đà Lạt với thiết kế cổ điển Pháp, view thung lũng tuyệt đẹp.',
        thumbnail: 'https://cdn.vinaside.vn/properties/hotel-dalat.jpg',
        location: {
          lat: 11.9404,
          lng: 108.4583,
          address: '456 Trần Phú, Phường 4, Đà Lạt',
          city: 'Lâm Đồng',
          district: 'Đà Lạt',
          ward: 'Phường 4',
        },
        amenities: [
          'Nhà hàng',
          'Room service',
          'Lễ tân 24/7',
          'Wifi miễn phí',
          'Điều hòa',
          'Minibar',
          'Két an toàn',
        ],
        checkInTime: '14:00',
        checkOutTime: '12:00',
        houseRules: [
          'Check-in cần CMND/CCCD',
          'Không hút thuốc trong phòng',
          'Trả phòng đúng giờ',
        ],
        contactPhone: '+84 263 123 456',
        contactEmail: 'info@dalathotel.com',
        status: 'active',
        isVerified: true,
        staffIds: [],
      },
    ];

    // Insert properties
    const properties = await this.propertyModel.insertMany(sampleProperties);
    console.log(`✅ Created ${properties.length} sample properties`);

    console.log('🎉 Property seed completed successfully!');
  }
}
