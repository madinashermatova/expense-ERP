import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { formatInTimeZone } from 'date-fns-tz';
import { AuditService } from '../../common/audit/audit.service';
import {
  Paginated,
  paginate,
  toSkipTake,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { tenantData } from '../../common/tenancy/tenant-data';
import { EnvironmentVariables } from '../../config/env.validation';
import { Prisma } from '../../generated/prisma/client';
import {
  ExportFormat,
  ExportStatus,
  ExportType,
  Language,
  Role,
} from '../../generated/prisma/enums';
import { StorageService } from '../files/storage.service';
import { NOTIFICATION_TYPES } from '../notifications/notification-types';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateExportDto, ExportFiltersDto } from './dto/create-export.dto';
import { ListExportsDto } from './dto/list-exports.dto';
import {
  EXPORT_CATALOG,
  EXPORT_TTL_HOURS,
  SYNC_ROW_LIMIT,
} from './export-catalog';
import { ExportDataService } from './export-data.service';
import { ExportMeta } from './export-dataset';
import {
  EXPORT_JOB,
  EXPORT_JOB_OPTIONS,
  EXPORT_QUEUE,
  ExportJobData,
} from './export-queue';
import { PdfWriter } from './pdf.writer';
import { XlsxWriter } from './xlsx.writer';
import {
  forbidden,
  notFound,
  unprocessable,
} from '../../common/errors/app-error';

export interface ExportJobView {
  id: string;
  type: ExportType;
  format: ExportFormat;
  status: ExportStatus;
  filters: Prisma.JsonValue;
  rowCount: number | null;
  error: string | null;
  createdAt: Date;
  finishedAt: Date | null;
  expiresAt: Date | null;
  /** Fon rejimida darhol `false` — fayl tayyor bo'lgach `true` bo'ladi */
  ready: boolean;
}

export interface DownloadLink {
  url: string;
  expiresAt: Date;
  fileName: string;
}

/**
 * Eksport oqimi (TZ 3.13).
 *
 * Kichik eksport (≤ 1000 qator) so'rov ichida generatsiya qilinadi — foydalanuvchi
 * darhol havolani oladi. Kattasi BullMQ ga tushadi va so'rov `jobId` bilan bloklanmasdan
 * qaytadi; tayyor bo'lgach bildirishnoma yuboriladi.
 *
 * Ikkala yo'l ham bitta `generate()` ni chaqiradi — fon rejimidagi fayl sinxron fayldan
 * farq qilmasligi kerak.
 */
@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);
  private readonly timezone: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly data: ExportDataService,
    private readonly xlsx: XlsxWriter,
    private readonly pdf: PdfWriter,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly tenantContext: TenantContextService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    @InjectQueue(EXPORT_QUEUE) private readonly queue: Queue,
  ) {
    this.timezone = config.get('DEFAULT_TIMEZONE', { infer: true });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // So'rov
  // ───────────────────────────────────────────────────────────────────────────

  async create(dto: CreateExportDto): Promise<ExportJobView> {
    const companyId = this.tenantContext.requireCompanyId(
      'ExportJob',
      'create',
    );
    const userId = this.tenantContext.userId as string;
    const filters = dto.filters ?? new ExportFiltersDto();

    this.assertAllowed(dto);

    const language = dto.language ?? (await this.languageOf(userId));

    const job = await this.prisma.db.exportJob.create({
      data: tenantData<Prisma.ExportJobUncheckedCreateInput>({
        requestedByUserId: userId,
        type: dto.type,
        format: dto.format,
        filters: filters as unknown as Prisma.InputJsonValue,
        status: ExportStatus.QUEUED,
      }),
    });

    // Har bir eksport amali audit jurnaliga tushadi (TZ 3.13)
    await this.audit.log({
      action: 'EXPORT',
      entityType: 'ExportJob',
      entityId: job.id,
      changes: [
        { field: 'type', old: null, new: dto.type },
        { field: 'format', old: null, new: dto.format },
        { field: 'filters', old: null, new: filters },
      ],
    });

    const estimated = await this.data.estimateRows(dto.type, filters);

    if (estimated > SYNC_ROW_LIMIT) {
      await this.enqueue(job.id, companyId, userId, language);
      this.logger.log(
        `Eksport ${job.id} (${dto.type}) fon rejimiga qo'yildi — ~${estimated} qator`,
      );
      return this.toView(await this.reload(job.id));
    }

    await this.generate(job.id, language);
    return this.toView(await this.reload(job.id));
  }

  /**
   * Faylni generatsiya qiladi va storage ga qo'yadi.
   *
   * Chaqiruvchi (so'rov yoki processor) tenant kontekstini o'rnatgan bo'lishi shart:
   * ma'lumot doirasi shu kontekstdan olinadi.
   */
  async generate(exportJobId: string, language: Language): Promise<void> {
    const job = await this.reload(exportJobId);

    await this.prisma.db.exportJob.update({
      where: { id: job.id },
      data: { status: ExportStatus.RUNNING },
    });

    try {
      const filters = (job.filters ?? {}) as ExportFiltersDto;
      const dataset = await this.data.build(job.type, filters);
      const meta = await this.buildMeta(job, filters, language);

      const writer = job.format === ExportFormat.PDF ? this.pdf : this.xlsx;
      const buffer = await writer.write(dataset, meta);

      const key = this.storage.buildExportKey(
        job.companyId,
        job.id,
        writer.extension,
      );
      await this.storage.putObject(key, buffer, writer.contentType);

      await this.prisma.db.exportJob.update({
        where: { id: job.id },
        data: {
          status: ExportStatus.DONE,
          storageKey: key,
          rowCount: dataset.rows.length,
          finishedAt: new Date(),
          expiresAt: new Date(Date.now() + EXPORT_TTL_HOURS * 3_600_000),
          error: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Eksport ${job.id} yiqildi: ${message}`);

      await this.prisma.db.exportJob.update({
        where: { id: job.id },
        data: {
          status: ExportStatus.FAILED,
          error: message.slice(0, 500),
          finishedAt: new Date(),
        },
      });

      throw error;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Ko'rish va yuklab olish
  // ───────────────────────────────────────────────────────────────────────────

  async list(query: ListExportsDto): Promise<Paginated<ExportJobView>> {
    const { skip, take, page, limit } = toSkipTake(query);
    const where: Prisma.ExportJobWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      // Bosh admin kompaniyaning barcha eksportlarini ko'radi, qolganlar — o'zinikini
      ...(this.tenantContext.role === Role.ADMIN
        ? {}
        : { requestedByUserId: this.tenantContext.userId ?? undefined }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.db.exportJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.db.exportJob.count({ where }),
    ]);

    return paginate(
      rows.map((row) => this.toView(row)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<ExportJobView> {
    return this.toView(await this.requireOwn(id));
  }

  /** TZ 4.2 — faylga kirish faqat vaqtinchalik signed URL orqali */
  async downloadLink(id: string): Promise<DownloadLink> {
    const job = await this.requireOwn(id);

    if (job.status !== ExportStatus.DONE || !job.storageKey) {
      throw notFound('EXPORT_NOT_READY');
    }

    if (job.expiresAt && job.expiresAt.getTime() < Date.now()) {
      throw notFound('EXPORT_EXPIRED');
    }

    const fileName = this.fileNameOf(job);
    const signed = await this.storage.signedUrl(
      job.storageKey,
      fileName,
      'attachment',
    );

    return { ...signed, fileName };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Ichki
  // ───────────────────────────────────────────────────────────────────────────

  /** Fon rejimidagi eksport tugagach foydalanuvchini xabardor qiladi (TZ 3.13) */
  async notifyReady(exportJobId: string, userId: string): Promise<void> {
    const job = await this.prisma.db.exportJob.findUnique({
      where: { id: exportJobId },
    });
    if (!job) return;

    const definition = EXPORT_CATALOG[job.type];
    const failed = job.status === ExportStatus.FAILED;

    await this.notifications.notifyUsers(
      [userId],
      failed ? NOTIFICATION_TYPES.exportFailed : NOTIFICATION_TYPES.exportReady,
      {
        exportJobId: job.id,
        title: definition.titleUz,
        format: job.format,
        rowCount: job.rowCount ?? 0,
      },
    );
  }

  private assertAllowed(dto: CreateExportDto): void {
    const definition = EXPORT_CATALOG[dto.type];
    const role = this.tenantContext.role;

    if (!role || !definition.roles.includes(role)) {
      throw forbidden('EXPORT_FORBIDDEN', { args: { type: dto.type } });
    }

    if (!definition.formats.includes(dto.format)) {
      throw unprocessable('EXPORT_FORMAT_UNSUPPORTED', {
        args: { type: dto.type, format: dto.format },
      });
    }
  }

  private async enqueue(
    exportJobId: string,
    companyId: string,
    userId: string,
    language: Language,
  ): Promise<void> {
    const data: ExportJobData = {
      companyId,
      exportJobId,
      userId,
      role: this.tenantContext.role as Role,
      branchId: this.tenantContext.branchId,
      language,
    };

    try {
      await this.queue.add(EXPORT_JOB, data, EXPORT_JOB_OPTIONS);
    } catch (error) {
      // Navbat ishlamasa job QUEUED da qolib ketmasin — holat aniq bo'lsin
      await this.prisma.db.exportJob.update({
        where: { id: exportJobId },
        data: {
          status: ExportStatus.FAILED,
          error: `Navbatga qo'shilmadi: ${String(error)}`.slice(0, 500),
          finishedAt: new Date(),
        },
      });
      this.logger.error(
        `Eksport ${exportJobId} navbatga tushmadi: ${String(error)}`,
      );
    }
  }

  private async requireOwn(id: string) {
    const job = await this.prisma.db.exportJob.findUnique({ where: { id } });

    // Boshqa foydalanuvchi eksporti — mavjudligini oshkor qilmaymiz
    if (
      !job ||
      (this.tenantContext.role !== Role.ADMIN &&
        job.requestedByUserId !== this.tenantContext.userId)
    ) {
      throw notFound('NOT_FOUND');
    }

    return job;
  }

  private async reload(id: string) {
    const job = await this.prisma.db.exportJob.findUnique({ where: { id } });
    if (!job) {
      throw notFound('NOT_FOUND');
    }
    return job;
  }

  /** Sarlavha bloki: nom, davr, filtrlar, kim va qachon (Asia/Tashkent) — TZ 3.13 */
  private async buildMeta(
    job: { type: ExportType; requestedByUserId: string },
    filters: ExportFiltersDto,
    language: Language,
  ): Promise<ExportMeta> {
    const definition = EXPORT_CATALOG[job.type];
    const user = await this.prisma.db.user.findUnique({
      where: { id: job.requestedByUserId },
      select: { email: true, employee: { select: { fullName: true } } },
    });

    return {
      title: language === Language.RU ? definition.titleRu : definition.titleUz,
      period: this.periodLabel(filters, language),
      filters: await this.filterLabels(filters, language),
      generatedAt: formatInTimeZone(
        new Date(),
        this.timezone,
        'dd.MM.yyyy HH:mm',
      ),
      requestedBy: user?.employee?.fullName ?? user?.email ?? '—',
      language,
    };
  }

  private periodLabel(
    filters: ExportFiltersDto,
    language: Language,
  ): string | null {
    const label = language === Language.RU ? 'Период' : 'Davr';

    if (filters.dateFrom || filters.dateTo) {
      return `${label}: ${filters.dateFrom ?? '…'} — ${filters.dateTo ?? '…'}`;
    }
    if (filters.period === 'previous') {
      return `${label}: ${language === Language.RU ? 'предыдущий' : "o'tgan"}`;
    }
    return `${label}: ${language === Language.RU ? 'текущий' : 'joriy'}`;
  }

  /** Filtrlar ro'yxati — id emas, nom ko'rinishida (fayl odam uchun o'qiladi) */
  private async filterLabels(
    filters: ExportFiltersDto,
    language: Language,
  ): Promise<string[]> {
    const ru = language === Language.RU;
    const labels: string[] = [];

    if (filters.branchId) {
      const branch = await this.prisma.db.branch.findUnique({
        where: { id: filters.branchId },
        select: { name: true },
      });
      labels.push(`${ru ? 'Филиал' : 'Filial'}: ${branch?.name ?? '—'}`);
    }

    if (filters.categoryId) {
      const category = await this.prisma.db.category.findUnique({
        where: { id: filters.categoryId },
        select: { nameUz: true, nameRu: true },
      });
      labels.push(
        `${ru ? 'Категория' : 'Kategoriya'}: ${(ru ? category?.nameRu : category?.nameUz) ?? '—'}`,
      );
    }

    if (filters.employeeId) {
      const employee = await this.prisma.db.employee.findUnique({
        where: { id: filters.employeeId },
        select: { fullName: true },
      });
      labels.push(
        `${ru ? 'Сотрудник' : 'Xodim'}: ${employee?.fullName ?? '—'}`,
      );
    }

    if (filters.status?.length) {
      labels.push(`${ru ? 'Статус' : 'Status'}: ${filters.status.join(', ')}`);
    }
    if (filters.paymentMethod) {
      labels.push(
        `${ru ? 'Способ оплаты' : "To'lov usuli"}: ${filters.paymentMethod}`,
      );
    }
    if (filters.currency) {
      labels.push(`${ru ? 'Валюта' : 'Valyuta'}: ${filters.currency}`);
    }
    if (filters.amountFrom || filters.amountTo) {
      labels.push(
        `${ru ? 'Сумма' : 'Summa'}: ${filters.amountFrom ?? '…'} — ${filters.amountTo ?? '…'}`,
      );
    }
    if (filters.q) {
      labels.push(`${ru ? 'Поиск' : 'Qidiruv'}: ${filters.q}`);
    }

    return labels;
  }

  private fileNameOf(job: {
    type: ExportType;
    format: ExportFormat;
    createdAt: Date;
  }): string {
    const stamp = formatInTimeZone(
      job.createdAt,
      this.timezone,
      'yyyy-MM-dd_HH-mm',
    );
    const extension = job.format === ExportFormat.PDF ? 'pdf' : 'xlsx';
    return `${job.type}_${stamp}.${extension}`;
  }

  private async languageOf(userId: string): Promise<Language> {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    return user?.language ?? Language.UZ;
  }

  private toView(job: {
    id: string;
    type: ExportType;
    format: ExportFormat;
    status: ExportStatus;
    filters: Prisma.JsonValue;
    rowCount: number | null;
    error: string | null;
    createdAt: Date;
    finishedAt: Date | null;
    expiresAt: Date | null;
  }): ExportJobView {
    return {
      id: job.id,
      type: job.type,
      format: job.format,
      status: job.status,
      filters: job.filters,
      rowCount: job.rowCount,
      error: job.error,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
      expiresAt: job.expiresAt,
      ready: job.status === ExportStatus.DONE,
    };
  }
}
