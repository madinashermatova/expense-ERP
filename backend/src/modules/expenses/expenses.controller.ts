import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Paginated } from '../../common/dto/pagination.dto';
import { FileView, UploadedFileInput } from '../files/files.service';
import { uploadOptions } from '../files/upload.options';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesDto } from './dto/list-expenses.dto';
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

  /** Qoralamani (isbot majburiy bo'lgan kategoriya) tasdiqlash oqimiga uzatadi */
  @Post(':id/submit')
  submit(@Param('id', ParseUUIDPipe) id: string): Promise<ExpenseView> {
    return this.expenses.submit(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.expenses.remove(id);
  }
}
