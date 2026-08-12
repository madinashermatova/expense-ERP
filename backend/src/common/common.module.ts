import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { EncryptionService } from './crypto/encryption.service';
import { PasswordService } from './crypto/password.service';
import { BranchScopeService } from './scope/branch-scope.service';

@Global()
@Module({
  providers: [
    PasswordService,
    EncryptionService,
    BranchScopeService,
    AuditService,
  ],
  exports: [
    PasswordService,
    EncryptionService,
    BranchScopeService,
    AuditService,
  ],
})
export class CommonModule {}
