import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: string; db: string; time: string }> {
    let db = 'down';
    try {
      // Platforma darajasidagi tekshiruv — tenant konteksti talab qilinmaydi
      await this.prisma.raw.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      time: new Date().toISOString(),
    };
  }
}
