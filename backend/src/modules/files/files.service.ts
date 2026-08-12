import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantData } from '../../common/tenancy/tenant-data';
import { Prisma } from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { EnvironmentVariables } from '../../config/env.validation';
import { AllowedMime, detectMime, sanitizeFileName } from './file-type.util';
import { StorageService } from './storage.service';
import {
  appError,
  notFound as notFoundError,
  unprocessable,
} from '../../common/errors/app-error';

export interface UploadedFileInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface FileView {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tenantContext: TenantContextService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  get maxFileSizeBytes(): number {
    return (
      this.config.get('UPLOAD_MAX_FILE_SIZE_MB', { infer: true }) * 1024 * 1024
    );
  }

  get maxFilesPerExpense(): number {
    return this.config.get('UPLOAD_MAX_FILES_PER_EXPENSE', { infer: true });
  }

  /**
   * Yuklangan faylni tekshiradi: hajm, ruxsat etilgan tur va **mazmun**.
   * Fayl turi `Content-Type` ga emas, magic-byte ga qarab aniqlanadi (TZ 4.2).
   */
  validate(file: UploadedFileInput): AllowedMime {
    if (file.size > this.maxFileSizeBytes) {
      throw appError('FILE_TOO_LARGE', {
        status: 413,
        args: {
          maxMb: this.config.get('UPLOAD_MAX_FILE_SIZE_MB', { infer: true }),
        },
        details: { files: [file.originalname] },
      });
    }

    const detected = detectMime(file.buffer);

    if (!detected) {
      throw unprocessable('FILE_TYPE_NOT_ALLOWED', {
        details: { files: [file.originalname] },
      });
    }

    // E'lon qilingan tur mazmunga mos kelmasa — soxtalashtirishga urinish
    if (file.mimetype && file.mimetype !== detected) {
      throw unprocessable('FILE_CONTENT_MISMATCH', {
        details: {
          files: [`${file.originalname}: ${file.mimetype} ≠ ${detected}`],
        },
      });
    }

    return detected;
  }

  assertFileCount(current: number, incoming: number): void {
    if (current + incoming > this.maxFilesPerExpense) {
      throw unprocessable('TOO_MANY_FILES', {
        args: { max: this.maxFilesPerExpense },
        details: { files: [`${current} + ${incoming}`] },
      });
    }
  }

  /** Xarajatga chek/isbot biriktiradi (S6 dagi upload endpointi shuni chaqiradi) */
  async attachToExpense(
    expenseId: string,
    files: UploadedFileInput[],
    uploadedByUserId: string,
  ): Promise<FileView[]> {
    const companyId = this.tenantContext.requireCompanyId(
      'ExpenseFile',
      'create',
    );

    const existing = await this.prisma.db.expenseFile.count({
      where: { expenseId },
    });
    this.assertFileCount(existing, files.length);

    const saved: FileView[] = [];

    for (const file of files) {
      const mime = this.validate(file);
      const key = this.storage.buildKey(companyId, 'expenses', expenseId, mime);
      const stored = await this.storage.put(key, file.buffer, mime);

      const row = await this.prisma.db.expenseFile.create({
        data: tenantData<Prisma.ExpenseFileUncheckedCreateInput>({
          expenseId,
          storageKey: stored.storageKey,
          originalName: sanitizeFileName(file.originalname),
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          uploadedByUserId,
        }),
      });

      saved.push(this.toView(row));
    }

    return saved;
  }

  /** Qaytarish isbotini biriktiradi (S9) */
  async attachToRefund(
    refundId: string,
    files: UploadedFileInput[],
  ): Promise<FileView[]> {
    const companyId = this.tenantContext.requireCompanyId(
      'RefundFile',
      'create',
    );
    const saved: FileView[] = [];

    for (const file of files) {
      const mime = this.validate(file);
      const key = this.storage.buildKey(companyId, 'refunds', refundId, mime);
      const stored = await this.storage.put(key, file.buffer, mime);

      const row = await this.prisma.db.refundFile.create({
        data: tenantData<Prisma.RefundFileUncheckedCreateInput>({
          refundId,
          storageKey: stored.storageKey,
          originalName: sanitizeFileName(file.originalname),
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
        }),
      });

      saved.push(this.toView(row));
    }

    return saved;
  }

  /**
   * Signed URL. Tenant tekshiruvi ikki qatlamli:
   * yozuvni topish (Prisma extension) va kalitning `{companyId}/` prefiksi.
   */
  async getSignedUrl(
    fileId: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    const companyId = this.tenantContext.requireCompanyId('File', 'read');

    const file =
      (await this.prisma.db.expenseFile.findUnique({
        where: { id: fileId },
      })) ??
      (await this.prisma.db.refundFile.findUnique({ where: { id: fileId } }));

    if (!file) throw this.notFound();

    if (!file.storageKey.startsWith(`${companyId}/`)) {
      // Bazadagi bog'lanish buzilgan bo'lsa ham fayl chiqib ketmaydi
      throw this.notFound();
    }

    return this.storage.signedUrl(file.storageKey, file.originalName);
  }

  async removeExpenseFile(fileId: string): Promise<void> {
    const file = await this.prisma.db.expenseFile.findUnique({
      where: { id: fileId },
    });
    if (!file) throw this.notFound();

    await this.prisma.db.expenseFile.delete({ where: { id: fileId } });
    await this.storage.remove(file.storageKey);
  }

  async listForExpense(expenseId: string): Promise<FileView[]> {
    const rows = await this.prisma.db.expenseFile.findMany({
      where: { expenseId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toView(r));
  }

  private toView(row: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
  }): FileView {
    return {
      id: row.id,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt,
    };
  }

  private notFound(): NotFoundException {
    return notFoundError('FILE_NOT_FOUND');
  }
}
