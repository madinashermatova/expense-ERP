import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { EncryptionService } from './crypto/encryption.service';
import { TranslationService } from './i18n/translation.service';
import { PasswordService } from './crypto/password.service';
import { BranchScopeService } from './scope/branch-scope.service';

@Global()
@Module({
  providers: [
    TranslationService,
    PasswordService,
    EncryptionService,
    BranchScopeService,
    AuditService,
  ],
  exports: [
    TranslationService,
    PasswordService,
    EncryptionService,
    BranchScopeService,
    AuditService,
  ],
})
export class CommonModule {}
