import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EmployeeStatus, Language } from '../../../generated/prisma/enums';
import { validationMessage } from '../../../common/errors/validation-error';

/**
 * `branchId` bu yerda yo'q — filial almashtirish alohida `transfer` amali orqali,
 * chunki u tarix yozuvini talab qiladi (TZ 3.3).
 * `role` ham yo'q — rol o'zgarishi alohida huquq (foydalanuvchilar moduli).
 */
export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @IsOptional()
  @Matches(/^\+998\d{9}$/, {
    message: validationMessage('validation.PHONE_FORMAT'),
  })
  phone?: string;

  @IsOptional()
  @IsDateString()
  hiredAt?: string;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
