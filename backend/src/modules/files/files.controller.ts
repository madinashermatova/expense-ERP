import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /** TZ 4.2 — fayllarga kirish faqat vaqtinchalik signed URL orqali */
  @Get(':id/url')
  url(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    return this.files.getSignedUrl(id);
  }
}
