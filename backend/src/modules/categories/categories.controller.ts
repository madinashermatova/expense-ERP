import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Audit } from '../../common/audit/audit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/enums';
import { CategoriesService, CategoryView } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesDto } from './dto/list-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** Daraxt: bosh kategoriyalar + children (TZ 3.4) */
  @Get()
  tree(@Query() query: ListCategoriesDto): Promise<CategoryView[]> {
    return this.categories.tree(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CategoryView> {
    return this.categories.findOne(id);
  }

  /**
   * Standart kategoriya daraxtini yuklaydi (TZ 3.4).
   *
   * Yangi kompaniya uchun: ro'yxat bo'sh bo'lsa tayyor to'plam yaratiladi, keyin
   * admin uni tahrirlaydi. Ro'yxat bo'sh bo'lmasa hech narsa o'zgarmaydi —
   * `{ created: 0 }` qaytadi.
   */
  @Roles(Role.ADMIN)
  @Audit({ action: 'category.apply_defaults', entityType: 'Category' })
  @Post('apply-defaults')
  applyDefaults(): Promise<{ created: number }> {
    return this.categories.applyDefaults();
  }

  @Roles(Role.ADMIN)
  @Audit({
    action: 'category.create',
    entityType: 'Category',
    model: 'category',
  })
  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<CategoryView> {
    return this.categories.create(dto);
  }

  @Roles(Role.ADMIN)
  @Audit({
    action: 'category.update',
    entityType: 'Category',
    model: 'category',
  })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryView> {
    return this.categories.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Audit({
    action: 'category.archive',
    entityType: 'Category',
    model: 'category',
  })
  @Post(':id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string): Promise<CategoryView> {
    return this.categories.archive(id);
  }

  @Roles(Role.ADMIN)
  @Audit({
    action: 'category.restore',
    entityType: 'Category',
    model: 'category',
  })
  @Post(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string): Promise<CategoryView> {
    return this.categories.restore(id);
  }

  @Roles(Role.ADMIN)
  @Audit({ action: 'category.delete', entityType: 'Category', idFrom: 'param' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(id);
  }
}
