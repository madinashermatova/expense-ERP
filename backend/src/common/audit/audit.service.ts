import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { tenantData } from '../tenancy/tenant-data';
import { Prisma } from '../../generated/prisma/client';

export interface AuditChange {
  field: string;
  old: unknown;
  new: unknown;
}

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string;
  changes?: AuditChange[];
}

/**
 * Append-only audit jurnaliga yozuv qo'shadi (TZ 3.14).
 *
 * Bu bosqichda faqat yozish qismi kerak — `AuditInterceptor` va `GET /audit` S14 da
 * shu servis ustiga qo'shiladi, chaqiruvchi kod o'zgarmaydi.
 *
 * Audit yozuvi **hech qachon asosiy amalni yiqitmaydi**: jurnalga yozib bo'lmasa,
 * xato loglanadi, lekin foydalanuvchi amali bekor qilinmaydi.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.db.auditLog.create({
        data: tenantData<Prisma.AuditLogUncheckedCreateInput>({
          userId: this.tenantContext.userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          changes: entry.changes
            ? (entry.changes as unknown as Prisma.InputJsonValue)
            : undefined,
          ip: this.tenantContext.ip,
          channel: this.tenantContext.channel,
        }),
      });
    } catch (error) {
      this.logger.error(
        `Audit yozuvi saqlanmadi: ${entry.action} ${entry.entityType} ${entry.entityId ?? ''}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** `old` va `new` obyektlarni solishtirib faqat o'zgargan maydonlarni qaytaradi */
  diff(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): AuditChange[] {
    const changes: AuditChange[] = [];
    for (const field of Object.keys(after)) {
      const oldValue = before[field];
      const newValue = after[field];
      if (String(oldValue) === String(newValue)) continue;
      changes.push({ field, old: oldValue ?? null, new: newValue ?? null });
    }
    return changes;
  }
}
