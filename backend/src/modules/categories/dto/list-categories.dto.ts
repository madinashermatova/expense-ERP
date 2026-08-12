import { IsIn, IsOptional } from 'class-validator';

export class ListCategoriesDto {
  @IsOptional()
  @IsIn(['active', 'archived', 'all'])
  status?: 'active' | 'archived' | 'all' = 'active';
}
