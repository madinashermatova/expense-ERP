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

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<CategoryView> {
    return this.categories.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryView> {
    return this.categories.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Post(':id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string): Promise<CategoryView> {
    return this.categories.archive(id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string): Promise<CategoryView> {
    return this.categories.restore(id);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(id);
  }
}
