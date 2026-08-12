import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Paginated } from '../../common/dto/pagination.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import {
  NotificationsService,
  NotificationView,
} from './notifications.service';

/**
 * TZ 3.11 — bildirishnomalar faqat **o'z egasiga** ko'rinadi: barcha so'rovlar
 * kontekstdagi `userId` bilan cheklanadi, id bo'yicha ham boshqa foydalanuvchining
 * yozuvini o'qilgan deb belgilab bo'lmaydi.
 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Query() query: ListNotificationsDto,
  ): Promise<Paginated<NotificationView>> {
    return this.notifications.list(query);
  }

  @Get('unread-count')
  unreadCount(): Promise<{ count: number }> {
    return this.notifications.unreadCount();
  }

  @Post('mark-all-read')
  markAllRead(): Promise<{ updated: number }> {
    return this.notifications.markAllRead();
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.notifications.markRead(id);
  }
}
