import { BullModule } from '@nestjs/bullmq';
import { Global, Module, Provider } from '@nestjs/common';
import { NOTIFICATION_QUEUE } from './notification-queue';
import { NotificationTextService } from './notification-messages';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';
import { TelegramSenderService } from './telegram-sender.service';

/**
 * Testlarda **worker** ro'yxatga olinmaydi.
 *
 * BullMQ worker Redis ga blokli ulanish ochadi (`BRPOPLPUSH`) va uni har test faylida
 * ko'tarish Jest ning jarayondan chiqishiga to'sqinlik qiladi. Navbatga job qo'shish
 * baribir ishlaydi — ya'ni "job soni +1" mezoni tekshiriladi (TZ 3.11) — processor
 * mantig'i esa `process()` ni aniq chaqirib sinaladi, cron bilan bir xil yondashuv.
 */
function workerProviders(): Provider[] {
  return process.env.DISABLE_QUEUE_WORKER === 'true'
    ? []
    : [NotificationsProcessor];
}

/** Global: barcha modullar bildirishnoma yozadi */
@Global()
@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATION_QUEUE })],
  controllers: [NotificationsController],
  providers: [
    NotificationTextService,
    NotificationsService,
    TelegramSenderService,
    ...workerProviders(),
  ],
  exports: [
    NotificationsService,
    NotificationTextService,
    TelegramSenderService,
  ],
})
export class NotificationsModule {}
