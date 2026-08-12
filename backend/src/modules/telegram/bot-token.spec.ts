import { maskTokens } from './bot-launcher.service';
import { botIdFromToken, isValidBotToken } from './bot-directory.service';

const VALID = '8123456789:AAF0Ncnf5wuTOtVngbY9RvxneqTq4GiQ3l4';

/**
 * Token bilan ishlashning xavfsizlik qismi (TZ 4.2).
 *
 * Bu testlar aniq bir hodisadan keyin yozildi: `.env` ga tokenning faqat maxfiy
 * yarmi qo'yilganda `botId` shu maxfiy qiymatga aylandi va log ga chiqib ketdi.
 */
describe('Telegram bot tokeni', () => {
  it('to‘g‘ri shaklni qabul qiladi', () => {
    expect(isValidBotToken(VALID)).toBe(true);
    expect(isValidBotToken(` ${VALID} `)).toBe(true);
  });

  it('raqamli prefiksi yo‘q qiymatni rad etadi', () => {
    // Aynan shu holat log ga maxfiy qiymat chiqishiga olib kelgan
    expect(isValidBotToken('AAF0Ncnf5wuTOtVngbY9RvxneqTq4GiQ3l4')).toBe(false);
  });

  it('boshqa buzilgan shakllarni ham rad etadi', () => {
    expect(isValidBotToken('')).toBe(false);
    expect(isValidBotToken('123:short')).toBe(false);
    expect(isValidBotToken('abc:AAF0Ncnf5wuTOtVngbY9RvxneqTq4GiQ3l4')).toBe(
      false,
    );
    expect(isValidBotToken(VALID.replace(':', ''))).toBe(false);
  });

  it('botId sifatida faqat ochiq raqamli qismni beradi', () => {
    expect(botIdFromToken(VALID)).toBe('8123456789');
    expect(botIdFromToken(VALID)).not.toContain('AAF0');
  });

  it('log matnidan tokenni niqoblaydi', () => {
    const stack = `Error: 404\n  at fetch(https://api.telegram.org/bot${VALID}/getUpdates)`;

    const masked = maskTokens(stack);

    expect(masked).not.toContain('AAF0Ncnf5wuTOtVngbY9RvxneqTq4GiQ3l4');
    expect(masked).toContain('<token>');
    // Qolgan ma'lumot saqlanadi — xatoni tushunish uchun kerak
    expect(masked).toContain('getUpdates');
  });

  it('tokeni yo‘q matnni o‘zgartirmaydi', () => {
    const text = 'Bot ishga tushmadi: bot=8123456789 — 404: Not Found';

    expect(maskTokens(text)).toBe(text);
  });
});
