import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { EditRequestsController } from './edit-requests.controller';
import { EditRequestsService } from './edit-requests.service';

@Module({
  imports: [ExpensesModule],
  controllers: [EditRequestsController],
  providers: [EditRequestsService],
  exports: [EditRequestsService],
})
export class EditRequestsModule {}
