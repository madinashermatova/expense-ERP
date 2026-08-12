/**
 * `@nestjs/swagger` plugini ts-jest uchun o'ram.
 *
 * Plugin `nest build` da kompilyatsiya paytida ishlaydi va DTO klasslariga
 * `@ApiProperty` metadatasini qo'yadi. ts-jest esa transformerdan `name`,
 * `version` va `factory` eksportlarini kutadi — plugin `before` beradi, shu
 * sababli kichik o'ram kerak.
 *
 * Maqsad bitta: hujjat testi **prod bilan bir xil** sharoitda ishlasin. Aks holda
 * testda DTO sxemalari bo'sh chiqadi va plugin sozlamasi buzilganini hech narsa
 * ushlamaydi.
 *
 * Fayl ataylab `.js`: ts-jest TypeScript transformerini yuklash uchun `esbuild`
 * talab qiladi, bu esa faqat shu o'ram uchun yangi bog'liqlik bo'lardi.
 */
const { before } = require('@nestjs/swagger/plugin');

const OPTIONS = {
  classValidatorShim: true,
  introspectComments: true,
  dtoFileNameSuffix: ['.dto.ts'],
};

module.exports.name = 'nestjs-swagger-plugin';
module.exports.version = 1;
module.exports.factory = (compilerInstance) =>
  before(OPTIONS, compilerInstance.program);
