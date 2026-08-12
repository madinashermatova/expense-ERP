import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { ExportStatus, ExportType } from '../../../generated/prisma/enums';

export class ListExportsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ExportType)
  type?: ExportType;

  @IsOptional()
  @IsEnum(ExportStatus)
  status?: ExportStatus;
}
