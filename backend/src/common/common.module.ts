import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { PasswordService } from './crypto/password.service';
import { BranchScopeService } from './scope/branch-scope.service';

@Global()
@Module({
  providers: [PasswordService, BranchScopeService, AuditService],
  exports: [PasswordService, BranchScopeService, AuditService],
})
export class CommonModule {}
