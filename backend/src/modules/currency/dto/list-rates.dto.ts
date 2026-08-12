import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { Currency } from '../../../generated/prisma/enums';

export class ListRatesDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}
