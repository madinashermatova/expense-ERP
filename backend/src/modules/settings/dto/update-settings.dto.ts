import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Language, RateSource } from '../../../generated/prisma/enums';

/**
 * Kompaniya sozlamalari (TZ 3.15).
 *
 * DTO **tekis**: mijoz `{"reportPeriodStartDay": 25}` yuboradi, servis esa uni
 * `report.periodStartDay` kalitiga o'giradi. Xom `{ key, value }` shakli mijozga
 * kalit nomlarini ham, har birining ichki JSON tuzilishini ham biladigan qilib
 * qo'yardi — validatsiya esa serverda qolishi kerak.
 */
export class UpdateSettingsDto {
  /** Valyuta hisob bazasi: AUTO (CBU) yoki MANUAL (TZ 3.5) */
  @IsOptional()
  @IsEnum(RateSource)
  currencyBase?: RateSource;

  /** Hisobot davri boshlanish kuni, 1–28 (TZ 3.13) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  reportPeriodStartDay?: number;

  /** Javobsiz ariza eslatmasi, soat (TZ 3.7) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  approvalReminderHours?: number;

  /** Tasdiqlangandan keyin tahrirlash oynasi, soat (TZ 3.8) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  expenseEditWindowHours?: number;

  /** Kompaniyaning standart tili — yangi foydalanuvchi shu tilda boshlaydi */
  @IsOptional()
  @IsEnum(Language)
  defaultLanguage?: Language;

  /** Ish kunlari: 1 — dushanba … 7 — yakshanba */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map((day) => Number(day)) : value,
  )
  workDays?: number[];

  /** Bildirishnomalarni butun kompaniya bo'yicha o'chirish (TZ 3.11) */
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}
