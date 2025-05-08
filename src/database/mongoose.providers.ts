import { MongooseModule } from '@nestjs/mongoose';
import { getDatabaseConfig } from '../configs/database.config';

export const MongooseConfigModule = MongooseModule.forRootAsync({
  useFactory: () => getDatabaseConfig(),
});
