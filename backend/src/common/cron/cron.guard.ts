/**
 * Testlarda rejalashtiruvchi o'chiriladi.
 *
 * `@Cron` ilova ko'tarilganda ro'yxatga olinadi va integratsion testlar davomida
 * soat boshi kelib qolsa o'z-o'zidan ishga tushadi: u paytda boshqa test faylining
 * ma'lumoti bazada bo'ladi va cron unga bildirishnoma yozib, testni tushunarsiz
 * ravishda yiqitadi. Cron mantig'ining o'zi testlarda `run()` ni **aniq chaqirib**
 * sinaladi, shuning uchun avtomatik ishga tushishini o'chirish qamrovni kamaytirmaydi.
 */
export function cronDisabled(): boolean {
  return process.env.DISABLE_CRON === 'true';
}
