import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { EditRequestStatus } from '../../../generated/prisma/enums';
import { UpdateExpenseDto } from '../../expenses/dto/update-expense.dto';

/** Murojaat matnining eng kam uzunligi — rad etish sababi bilan bir xil (TZ 3.7, 3.8) */
export const MIN_EDIT_REQUEST_LENGTH = 10;

/** `resolved` — UI dagi «Hal qilingan» yorlig'i: `APPLIED` + `REJECTED` */
export const EDIT_REQUEST_FILTERS = [
  ...Object.values(EditRequestStatus),
  'RESOLVED',
] as const;

export class ListEditRequestsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(EDIT_REQUEST_FILTERS)
  status?: (typeof EDIT_REQUEST_FILTERS)[number];

  @IsOptional()
  @IsUUID()
  expenseId?: string;
}

export class CreateEditRequestDto {
  @IsUUID()
  expenseId!: string;

  /** Nima o'zgarishi kerakligi va sababi */
  @IsString()
  @MinLength(MIN_EDIT_REQUEST_LENGTH, {
    message: `Murojaat matni kamida ${MIN_EDIT_REQUEST_LENGTH} belgidan iborat bo'lishi kerak`,
  })
  @MaxLength(2000)
  description!: string;
}

export class ApplyEditRequestDto {
  /**
   * Ixtiyoriy: murojaatni qabul qilish bilan birga xarajatni ham tahrirlash.
   * Berilmasa murojaat shunchaki `APPLIED` deb belgilanadi — direktor tahrirni
   * `PATCH /expenses/:id` orqali alohida bajargan bo'ladi.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateExpenseDto)
  changes?: UpdateExpenseDto;
}

export class RejectEditRequestDto {
  @IsString()
  @MinLength(MIN_EDIT_REQUEST_LENGTH, {
    message: `Rad etish sababi kamida ${MIN_EDIT_REQUEST_LENGTH} belgidan iborat bo'lishi kerak`,
  })
  @MaxLength(1000)
  reason!: string;
}
