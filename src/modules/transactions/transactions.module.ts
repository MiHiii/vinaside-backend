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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: TransactionLog.name, schema: TransactionLogSchema },
    ]),
  ],
  controllers: [TransactionsController, TransactionLogsController],
  providers: [TransactionsService, TransactionLogsService],
  exports: [TransactionsService, TransactionLogsService],
})
export class TransactionsModule {}
