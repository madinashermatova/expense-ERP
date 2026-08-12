import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MIN_REASON_LENGTH } from '../expense-status';

export class ApproveExpenseDto {
  /**
   * Kartochka ochilgandagi `version`. Berilsa optimistik blokirovka mijoz ko'rgan
   * holatga bog'lanadi; berilmasa server o'qigan qiymat ishlatiladi — ikkala holatda
   * ham ikkinchi tasdiqlovchi 409 oladi.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}

export class RejectExpenseDto {
  @IsString()
  @MinLength(MIN_REASON_LENGTH, {
    message: `Sabab kamida ${MIN_REASON_LENGTH} belgidan iborat bo'lishi kerak`,
  })
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}

export class BulkApproveDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  ids!: string[];
}
