import { Global, Module } from '@nestjs/common';
import { PlanLimitService } from './plan-limit.service';

@Global()
@Module({
  providers: [PlanLimitService],
  exports: [PlanLimitService],
})
export class PlansModule {}
