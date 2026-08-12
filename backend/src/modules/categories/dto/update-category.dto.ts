import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';

/** `parentId` ataylab yo'q — daraja o'zgartirish mavjud xarajatlarni chalkashtiradi */
export class UpdateCategoryDto extends PartialType(
  OmitType(CreateCategoryDto, ['parentId'] as const),
) {}
