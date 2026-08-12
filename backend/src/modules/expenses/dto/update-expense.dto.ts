import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Currency, PaymentMethod } from '../../../generated/prisma/enums';
import { ExpenseShareDto } from './create-expense.dto';

const MONEY = /^\d{1,16}(\.\d{1,2})?$/;

/** Tahrirlash sababi (TZ 3.8) */
export const MIN_EDIT_REASON_LENGTH = 10;

/**
 * Tahrirlanadigan maydonlar (TZ 3.8). Raqamlar, status, kim kiritgani va kurs manbasi
 * bu yerda yo'q — ular hech qachon tahrirlanmaydi.
 */
export class UpdateExpenseDto {
  @IsString()
  @MinLength(MIN_EDIT_REASON_LENGTH, {
    message: `Tahrirlash sababi kamida ${MIN_EDIT_REASON_LENGTH} belgidan iborat bo'lishi kerak`,
  })
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Matches(MONEY, { message: "Summa noto'g'ri formatda" })
  amount?: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsDateString({ strict: true })
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  /** Berilsa taqsimlash butunlay qayta quriladi */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  employeeIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseShareDto)
  shares?: ExpenseShareDto[];
}
