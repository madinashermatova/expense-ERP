import { Global, Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { StorageService } from './storage.service';

/**
 * Global: fayl biriktirish xarajatlar (S6) va qaytarishlar (S9) modullaridan chaqiriladi.
 */
@Global()
@Module({
  controllers: [FilesController],
  providers: [FilesService, StorageService],
  exports: [FilesService, StorageService],
})
export class FilesModule {}
