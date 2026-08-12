import { Global, Module } from '@nestjs/common';
import { CbuClient } from './cbu.client';
import { CurrencyController } from './currency.controller';
import { CurrencyCron } from './currency.cron';
import { CurrencyService } from './currency.service';

/** Global: xarajatlar (S6) va hisobotlar (S12) konvertatsiya uchun chaqiradi */
@Global()
@Module({
  controllers: [CurrencyController],
  providers: [CurrencyService, CbuClient, CurrencyCron],
  exports: [CurrencyService],
})
export class CurrencyModule {}
