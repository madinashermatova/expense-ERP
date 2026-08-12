import { IsBooleanString, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListNotificationsDto extends PaginationQueryDto {
  /** `false` — faqat o'qilmaganlar (badge ro'yxati) */
  @IsOptional()
  @IsBooleanString()
  isRead?: string;

  @IsOptional()
  @IsString()
  type?: string;
}
