import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Paginated } from '../../common/dto/pagination.dto';
import { Role } from '../../generated/prisma/enums';
import { AuditEntryView, AuditLogService } from './audit-log.service';
import { ListAuditDto } from './dto/list-audit.dto';

/**
 * TZ 3.14 — jurnalni faqat bosh admin ko'radi (direktor → 403).
 *
 * Jurnal append-only: `POST`, `PATCH`, `DELETE` endpointlari ataylab mavjud emas.
 */
@Roles(Role.ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditLogService) {}

  @Get()
  list(@Query() query: ListAuditDto): Promise<Paginated<AuditEntryView>> {
    return this.audit.list(query);
  }

  @Get('facets')
  facets(): Promise<{ actions: string[]; entityTypes: string[] }> {
    return this.audit.facets();
  }
}
