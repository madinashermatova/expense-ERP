import { Injectable } from '@nestjs/common';
import {
  Paginated,
  paginate,
  toSkipTake,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { Channel, Role } from '../../generated/prisma/enums';
import { ListAuditDto } from './dto/list-audit.dto';

export interface AuditEntryView {
  id: string;
  createdAt: Date;
  userId: string | null;
  userName: string | null;
  userRole: Role | null;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: Prisma.JsonValue;
  ip: string | null;
  channel: Channel;
}

/**
 * Audit jurnalini **o'qish** (TZ 3.14). Yozish `common/audit/audit.service.ts` da.
 *
 * Jurnal append-only: bu yerda ham, boshqa joyda ham `update`/`delete` yo'q —
 * DB trigger ham uni majburlaydi.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAuditDto): Promise<Paginated<AuditEntryView>> {
    const { skip, take, page, limit } = toSkipTake(query);
    const where = buildWhere(query);

    const [rows, total] = await Promise.all([
      this.prisma.db.auditLog.findMany({
        where,
        include: {
          user: {
            select: { role: true, employee: { select: { fullName: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.db.auditLog.count({ where }),
    ]);

    return paginate(
      rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        userId: row.userId,
        userName: row.user?.employee?.fullName ?? null,
        userRole: row.user?.role ?? null,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        changes: row.changes,
        ip: row.ip,
        channel: row.channel,
      })),
      total,
      page,
      limit,
    );
  }

  /** Jurnalda uchraydigan amal va obyekt turlari — frontend filtr ro'yxati uchun */
  async facets(): Promise<{ actions: string[]; entityTypes: string[] }> {
    const [actions, entityTypes] = await Promise.all([
      this.prisma.db.auditLog.findMany({
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
      }),
      this.prisma.db.auditLog.findMany({
        distinct: ['entityType'],
        select: { entityType: true },
        orderBy: { entityType: 'asc' },
      }),
    ]);

    return {
      actions: actions.map((row) => row.action),
      entityTypes: entityTypes.map((row) => row.entityType),
    };
  }
}

/** Eksport (E9) ham aynan shu filtrlarni ishlatadi — mantiq bitta joyda */
export function buildWhere(query: {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  entityType?: string;
  action?: string;
  channel?: Channel;
  q?: string;
  search?: string;
}): Prisma.AuditLogWhereInput {
  const term = (query.q ?? query.search)?.trim();

  return {
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.channel ? { channel: query.channel } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: atUtcMidnight(query.dateFrom) } : {}),
            // Kun oxirigacha: `createdAt` vaqt bilan saqlanadi
            ...(query.dateTo
              ? {
                  lte: new Date(
                    atUtcMidnight(query.dateTo).getTime() + 86_399_999,
                  ),
                }
              : {}),
          },
        }
      : {}),
    ...(term
      ? {
          OR: [
            { action: { contains: term, mode: 'insensitive' } },
            { entityType: { contains: term, mode: 'insensitive' } },
            { entityId: { contains: term, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

function atUtcMidnight(value: string): Date {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}
