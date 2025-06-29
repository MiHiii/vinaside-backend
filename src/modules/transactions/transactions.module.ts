import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import {
  TransactionLog,
  TransactionLogSchema,
} from './schemas/transaction-log.schema';
import { TransactionsService } from './services/transactions.service';
import { TransactionLogsService } from './services/transaction-logs.service';
import { TransactionsController } from './controllers/transactions.controller';
import { TransactionLogsController } from './controllers/transaction-logs.controller';
import { PropertyModule } from '../properties/property.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: TransactionLog.name, schema: TransactionLogSchema },
    ]),
    PropertyModule,
  ],
  controllers: [TransactionsController, TransactionLogsController],
  providers: [TransactionsService, TransactionLogsService],
  exports: [TransactionsService, TransactionLogsService],
})
export class TransactionsModule {}
