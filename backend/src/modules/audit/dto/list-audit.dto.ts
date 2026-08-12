import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { Channel } from '../../../generated/prisma/enums';

/** TZ 3.14 — filtr: sana, foydalanuvchi, obyekt turi, amal, kanal */
export class ListAuditDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString({ strict: true })
  dateFrom?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  dateTo?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsEnum(Channel)
  channel?: Channel;

  /** Amal, obyekt turi va obyekt id si bo'yicha erkin qidiruv */
  @IsOptional()
  @IsString()
  q?: string;

  /**
   * `q` ning taxallusi — frontend jadvalidagi qidiruv maydoni shu nom bilan yuboradi.
   * `forbidNonWhitelisted` yoqilgani uchun ro'yxatda bo'lmasa so'rov 400 bilan rad etilardi.
   */
  @IsOptional()
  @IsString()
  search?: string;
}
