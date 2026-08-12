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
import { Audit } from '../../common/audit/audit.decorator';
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
  @Audit({ action: 'branch.create', entityType: 'Branch', model: 'branch' })
  @Post()
  create(@Body() dto: CreateBranchDto): Promise<BranchView> {
    return this.branches.create(dto);
  }

  @Roles(Role.ADMIN)
  @Audit({ action: 'branch.update', entityType: 'Branch', model: 'branch' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchView> {
    return this.branches.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Audit({ action: 'branch.archive', entityType: 'Branch', model: 'branch' })
  @Post(':id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string): Promise<BranchView> {
    return this.branches.archive(id);
  }

  @Roles(Role.ADMIN)
  @Audit({ action: 'branch.restore', entityType: 'Branch', model: 'branch' })
  @Post(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string): Promise<BranchView> {
    return this.branches.restore(id);
  }
}
