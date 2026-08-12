import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  Currency,
  ExpenseStatus,
  ExportFormat,
  ExportType,
  Language,
  PaymentMethod,
} from '../../../generated/prisma/enums';
import { REPORT_PERIODS } from '../../reports/dto/report-filter.dto';

/**
 * Eksport filtrlari — ekrandagi filtrlarning aynan o'zi (TZ 3.13).
 *
 * Bitta DTO barcha E1–E10 uchun: ro'yxat filtrlari (`status`, `q`) va hisobot
 * filtrlari (`period`) birlashtirilgan, har bir eksport turi o'ziga keraklisini oladi.
 * Ortiqcha maydon jim e'tiborsiz qoldirilmaydi — `forbidNonWhitelisted` uni rad etadi.
 */
export class ExportFiltersDto {
  @IsOptional()
  @IsIn(REPORT_PERIODS)
  period?: (typeof REPORT_PERIODS)[number];

  @IsOptional()
  @IsDateString({ strict: true })
  dateFrom?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  dateTo?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  createdByUserId?: string;

  @IsOptional()
  @IsEnum(ExpenseStatus, { each: true })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  status?: ExpenseStatus[];

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsString()
  amountFrom?: string;

  @IsOptional()
  @IsString()
  amountTo?: string;

  @IsOptional()
  @IsString()
  q?: string;

  /** TOP-N kesimlar uchun (E4 — sukut bo'yicha 10) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  limit?: number;
}

export class CreateExportDto {
  @IsEnum(ExportType)
  type!: ExportType;

  @IsEnum(ExportFormat)
  format!: ExportFormat;

  /** Ustun sarlavhalari tili; berilmasa foydalanuvchi profilidagi til (TZ 3.13) */
  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExportFiltersDto)
  filters?: ExportFiltersDto;
}
