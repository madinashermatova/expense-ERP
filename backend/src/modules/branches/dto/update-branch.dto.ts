import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateBranchDto } from './create-branch.dto';

/** `code` ataylab yo'q — filial kodi o'zgarmas (TZ 3.6) */
export class UpdateBranchDto extends PartialType(
  OmitType(CreateBranchDto, ['code'] as const),
) {}
