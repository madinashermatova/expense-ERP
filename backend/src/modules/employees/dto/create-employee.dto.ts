import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Language, Role } from '../../../generated/prisma/enums';

export class CreateEmployeeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @IsUUID()
  branchId!: string;

  /** Ma'lumot maydoni — autentifikatsiyada ishlatilmaydi (TZ 3.1) */
  @IsOptional()
  @Matches(/^\+998\d{9}$/, {
    message: "Telefon +998XXXXXXXXX formatida bo'lishi kerak",
  })
  phone?: string;

  @IsOptional()
  @IsDateString()
  hiredAt?: string;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  /** DIRECTOR faqat WORKER yarata oladi (TZ 3.3) */
  @IsEnum(Role)
  role!: Role;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9._-]+$/i, {
    message:
      "Username faqat harf, raqam va . _ - belgilaridan iborat bo'lishi mumkin",
  })
  username?: string;

  /** Berilmasa tizim generatsiya qiladi va bir marta qaytaradi */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}
