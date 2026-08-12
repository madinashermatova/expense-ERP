import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Paginated } from '../../common/dto/pagination.dto';
import { Role } from '../../generated/prisma/enums';
import { BranchesService, BranchView } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { ListBranchesDto } from './dto/list-branches.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  /** Direktor ham ko'radi, lekin faqat o'z filialini (servis darajasida cheklanadi) */
  @Get()
  list(@Query() query: ListBranchesDto): Promise<Paginated<BranchView>> {
    return this.branches.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<BranchView> {
    return this.branches.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateBranchDto): Promise<BranchView> {
    return this.branches.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchView> {
    return this.branches.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Post(':id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string): Promise<BranchView> {
    return this.branches.archive(id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string): Promise<BranchView> {
    return this.branches.restore(id);
  }
}
