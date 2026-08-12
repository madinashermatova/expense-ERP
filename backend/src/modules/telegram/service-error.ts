/**
 * Servis xatosidan foydalanuvchiga ko'rsatiladigan matnni ajratadi.
 *
 * Nest `HttpException` xabarni `response` ichida saqlaydi (bizda `{ statusCode, code,
 * message, details }` shakli). Botga faqat `message` chiqadi: kod va tafsilotlar
 * foydalanuvchiga hech narsa demaydi, stack esa umuman chiqmasligi kerak.
 */
export function extractServiceMessage(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;

  const response = (error as { response?: unknown }).response;
  if (typeof response === 'object' && response !== null) {
    const message = (response as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : null;
}
