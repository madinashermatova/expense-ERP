import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { EnvironmentVariables } from '../../config/env.validation';
import { AllowedMime, extensionFor } from './file-type.util';

export interface StoredObject {
  storageKey: string;
  sizeBytes: number;
  mimeType: AllowedMime;
}

/**
 * S3-mos fayl saqlash (dev/prod — MinIO, prodda cloud S3 ham mumkin).
 *
 * TZ 3.16.1 — barcha kalitlar `{companyId}/` bilan prefikslanadi. Bu tenant izolyatsiyasining
 * ikkinchi qatlami: hatto bazadagi yozuv noto'g'ri bog'langan bo'lsa ham, kalit
 * boshqa kompaniyaning katalogiga tushmaydi.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly signedUrlTtl: number;

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.signedUrlTtl = config.get('S3_SIGNED_URL_TTL_SECONDS', {
      infer: true,
    });

    this.client = new S3Client({
      endpoint: config.get('S3_ENDPOINT', { infer: true }),
      region: config.get('S3_REGION', { infer: true }),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
      },
    });
  }

  /** Dev va test qulayligi uchun: bucket bo'lmasa yaratiladi */
  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        this.logger.log(`Bucket yaratildi: ${this.bucket}`);
      } catch (error) {
        // Storage ishlamasa ham ilova ko'tarilishi kerak — fayl amallari o'shanda xato beradi
        this.logger.warn(`Bucket tekshiruvi muvaffaqiyatsiz: ${String(error)}`);
      }
    }
  }

  /**
   * Kalit formati: `{companyId}/{scope}/{ownerId}/{uuid}.{ext}`
   * Kengaytma foydalanuvchi nomidan emas, aniqlangan MIME dan olinadi.
   */
  buildKey(
    companyId: string,
    scope: 'expenses' | 'refunds',
    ownerId: string,
    mime: AllowedMime,
  ): string {
    return `${companyId}/${scope}/${ownerId}/${randomUUID()}.${extensionFor(mime)}`;
  }

  async put(
    key: string,
    body: Buffer,
    mime: AllowedMime,
  ): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mime,
      }),
    );

    return { storageKey: key, sizeBytes: body.length, mimeType: mime };
  }

  /** TZ 4.2 — fayllarga kirish faqat vaqtinchalik signed URL orqali (TTL 15 daqiqa) */
  async signedUrl(
    key: string,
    downloadName?: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(downloadName
        ? { ResponseContentDisposition: `inline; filename="${downloadName}"` }
        : {}),
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: this.signedUrlTtl,
    });

    return { url, expiresAt: new Date(Date.now() + this.signedUrlTtl * 1000) };
  }

  async remove(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
