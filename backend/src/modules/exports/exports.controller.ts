import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Paginated } from '../../common/dto/pagination.dto';
import { CreateExportDto } from './dto/create-export.dto';
import { ListExportsDto } from './dto/list-exports.dto';
import { EXPORT_CATALOG, ExportDefinition } from './export-catalog';
import {
  DownloadLink,
  ExportJobView,
  ExportsService,
} from './exports.service';

/**
 * Eksport endpointlari (TZ 3.13).
 *
 * `@Roles` ataylab qo'yilmagan: ruxsat **eksport turiga** bog'liq (E9 — faqat admin,
 * E1 — admin va direktor), shuning uchun tekshiruv servisda katalog bo'yicha bajariladi.
 */
@Controller('exports')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  /** Foydalanuvchi ko'ra oladigan eksport turlari — frontend ro'yxatni shu yerdan quradi */
  @Get('types')
  types(): ExportDefinition[] {
    return Object.values(EXPORT_CATALOG);
  }

  @Get()
  list(@Query() query: ListExportsDto): Promise<Paginated<ExportJobView>> {
    return this.exports.list(query);
  }

  /**
   * 202 emas, 201: ikkala rejimda ham yozuv yaratiladi, farq faqat `status` da
   * (`DONE` yoki `QUEUED`) — mijoz bitta javob shaklini kutadi.
   */
  @Post()
  create(@Body() dto: CreateExportDto): Promise<ExportJobView> {
    return this.exports.create(dto);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ExportJobView> {
    return this.exports.findOne(id);
  }

  @Get(':id/download')
  @HttpCode(200)
  download(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DownloadLink> {
    return this.exports.downloadLink(id);
  }
}
