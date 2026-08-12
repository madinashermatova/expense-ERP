import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Paginated } from '../../common/dto/pagination.dto';
import { Role } from '../../generated/prisma/enums';
import { FileView, UploadedFileInput } from '../files/files.service';
import { uploadOptions } from '../files/upload.options';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesDto } from './dto/list-expenses.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import {
  CreateExpenseResult,
  ExpensesService,
  ExpenseView,
} from './expenses.service';

/**
 * Multer chegaralari ilova ko'tarilishida bir marta o'qiladi — dekorator qiymatlari
 * runtime da hisoblanadi, shuning uchun `ConfigService` bu yerda ishlamaydi.
 * Haqiqiy tekshiruv baribir `FilesService.validate()` da (magic-byte).
 */
const MAX_FILE_MB = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB ?? 10);
const MAX_FILES = Number(process.env.UPLOAD_MAX_FILES_PER_EXPENSE ?? 5);

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(@Query() query: ListExpensesDto): Promise<Paginated<ExpenseView>> {
    return this.expenses.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ExpenseView> {
    return this.expenses.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateExpenseDto): Promise<CreateExpenseResult> {
    return this.expenses.create(dto);
  }

  /** TZ 3.8 — tasdiqlangandan keyin 24 soat ichida, sabab majburiy */
  @Roles(Role.ADMIN, Role.DIRECTOR)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ): Promise<ExpenseView> {
    return this.expenses.update(id, dto);
  }

  @Post(':id/files')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, uploadOptions(MAX_FILE_MB, MAX_FILES)),
  )
  attachFiles(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: UploadedFileInput[],
  ): Promise<FileView[]> {
    return this.expenses.attachFiles(id, files ?? []);
  }

  @Delete(':id/files/:fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<void> {
    return this.expenses.removeFile(id, fileId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.expenses.remove(id);
  }
}
