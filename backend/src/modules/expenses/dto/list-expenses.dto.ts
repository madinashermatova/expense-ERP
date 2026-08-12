import { Transform } from 'class-transformer';
import {
  IsBooleanString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  Currency,
  ExpenseStatus,
  PaymentMethod,
} from '../../../generated/prisma/enums';

/** Ro'yxatda saralashga ruxsat etilgan ustunlar — ixtiyoriy matn SQL ga tushmasligi uchun */
export const EXPENSE_SORT_FIELDS = [
  'date',
  'amount',
  'amountUzs',
  'createdAt',
  'globalNumber',
  'status',
] as const;

export type ExpenseSortField = (typeof EXPENSE_SORT_FIELDS)[number];

export class ListExpensesDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Ushbu xodim ulushi bor xarajatlar */
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
  @IsDateString({ strict: true })
  dateFrom?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  dateTo?: string;

  @IsOptional()
  @IsString()
  amountFrom?: string;

  @IsOptional()
  @IsString()
  amountTo?: string;

  /** Ikkala raqam bo'yicha ham, izoh bo'yicha ham qidiradi */
  @IsOptional()
  @IsString()
  q?: string;

  /** Sukut bo'yicha o'chirilganlar ko'rinmaydi (soft delete) */
  @IsOptional()
  @IsBooleanString()
  includeDeleted?: string;
}
