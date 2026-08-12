import { Transform } from 'class-transformer';
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
} from 'class-validator';
import { Currency, PaymentMethod } from '../../../generated/prisma/enums';

/** Sukut bo'yicha davr: sozlamadagi hisobot davri (TZ 3.13) */
export const REPORT_PERIODS = ['current', 'previous'] as const;

/** Dinamika grafigining qadami */
export const DYNAMICS_GRANULARITY = ['day', 'week', 'month'] as const;

/**
 * Hisobot filtrlari (TZ 3.13).
 *
 * `status` ataylab yo'q: hisobotlarda **faqat** ikki bosqichdan o'tgan xarajatlar
 * hisoblanadi, ya'ni statusni tanlash ma'nosini yo'qotadi. Status filtri xarajatlar
 * ro'yxatida (`GET /expenses`) qoladi.
 */
export class ReportFilterDto {
  /** `dateFrom`/`dateTo` berilmasa shu davr ishlatiladi */
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
}

export class GroupedReportDto extends ReportFilterDto {
  /** TOP-N uchun; xodimlar hisobotida sukut bo'yicha 10 (TZ 3.13) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  limit?: number;
}

export class DynamicsReportDto extends ReportFilterDto {
  @IsOptional()
  @IsIn(DYNAMICS_GRANULARITY)
  granularity?: (typeof DYNAMICS_GRANULARITY)[number];
}
