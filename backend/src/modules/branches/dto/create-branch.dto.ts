import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { validationMessage } from '../../../common/errors/validation-error';

export class CreateBranchDto {
  /** TZ 3.6 — 2–5 ta lotin harfi, kompaniya doirasida unikal, keyin o'zgarmaydi */
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase().trim() : value,
  )
  @Matches(/^[A-Z]{2,5}$/, {
    message: validationMessage('validation.BRANCH_CODE_FORMAT'),
  })
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: validationMessage('validation.PHONE_FORMAT'),
  })
  phone?: string;

  @IsOptional()
  @IsDateString()
  openedAt?: string;
}
