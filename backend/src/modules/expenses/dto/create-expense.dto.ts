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
  ValidateNested,
} from 'class-validator';
import { Currency, PaymentMethod } from '../../../generated/prisma/enums';
import { validationMessage } from '../../../common/errors/validation-error';

/** 2 kasrgacha musbat pul summasi. String — frontendda float arifmetikasi qilinmaydi (TZ 4.3) */
const MONEY = /^\d{1,16}(\.\d{1,2})?$/;

export class ExpenseShareDto {
  @IsString()
  employeeId!: string;

  @Matches(MONEY, {
    message: validationMessage('validation.SHARE_MONEY_FORMAT'),
  })
  amount!: string;
}

export class CreateExpenseDto {
  @IsString()
  branchId!: string;

  @IsString()
  categoryId!: string;

  /** Xarajat kimlar uchun qilingan (TZ 3.6) */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  employeeIds!: string[];

  @Matches(MONEY, { message: validationMessage('validation.MONEY_FORMAT') })
  amount!: string;

  @IsEnum(Currency)
  currency!: Currency;

  @IsDateString({ strict: true })
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  /**
   * Qo'lda taqsimlash. Berilmasa summa xodimlar o'rtasida teng bo'linadi;
   * berilsa ulushlar yig'indisi umumiy summaga **aniq teng** bo'lishi shart.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseShareDto)
  shares?: ExpenseShareDto[];
}
