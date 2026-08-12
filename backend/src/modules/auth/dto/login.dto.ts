import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  /** Email yoki username (TZ 3.1) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  login!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  /**
   * Bir xil login bir nechta kompaniyada mavjud bo'lganda qaysi kompaniyaga
   * kirilayotganini aniqlaydi (TZ 3.16.2 — bir odam bir nechta kompaniyada ishlashi mumkin).
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  companySlug?: string;
}
