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
import { Paginated } from '../../common/dto/pagination.dto';
import { Role } from '../../generated/prisma/enums';
import { BudgetsService, BudgetUsageView, BudgetView } from './budgets.service';
import {
  BudgetUsageDto,
  CreateBudgetDto,
  ListBudgetsDto,
  UpdateBudgetDto,
} from './dto/budget.dto';

/** TZ 3.10 — limit belgilash huquqi faqat bosh super adminda */
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  /**
   * Joriy davrdagi sarf va foiz — ro'yxatlardagi ⚠️ belgilari uchun.
   * Direktor ham ko'radi: o'z filialining limitini bilishi kerak.
   */
  @Get('usage')
  usage(@Query() query: BudgetUsageDto): Promise<BudgetUsageView[]> {
    return this.budgets.usage(query);
  }

  @Get()
  list(@Query() query: ListBudgetsDto): Promise<Paginated<BudgetView>> {
    return this.budgets.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<BudgetView> {
    return this.budgets.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateBudgetDto): Promise<BudgetView> {
    return this.budgets.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBudgetDto,
  ): Promise<BudgetView> {
    return this.budgets.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.budgets.remove(id);
  }
}
