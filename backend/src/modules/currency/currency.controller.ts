import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Currency, RateSource, Role } from '../../generated/prisma/enums';
import { SETTING_KEYS, SettingsService } from '../settings/settings.service';
import { CurrencyService, RateView } from './currency.service';
import { CreateRateDto } from './dto/create-rate.dto';
import { ListRatesDto } from './dto/list-rates.dto';
import { SetCurrencyBaseDto } from './dto/set-base.dto';

@Controller('currency')
export class CurrencyController {
  constructor(
    private readonly currency: CurrencyService,
    private readonly settings: SettingsService,
  ) {}

  @Get('rates')
  list(@Query() query: ListRatesDto): Promise<RateView[]> {
    return this.currency.list(query);
  }

  /** Amaldagi kurs — xarajat formasida UZS ekvivalentini oldindan ko'rsatish uchun */
  @Get('rates/current')
  async current(@Query('currency') currency?: Currency): Promise<{
    currency: Currency;
    rate: string;
    source: RateSource;
    rateDate: string;
  }> {
    const target = currency ?? Currency.USD;
    const resolved = await this.currency.resolveRate(target, new Date());

    return {
      currency: target,
      rate: resolved.rate.toFixed(6),
      source: resolved.source,
      rateDate: resolved.rateDate.toISOString().slice(0, 10),
    };
  }

  @Roles(Role.ADMIN)
  @Post('rates')
  create(@Body() dto: CreateRateDto): Promise<RateView> {
    return this.currency.setManualRate(dto);
  }

  /** TZ 3.5 — hisob bazasini tanlash (barcha hisobot va konvertatsiyalarga ta'sir qiladi) */
  @Get('base')
  async getBase(): Promise<{ mode: RateSource }> {
    return { mode: await this.settings.currencyBase() };
  }

  @Roles(Role.ADMIN)
  @Post('base')
  async setBase(
    @Body() dto: SetCurrencyBaseDto,
  ): Promise<{ mode: RateSource }> {
    await this.settings.set(SETTING_KEYS.currencyBase, { mode: dto.mode });
    return { mode: dto.mode };
  }
}
