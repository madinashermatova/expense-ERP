import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/enums';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService, SettingsView } from './settings.service';

/** TZ 3.15 — sozlamalarni faqat bosh admin ko'radi va o'zgartiradi (direktor → 403) */
@Roles(Role.ADMIN)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(): Promise<SettingsView> {
    return this.settings.view();
  }

  /**
   * Yangi qiymat darhol kuchga kiradi: `SettingsService.set` har kalit uchun keshni
   * bo'shatadi, ya'ni keyingi o'qish bazadan keladi.
   */
  @Patch()
  update(@Body() dto: UpdateSettingsDto): Promise<SettingsView> {
    return this.settings.update(dto);
  }
}
