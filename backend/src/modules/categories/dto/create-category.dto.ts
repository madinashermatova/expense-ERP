import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
  /** Ikki darajali ierarxiya: bosh kategoriya → ichki kategoriya (TZ 3.4) */
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nameUz!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nameRu!: string;

  @IsOptional()
  @IsBoolean()
  receiptRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  commentRequired?: boolean;

  /** Bir martalik maksimal summa; null = cheklovsiz */
  @IsOptional()
  @IsNumberString({ no_symbols: false })
  maxAmountPerEntry?: string | null;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  sortOrder?: number;
}
