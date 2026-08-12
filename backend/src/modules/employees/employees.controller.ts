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
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesDto } from './dto/list-employees.dto';
import { TransferEmployeeDto } from './dto/transfer-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import {
  EmployeesService,
  EmployeeView,
  EmployeeWithPassword,
} from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@Query() query: ListEmployeesDto): Promise<Paginated<EmployeeView>> {
    return this.employees.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<EmployeeView> {
    return this.employees.findOne(id);
  }

  @Get(':id/transfers')
  transfers(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.transferHistory(id);
  }

  /** DIRECTOR ham yarata oladi, lekin faqat o'z filialiga va WORKER roli bilan */
  @Roles(Role.ADMIN, Role.DIRECTOR)
  @Audit({
    action: 'employee.create',
    entityType: 'Employee',
    model: 'employee',
  })
  @Post()
  create(@Body() dto: CreateEmployeeDto): Promise<EmployeeWithPassword> {
    return this.employees.create(dto);
  }

  @Roles(Role.ADMIN, Role.DIRECTOR)
  @Audit({
    action: 'employee.update',
    entityType: 'Employee',
    model: 'employee',
  })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<EmployeeView> {
    return this.employees.update(id, dto);
  }

  /** Yangi parol bir marta qaytariladi va qayta ko'rsatilmaydi (TZ 3.3) */
  @Roles(Role.ADMIN, Role.DIRECTOR)
  @Audit({
    action: 'employee.resetPassword',
    entityType: 'Employee',
    idFrom: 'param',
  })
  @Post(':id/reset-password')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ tempPassword: string }> {
    return this.employees.resetPassword(id);
  }

  @Roles(Role.ADMIN)
  @Audit({
    action: 'employee.transfer',
    entityType: 'Employee',
    model: 'employee',
  })
  @Post(':id/transfer')
  transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferEmployeeDto,
  ): Promise<EmployeeView> {
    return this.employees.transfer(id, dto);
  }
}
