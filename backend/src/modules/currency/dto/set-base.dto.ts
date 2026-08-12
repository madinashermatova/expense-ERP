import { IsEnum } from 'class-validator';
import { RateSource } from '../../../generated/prisma/enums';

export class SetCurrencyBaseDto {
  /** AUTO — CBU kurslari, MANUAL — qo'lda kiritilganlar (TZ 3.5) */
  @IsEnum(RateSource)
  mode!: RateSource;
}
