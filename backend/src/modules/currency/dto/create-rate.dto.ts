import { IsDateString, IsEnum, IsNumberString } from 'class-validator';
import { Currency } from '../../../generated/prisma/enums';

export class CreateRateDto {
  @IsDateString()
  date!: string;

  @IsEnum(Currency)
  currency!: Currency;

  /** 1 birlik uchun UZS qiymati, masalan "12650.500000" */
  @IsNumberString()
  rate!: string;
}
