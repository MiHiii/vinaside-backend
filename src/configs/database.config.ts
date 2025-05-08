import { MongooseModuleOptions } from '@nestjs/mongoose';

export const getDatabaseConfig = (): MongooseModuleOptions => {
  return {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/vinaside',
  };
};
