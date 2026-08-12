import {
  Body,
  Controller,
  Get,
  Param,
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
import { UploadedFileInput } from '../files/files.service';
import { uploadOptions } from '../files/upload.options';
import {
  ApproveRefundDto,
  CreateRefundDto,
  ListRefundsDto,
  RejectRefundDto,
} from './dto/refund.dto';
import { RefundsService, RefundView } from './refunds.service';

const MAX_FILE_MB = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB ?? 10);
const MAX_FILES = Number(process.env.UPLOAD_MAX_FILES_PER_EXPENSE ?? 5);

/** TZ 3.9 — qaytarish moduli */
@Controller('refunds')
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Get()
  list(@Query() query: ListRefundsDto): Promise<Paginated<RefundView>> {
    return this.refunds.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RefundView> {
    return this.refunds.findOne(id);
  }

  /**
   * `multipart/form-data`: `expenseId`, `amount`, `reason` va `files`.
   * Isbot fayli majburiy bo'lgani uchun so'rov va fayl bitta chaqiruvda keladi.
   */
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, uploadOptions(MAX_FILE_MB, MAX_FILES)),
  )
  create(
    @Body() dto: CreateRefundDto,
    @UploadedFiles() files: UploadedFileInput[],
  ): Promise<RefundView> {
    return this.refunds.create(dto, files ?? []);
  }

  @Roles(Role.ADMIN, Role.DIRECTOR)
  @Post(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveRefundDto,
  ): Promise<RefundView> {
    return this.refunds.approve(id, dto.version);
  }

  @Roles(Role.ADMIN, Role.DIRECTOR)
  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRefundDto,
  ): Promise<RefundView> {
    return this.refunds.reject(id, dto.reason, dto.version);
  }
}
