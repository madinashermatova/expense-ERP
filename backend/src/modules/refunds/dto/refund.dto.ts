import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { RefundStatus } from '../../../generated/prisma/enums';

const MONEY = /^\d{1,16}(\.\d{1,2})?$/;

/** Sabab matnining eng kam uzunligi — tasdiqlash oqimidagi bilan bir xil (TZ 3.7) */
export const MIN_REFUND_REASON_LENGTH = 10;

/** «Navbatda» yorlig'i: hali yakuniy qaror chiqmagan so'rovlar */
export const REFUND_FILTERS = [
  ...Object.values(RefundStatus),
  'PENDING',
] as const;

/**
 * `multipart/form-data` bilan keladi — isbot fayli majburiy bo'lgani uchun (TZ 3.9)
 * so'rov va fayl bitta chaqiruvda yuboriladi. Barcha maydonlar matn ko'rinishida keladi.
 */
export class CreateRefundDto {
  @IsUUID()
  expenseId!: string;

  @Matches(MONEY, { message: "Qaytarish summasi noto'g'ri formatda" })
  amount!: string;

  @IsString()
  @MinLength(MIN_REFUND_REASON_LENGTH, {
    message: `Sabab kamida ${MIN_REFUND_REASON_LENGTH} belgidan iborat bo'lishi kerak`,
  })
  @MaxLength(1000)
  reason!: string;
}

export class ListRefundsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(REFUND_FILTERS)
  status?: (typeof REFUND_FILTERS)[number];

  @IsOptional()
  @IsUUID()
  expenseId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class ApproveRefundDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  version?: number;
}

export class RejectRefundDto {
  @IsString()
  @MinLength(MIN_REFUND_REASON_LENGTH, {
    message: `Rad etish sababi kamida ${MIN_REFUND_REASON_LENGTH} belgidan iborat bo'lishi kerak`,
  })
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}
