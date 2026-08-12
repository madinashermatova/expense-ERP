import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { BudgetScope, Currency } from '../../../generated/prisma/enums';

const MONEY = /^\d{1,16}(\.\d{1,2})?$/;

export class CreateBudgetDto {
  @IsEnum(BudgetScope)
  scope!: BudgetScope;

  /** `scope` ga qarab filial, kategoriya yoki xodim id si */
  @IsUUID()
  scopeId!: string;

  @Matches(MONEY, { message: "Limit summasi noto'g'ri formatda" })
  amount!: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsDateString({ strict: true })
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString({ strict: true })
  effectiveTo?: string;
}

export class UpdateBudgetDto {
  @IsOptional()
  @Matches(MONEY, { message: "Limit summasi noto'g'ri formatda" })
  amount?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  effectiveFrom?: string;

  /** `null` yuborish uchun bo'sh matn — cheksiz muddat */
  @IsOptional()
  @IsString()
  effectiveTo?: string;
}

export class ListBudgetsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(BudgetScope)
  scope?: BudgetScope;

  @IsOptional()
  @IsUUID()
  scopeId?: string;

  /** Ushbu sanaga amalda bo'lgan limitlar; berilmasa — bugun */
  @IsOptional()
  @IsDateString({ strict: true })
  on?: string;
}

export class BudgetUsageDto {
  @IsOptional()
  @IsEnum(BudgetScope)
  scope?: BudgetScope;

  @IsOptional()
  @IsDateString({ strict: true })
  on?: string;
}
