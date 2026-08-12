import { Global, Module } from '@nestjs/common';
import { PasswordService } from './crypto/password.service';
import { BranchScopeService } from './scope/branch-scope.service';

@Global()
@Module({
  providers: [PasswordService, BranchScopeService],
  exports: [PasswordService, BranchScopeService],
})
export class CommonModule {}
