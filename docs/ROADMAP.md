# Ishlar rejasi (Roadmap)

Manba: [`TZ.md`](TZ.md). Har bir bosqich oxirida: `typecheck` + `lint` + testlar yashil →
commit → `git push`. Bosqichlar ketma-ket, chunki har biri oldingisiga tayanadi.

Belgilar: ✅ tugadi · 🔄 jarayonda · ⬜ boshlanmagan

---

## S0 — Poydevor ✅

**Nima:** monorepo skeleti, `docker-compose` (postgres, postgres-test, redis, minio),
NestJS 11 skaffold, Prisma 7 schema (28 model, 19 enum), init + business_constraints
migratsiyalari, `.env` / `.env.example`.

**Natija:** `docker compose up -d` → 4 servis healthy; `prisma migrate dev` o'tadi;
`tsc --noEmit` toza.

**Commit:** `chore: repo skeleton…` + `feat(backend): NestJS skaffold, Prisma schema…`

---

## S1 — Tenancy qatlami ✅ (TZ 3.16.1)

**Nima quriladi:**
- `TenantContext` — `AsyncLocalStorage` da `{ companyId, userId, role, branchId, channel }`
- `TenantMiddleware` — JWT `companyId` claim yoki bot `activeLinkId` dan kontekstni to'ldiradi
- **Prisma client extension** — barcha `find*` / `update*` / `delete*` / `count` / `aggregate`
  so'rovlariga avtomatik `WHERE companyId = ctx.companyId`, `create` da avtomatik to'ldirish
- Allow-list: `Company`, `Plan`, `TelegramSession`, `TelegramLoginAttempt` — extension ularga tegmaydi
- Kontekstsiz biznes so'rov → `TenantContextMissingError` (hech qachon "hammasini qaytarish" emas)
- `PrismaService` + `PrismaModule`, graceful shutdown
- Integratsion test harness: `test/jest-int.json`, testcontainer o'rniga 5443 dagi test DB,
  har test faylidan oldin `migrate deploy` + truncate

**Qabul mezoni:** extension o'chirilganda `test:tenancy` **yiqiladi**; ikki kompaniya
seed qilinganda A ning admini B ning yozuvini `findUnique` bilan ololmaydi.

**Natija:** `test:tenancy` — 17/17 yashil, `lint` va `typecheck` toza, `GET /api/health` ishlaydi.

**S1 da yuzaga chiqqan texnik nozikliklar:**
- Prisma 7 Rust engine siz ishlaydi → `@prisma/adapter-pg` (node-postgres driver adapter) qo'shildi
- Prisma promise **lazy** — so'rov `.then` chaqirilganda boshlanadi. Shu sababli
  `AsyncLocalStorage` ichida `await` majburiy; `runAsync()` / `runUnscoped()` shuni kafolatlaydi
- Unique operatsiyalarga (`findUnique`, `update`, `delete`, `upsert`) `AND` qo'shib bo'lmaydi —
  ular uchun `companyId` `where` ning yuqori darajasiga qo'shiladi (extended where unique)
- Prisma 7 generated kodi `.js` kengaytmali import ishlatadi → jest `moduleNameMapper`
  va `NODE_OPTIONS=--experimental-vm-modules`

**Commit:** `feat(tenancy): AsyncLocalStorage konteksti va Prisma tenant extension`

---

## S2 — Auth + RBAC + seed ✅ (TZ 3.1, 3.16.3)

**Nima quriladi:**
- `argon2id` hash servisi, parol generatori
- `POST /auth/login` — email yoki username; 5 urinish → 15 daq blok (`failedLoginCount`, `lockedUntil`)
- JWT access (15 daq) + refresh (7 kun) httpOnly cookie da, **rotatsiya** (`RefreshToken.tokenHash`)
- `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
- `JwtAuthGuard` (global), `@Roles()` + `RolesGuard`, `@Public()`
- `BranchScopeGuard` — DIRECTOR faqat `branchId` doirasida
- WORKER Web ERP ga 403; `Company.status = SUSPENDED` → login bloklanadi
- Throttler: auth 5 req/min, global 100 req/min
- **Seed:** 2 kompaniya × (2 ADMIN, 2 filial kodi bilan, 2 DIRECTOR, 5 WORKER),
  kategoriyalar daraxti, boshlang'ich kurs, `DEFAULT` tarif, 1 ta `PLATFORM_OWNER`

**Qabul mezoni:** WORKER `/api/expenses` → 403; 6-urinish → 429 + `Retry-After`;
`password_hash` `$argon2id$` bilan boshlanadi; A filial direktori B filialni so'rasa 404.

**Natija:** `test:int` — 36/36 yashil (tenancy 17 + auth 18 + throttle 1).

**S2 da qabul qilingan qarorlar:**
- **`MULTIPLE_COMPANIES` (409)** — bir xil login bir nechta kompaniyada topilsa, frontend
  kompaniya tanlab `companySlug` bilan qayta yuboradi. TZ bu holatni web login uchun
  aniqlamagan edi (`UNIQUE(companyId, email)` — email global unikal emas).
- **Refresh reuse detection** — bekor qilingan refresh token qayta ishlatilsa,
  foydalanuvchining **barcha** sessiyalari yopiladi (token o'g'irlanishiga qarshi).
- Refresh token bazada **SHA-256 hash** ko'rinishida, ochiq matnda emas.
- `JwtStrategy` har so'rovda foydalanuvchi holatini tekshiradi — bloklangan xodim yoki
  to'xtatilgan kompaniya amaldagi token bilan ham kira olmaydi.
- Testlarda rate limiting `ThrottlerModule.skipIf` orqali o'chiriladi
  (`@Throttle` dekoratori guard override ga bo'ysunmaydi); throttler alohida faylda sinaladi.

**Commit:** `feat(auth): JWT + argon2 + RBAC guardlar, seed skripti`

---

## S3 — Filiallar, Xodimlar, Kategoriyalar ✅ (TZ 3.2, 3.3, 3.4, 3.16.4)

**Nima quriladi:**
- `branches` CRUD + arxivlash, `code` immutable, `?status=` filtri
- `employees` CRUD + `User` avtomatik yaratish + boshlang'ich parol (bir marta ko'rsatiladi)
- `POST /employees/:id/reset-password` → barcha `TelegramAccountLink` revoke
- `POST /employees/:id/transfer` + `EmployeeTransfer` tarixi
- `categories` — 2 darajali daraxt, `receiptRequired` / `commentRequired` / `maxAmountPerEntry`,
  arxivlash (ishlatilgan bo'lsa o'chirilmaydi → 409)
- **`PlanLimitService`** — `assertCanCreateBranch()` / `assertCanCreateEmployee()`;
  `null` = cheksiz, oshsa `403 PLAN_LIMIT_EXCEEDED`

**Qabul mezoni:** direktor `role=ADMIN` bilan xodim yaratsa 403; mavjud telefon → 409;
`maxBranches=3` test tarifida 4-chi filial 403.

**Natija:** `test:int` — 84/84 yashil (yangi: filiallar 17, xodimlar 21, kategoriyalar 9).

**S3 da qabul qilingan qarorlar:**
- **`BranchScopeService`** — filial doirasi ataylab Prisma extension da emas, servis
  qatlamida. Tenant izolyatsiyasi absolyut qoida, filial doirasi esa biznes qoidasi
  (admin uchun cheklov yo'q, ba'zi hisobotlarda ataylab kengroq bo'ladi).
  O'qishda boshqa filial → **404** (mavjudligini oshkor qilmaslik), yozishda → **403**.
- Filial va kategoriya `restore` (arxivdan tiklash) qo'shildi — TZ da yo'q edi, lekin
  arxivlash qaytarilmas bo'lishi mantiqsiz.
- Bosh kategoriya arxivlanganda ichkilari ham arxivlanadi (kaskad).
- Kategoriya `DELETE` faqat **ishlatilmagan va bolasiz** bo'lsa; aks holda 409 → arxivlash.
- Xodim nofaol qilinganda `User.isActive=false` **va** Telegram bog'lanishlari bekor qilinadi.
- Parol tiklanganda web sessiyalar (`RefreshToken`) ham yopiladi — TZ faqat Telegram
  bog'lanishlarini aytgan edi, lekin web sessiyani ochiq qoldirish xavfsizlik teshigi.
- Xato formatida **payload dagi `statusCode` ustun** — servis `BadRequestException` ichida
  `statusCode: 422` bersa, HTTP javob ham 422 bo'ladi (TZ ko'p joyda aynan 422 talab qiladi).

**Commit:** `feat(org): filiallar, xodimlar, kategoriyalar + tarif limit hooklari`

---

## S4 — Fayl saqlash ✅ (TZ 4.2, 3.6)

**Nima quriladi:**
- `StorageService` (S3/MinIO), kalit formati `{companyId}/expenses/{id}/{uuid}.{ext}`
- MIME + kengaytma tekshiruvi (jpg/png/webp/pdf), ≤10 MB, ≤5 fayl
- `GET /files/:id/url` → signed URL (TTL 15 daq), cross-tenant so'rov → 403
- Multipart upload interceptor + magic-byte tekshiruvi (faqat Content-Type ga ishonmaydi)

**Qabul mezoni:** 6-fayl → 422; 11 MB → 413; boshqa kompaniya fayliga signed URL → 403.

**Natija:** 13 unit + 14 integratsion test (jami 98 int + 13 unit), hammasi yashil.
Signed URL testlari real MinIO ga qarshi ishlaydi.

**S4 da qabul qilingan qarorlar:**
- **Magic-byte tekshiruvi qo'lda yozildi** (`file-type.util.ts`), tashqi kutubxonasiz:
  bizga aynan 4 ta format kerak, ularning imzolari barqaror, va `file-type` v22 ESM-only
  bo'lgani uchun CommonJS/jest bilan muammo tug'dirardi.
- Fayl kengaytmasi **foydalanuvchi nomidan emas**, aniqlangan MIME dan olinadi —
  `chek.png` deb yuborilgan PDF storage da `.pdf` bo'lib saqlanadi.
- Cross-tenant himoya **ikki qatlamli**: Prisma extension yozuvni topmaydi, ustiga
  kalitning `{companyId}/` prefiksi tekshiriladi (baza bog'lanishi buzilgan holat uchun).
- Boshqa kompaniya fayliga so'rov **404** (TZ da 403 yozilgan) — mavjudligini oshkor
  qilmaslik izchilroq va qolgan endpointlar bilan bir xil.
- `memoryStorage` — fayl diskka tushmaydi, vaqtinchalik fayllarni tozalash muammosi yo'q.

**Commit:** `feat(files): MinIO storage, signed URL, MIME validatsiya`

---

## S5 — Valyuta va kurslar ✅ (TZ 3.5)

**Nima quriladi:**
- `CurrencyService` — sanaga amaldagi kursni topish, `AUTO`/`MANUAL` baza tanlovi
- CBU cron (09:00 Asia/Tashkent), xato bo'lsa oxirgi kurs + admin ga bildirishnoma
- `POST /currency/rates` (qo'lda), `GET /currency/rates`
- `MANUAL` rejimda kurs yo'q bo'lsa USD xarajat → 422

**Qabul mezoni:** CBU 500 qaytarsa cron yiqilmaydi; kurs keyin o'zgarsa eski xarajat
UZS ekvivalenti o'zgarmaydi.

**Natija:** 145 test yashil (121 integratsion + 24 unit). Yangi: valyuta 21, pul arifmetikasi 11.

**S5 da qabul qilingan qarorlar:**
- **`Money` yordamchisi** (`Decimal` ustida) — barcha pul hisob-kitobi shu yerda.
  `number` umuman ishlatilmaydi: 0.1 + 0.2 ≠ 0.3 muammosi moliyaviy tizimda yo'l qo'yilmaydi.
  `splitEqually()` ham shu yerda — S6 dagi taqsimlash uchun oldindan yozildi va
  "yig'indi har doim asl summaga teng" xossasi 5 xil kirish bilan tekshirilgan.
- **Aniq sanaga kurs bo'lmasa — oldingi eng yaqin kurs** ishlatiladi (dam olish kunlari,
  bayramlar). TZ buni aytmagan, lekin aks holda shanba kunlik xarajat kiritib bo'lmasdi.
  Kelajakdagi kurs hech qachon ishlatilmaydi.
- **`MANUAL` rejim `AUTO` kursiga tushib ketmaydi** — sozlama qat'iy: MANUAL tanlangan
  bo'lsa faqat qo'lda kiritilgan kurslar ko'riladi, aks holda 422 (TZ qabul mezoni).
- Cron **har kompaniya uchun alohida** yozadi va bittasidagi xatolik qolganlarini to'xtatmaydi.
- CBU javob bermaganda `Notification` yozuvi yaratiladi (Web kanali) — S11 da BullMQ va
  Telegram shu servis ustiga qo'shiladi, chaqiruvchi kod o'zgarmaydi.
- `SettingsService` va `NotificationsService` ning kerakli qismi shu bosqichda yozildi
  (to'liq CRUD S15/S11 da) — valyuta ularsiz ishlay olmaydi.

**Commit:** `feat(currency): CBU cron, qo'lda kurs, snapshot mantiqi`

---

## S6 — Xarajatlar yadrosi ✅ (TZ 3.6)

**Nima quriladi:**
- `NumberingService` — `NumberSequence` ustida atomik ketma-ketlik, `EXP-000123` va `CHL-2026-0045`
- `POST /expenses` — validatsiya (musbat summa, kelajak sanasi yo'q, kategoriya qoidalari),
  kurs snapshot, taqsimlash (teng / qo'lda), tiyin qoldig'i birinchi xodimga
- `GET /expenses` — filtr, qidiruv (ikkala raqam), saralash, pagination
- `GET /expenses/:id`, `DELETE /expenses/:id` (soft delete + audit)
- `POST /expenses/:id/files`, `DELETE /expenses/:id/files/:fileId`, `POST /expenses/:id/submit`
- Dublikat ogohlantirish (10 daq oynasi, bloklamaydi)
- `AuditService` — append-only jurnalga yozish qismi (o'qish va interceptor S14 da)

**Qabul mezoni:** 100 ta parallel yaratishda raqam dublikat yo'q; `100000/3` →
`33333.34 + 33333.33 + 33333.33`; 10 000 yozuvda ro'yxat ≤ 2 s.

**Natija:** `test:int` — 145/145 yashil (yangi: xarajatlar 24), `test:unit` — 24/24.
100 ta parallel yaratish ~1.7 s, 10 000 yozuvli ro'yxat sahifasi < 2 s.

**S6 da qabul qilingan qarorlar:**
- **Advisory lock, `SELECT … FOR UPDATE` emas.** TZ ikkinchisini taklif qilgan, lekin
  ketma-ketlik qatori **hali mavjud bo'lmagan** paytdagi poyga (filialning birinchi
  xarajati) qator qulfi bilan yopilmaydi. `pg_advisory_xact_lock(hashtext(kalit))`
  kalitning o'zini qulflaydi, tranzaksiya tugaganda avtomatik bo'shaydi va rollback da
  osilib qolmaydi. Qulflar har doim bir tartibda olinadi (global → filial) — deadlock yo'q.
  Dublikatga qarshi oxirgi mudofaa baribir DB da: `@@unique([companyId, globalNumber])`
  va `@@unique([companyId, branchId, branchSeqYear, branchSeq])`.
- **`receiptRequired` kategoriyada yozuv `DRAFT` da tug'iladi.** Fayl JSON tanasi bilan
  birga kela olmaydi, shuning uchun chek yuklangandan keyin `POST /expenses/:id/submit`
  uni `DIRECTOR_PENDING` ga o'tkazadi. Raqamlar baribir yaratilishda beriladi — TZ ularni
  "yaratilganda" talab qiladi. `DRAFT` status enum da allaqachon bor edi.
- **Xodim tanlangan filialga tegishli bo'lishi shart** (422 `EMPLOYEE_WRONG_BRANCH`) —
  aks holda ulush boshqa filial hisobotiga oqib ketardi. TZ buni aniq aytmagan.
- **Ulush UZS ekvivalenti ham snapshot kursida** hisoblanadi — xarajat va uning ulushlari
  bir xil kursga tayanadi, aks holda `SUM(shares.amountUzs) ≠ expense.amountUzs` bo'lardi.
- **Ro'yxatda ulushlar xodim ismi bo'yicha tartiblangan** — Postgres aks holda ixtiyoriy
  tartib qaytaradi va javob bir xil so'rovda ham har xil bo'lardi.
- **Tasdiqlangan xarajat o'chirilmaydi** (409 `EXPENSE_NOT_DELETABLE`) — u moliyaviy
  tarixning bir qismi; buning o'rniga bekor qilish (S7) yoki qaytarish (S9).
- **Saralash faqat allow-list ustunlari bo'yicha** — `sort` foydalanuvchi matni, ixtiyoriy
  qiymat Prisma `orderBy` ga tushmasligi kerak.

**Commit:** `feat(expenses): yadro CRUD, ikki xil raqamlash, taqsimlash mantiqi`

---

## S7 — Tasdiqlash oqimi ✅ (TZ 3.7)

**Nima quriladi:**
- Status mashinasi (`expense-status.ts` — o'tishlar jadvali, noto'g'ri o'tish → 422)
- `approve` / `reject` / `request-fix` / `cancel` / `submit` + `ExpenseStatusHistory`
- Direktor o'zinikini tasdiqlay olmaydi → to'g'ridan-to'g'ri `ADMIN_PENDING`
- **Four-eyes:** admin o'zinikini tasdiqlay olmaydi; yagona faol admin bo'lsa `selfApproved=true`
- Optimistik blokirovka (`version`) → ikkinchi admin ga 409
- `POST /expenses/bulk-approve` — 20 tagacha, qisman muvaffaqiyat hisoboti
- Javobsiz ariza eslatmasi (soatlik cron; BullMQ transporti S11 da)

**Qabul mezoni:** direktor tasdiqlagach `ADMIN_PENDING`; 5 belgili sabab → 422;
ikki admin bir vaqtda → biri 409.

**Natija:** `test:int` — 164/164 yashil (yangi: tasdiqlash 19), `test:unit` — 31/31
(yangi: status mashinasi 7).

**S7 da qabul qilingan qarorlar:**
- **O'tishlar bitta jadvalda** (`TRANSITIONS`): har bir o'tish uchun manba status, amal,
  natija, ruxsat etilgan rollar, sabab majburiyligi va "faqat kiritgan shaxs" bayrog'i.
  Yangi status qo'shilganda o'zgartiriladigan joy bitta va uni unit test qamrab oladi
  (yakuniy statuslardan o'tish yo'qligi, 2-bosqich faqat adminda, va h.k.).
- **Bulk har bir arizani o'z tranzaksiyasida** qayta ishlaydi. TZ "bitta tranzaksiyada"
  deydi, lekin ayni paytda "bittasi xato bersa boshqalari o'tadi" ni ham talab qiladi —
  bu ikkisi bir vaqtda bo'lolmaydi. Qisman muvaffaqiyat tanlandi, chunki qabul mezoni
  aynan hisobotni talab qiladi.
- **Optimistik blokirovka `WHERE version = ? AND status = ?`** bilan `updateMany` orqali:
  `version` ni mijoz yubormasa ham server o'qigan qiymat ishlatiladi, ya'ni ikkinchi
  tasdiqlovchi baribir 409 oladi. Faqat `version` ga tayanish mijozga bog'liq bo'lardi.
- **`NEEDS_FIX` dan qaytgan direktor arizasi ham `ADMIN_PENDING` ga tushadi** — aks holda
  tuzatish so'rovi orqali direktor o'z arizasini o'z navbatiga qaytarib olardi.
- **`submit` va `request-fix` oldingi bosqich qarorlarini tozalaydi**
  (`directorApprovedByUserId`, `adminApprovedByUserId`, `approvedAt` → `null`) — oqim
  1-bosqichdan boshlanadi, eski "kim tasdiqlagan" yozuvi chalg'itmasligi kerak.
  To'liq tarix `expense_status_history` da qoladi.
- **`cancel` TZ da faqat ishchi uchun aytilgan**, lekin Web da ham kiritgan shaxs o'z
  arizasini bekor qila olishi kerak — shuning uchun qoida "kiritgan shaxs" ga bog'landi,
  rolga emas.
- **Eslatma takrorlanmasligi mavjud `APPROVAL_REMINDER` bildirishnomalari bo'yicha**
  tekshiriladi — sxemaga faqat shu funksiya uchun `reminderSentAt` maydoni qo'shilmadi.
  Tekshiruv raw so'rov bilan (`payload->>'expenseId' = ANY(...)`), chunki Prisma ning
  JSON filtri `path` bo'yicha `in` ni qo'llab-quvvatlamaydi.

**Commit:** `feat(approvals): ikki bosqichli tasdiqlash, four-eyes, optimistik lock`

---

## S8 — Tahrirlash + EditRequest ✅ (TZ 3.8)

**Nima:** `PATCH /expenses/:id` 24 soat oynasi + majburiy sabab + audit `old→new`;
`edit-requests` CRUD (bot: WORKER yaratadi, direktor apply/reject).

**Natija:** `test:int` — 180/180 yashil (yangi: tahrirlash va murojaatlar 16),
`test:unit` — 31/31.

**S8 da qabul qilingan qarorlar:**
- **Tahrirlash oynasi statusga bog'liq:** qaror chiqmagan yozuvlar (`DRAFT`,
  `DIRECTOR_PENDING`, `NEEDS_FIX`) oynasiz tahrirlanadi, `APPROVED` esa `approvedAt`
  dan `expense.editWindowHours` ichida. TZ faqat `APPROVED` holatini aytgan, lekin
  hali tasdiqlanmagan yozuvni tahrirlab bo'lmasligi mantiqsiz bo'lardi.
- **`ADMIN_PENDING` ataylab tahrirlanmaydi.** Direktor qarori allaqachon chiqqan va
  uni jimgina o'zgartirish tasdiqlashning ma'nosini yo'qotardi — buning uchun
  `request-fix` bor. Bu TZ da yo'q, lekin four-eyes mantig'ining tabiiy davomi.
- **Kurs snapshot i faqat kirish ma'lumoti o'zgarganda qayta hisoblanadi:** valyuta
  yoki sana tuzatilsa asl snapshot noto'g'ri kirishga tayangan edi, shuning uchun
  qayta olinadi. Faqat summa o'zgarsa eski kurs saqlanadi (TZ 3.5 tarixiy kursni
  muzlatadi).
- **`AMOUNT_BELOW_REFUNDED`** — summani qaytarilgan miqdordan pastga tushirib bo'lmaydi.
  DB da `refundedAmount <= amount` check constraint i bor, lekin 500 o'rniga tushunarli
  422 qaytarish kerak.
- **Tahrir `expense_status_history` ga ham yoziladi** (status o'zgarmagan yozuv, sabab
  bilan) — kartochkadagi yagona xronologiyada tahrir ham ko'rinadi, audit jurnalini
  ochish shart emas.
- **Bitta xarajat bo'yicha bir vaqtda bitta ochiq murojaat** (409 `EDIT_REQUEST_PENDING`) —
  aks holda direktor navbatida bir xil so'rovning nusxalari yig'ilib qolardi.
- **`apply` ixtiyoriy `changes` qabul qiladi:** berilsa xarajat shu yerda tahrirlanadi
  va tahrirlash qoidalari `ExpensesService.update()` da bir joyda qoladi; berilmasa
  murojaat shunchaki yopiladi (direktor tahrirni alohida bajargan bo'ladi).
- **Storno (bekor qiluvchi yozuv) S8 ga kirmadi** — TZ uni 24 soatdan keyingi yagona yo'l
  deb ataydi, lekin sxemada storno modeli yo'q va uning semantikasi qaytarish (S9)
  bilan ustma-ust tushadi. S9 da qayta baholanadi.
- **Byudjet qayta hisobi** — byudjetlar S10 da quriladi, o'sha yerda tahrirlangan summa
  hisobga olinadi (sarf har doim `APPROVED` yozuvlardan hisoblanadi, alohida hook shart emas).

**Commit:** `feat(edit): 24 soatlik tahrirlash oynasi va tahrirlash murojaatlari`

---

## S9 — Qaytarish (Refund) ✅ (TZ 3.9)

**Nima:** `POST /refunds` (isbot fayli majburiy), ikki bosqichli tasdiqlash,
to'liq/qisman, `refundedAmount` yangilanishi, `PARTIALLY_REFUNDED` → `REFUNDED` avtomatik
o'tishi, effektiv summa hisobi.

**Natija:** `test:int` — 198/198 yashil (yangi: qaytarish 18), `test:unit` — 31/31.

**S9 da qabul qilingan qarorlar:**
- **`POST /refunds` — `multipart/form-data`.** Isbot fayli istisnosiz majburiy, shuning
  uchun so'rov va fayl bitta chaqiruvda keladi: yozuv hech qachon isbotsiz holatda
  mavjud bo'lmaydi. (Xarajat yaratishda buni qilib bo'lmagan edi — u yerda `employeeIds`
  va `shares` kabi ichma-ich massivlar bor, shuning uchun `DRAFT` + `submit` yo'li tanlangan.)
- **Qaytarish `PARTIALLY_REFUNDED` xarajatga ham yaratiladi.** TZ «faqat `APPROVED`» deydi,
  lekin ayni paytda «bitta xarajatga bir nechta qisman qaytarish» ni talab qiladi — ikkinchi
  qaytarish paytida xarajat allaqachon `PARTIALLY_REFUNDED` bo'ladi.
- **Qolgan summa hisobida navbatdagi so'rovlar ham chegiriladi.** Aks holda 500 000 lik
  xarajatga 400 000 va 200 000 lik ikki so'rov alohida-alohida o'rinli bo'lib, ikkalasi
  tasdiqlanganda umumiy summadan oshib ketardi.
- **Yig'indi chegarasi bitta shartli `UPDATE` ichida** tekshiriladi
  (`refundedAmount + ? <= amount`) — ikkita qaytarish bir vaqtda tasdiqlansa ikkinchisi
  shu yerda to'xtaydi. Prisma ustunni ustun bilan solishtira olmaydi, shuning uchun raw
  `UPDATE`; DB da bu invariant check constraint bilan ham qo'riqlanadi.
- **Kurs asl xarajatdan meros olinadi**, qaytarish sanasidagi kurs olinmaydi — aks holda
  100 USD xarajat va uni to'liq qaytarish UZS da har xil chiqib, hisobotda qoldiq paydo
  bo'lardi.
- **Ulushlar (`ExpenseShare`) o'zgartirilmaydi.** Asl xarajat immutable (TZ 3.9), shuning
  uchun xodim bo'yicha effektiv summa hisobot vaqtida proporsional hisoblanadi
  (`ulush × (1 − refundedAmount / amount)`) — S12 da.
- **Storno alohida qurilmadi (S8 dagi savolning javobi).** TZ storno ni 24 soatdan keyingi
  yagona yo'l deb ataydi, lekin uning ma'nosi — isbot bilan tasdiqlangan, ikki bosqichdan
  o'tgan, xarajatni nolga tushiruvchi yozuv — aynan **to'liq qaytarish**. Ikkinchi mexanizm
  qurish bir xil holatni ikki xil yo'l bilan ifodalash bo'lardi.
- **Cron testlarda o'chirildi** (`common/cron/cron.guard.ts`): `@Cron(EVERY_HOUR)` soat
  boshida testlar orasida ishga tushib boshqa test faylining ma'lumotiga bildirishnoma
  yozib, ikki testni tasodifiy yiqitgan edi. Cron mantig'i `run()` ni aniq chaqirib
  sinaladi, ya'ni qamrov kamaymadi.

**Commit:** `feat(refunds): to'liq va qisman qaytarish oqimi`

---

## S10 — Byudjet va limitlar ✅ (TZ 3.10)

**Nima:** `budgets` CRUD (faqat ADMIN), sarf hisobi (`APPROVED` + effektiv summa),
80% / 100% chegaralari, `BudgetAlert` bilan takrorlanmaslik, javobda `budgetWarning`,
`GET /budgets/usage`.

**Natija:** `test:int` — 216/216 yashil (yangi: byudjet 18), `test:unit` — 39/39
(yangi: hisobot davri 8).

**S10 da qabul qilingan qarorlar:**
- **Hisobot davri alohida modulda** (`budgets/period.ts`) va unit testlar bilan qoplangan:
  `startDay = 25` bo'lganda davr 25.07–24.08 bo'ladi va **boshlangan oy** bilan nomlanadi
  (`2026-07`). Sukut holatda (`startDay = 1`) kalit kalendar oyga aynan mos tushadi, ya'ni
  hech qanday siljish yo'q. Kalit faqat ogohlantirish takrorlanmasligi uchun; API har doim
  `periodStart` / `periodEnd` sanalarini ham qaytaradi, shuning uchun UI da noaniqlik yo'q.
- **Yaratishda `budgetWarning`, tasdiqda bildirishnoma.** Yangi yozuv `DIRECTOR_PENDING`
  bo'ladi va sarfda hisoblanmaydi, lekin foydalanuvchiga darhol aytish kerak — shuning
  uchun uning summasi `projected` ga qo'shiladi. Bildirishnoma esa sarf **haqiqatan**
  o'zgarganda, ya'ni yakuniy tasdiqda ketadi: aks holda hech qachon tasdiqlanmagan
  arizalar ham adminlarni bezovta qilardi.
- **Chegara takrorlanmasligi `BudgetAlert` ning `UNIQUE(budgetId, period, threshold)` i
  bilan**, xotiradagi hisoblagich bilan emas: parallel ikki tasdiqlashdan faqat bittasi
  yozadi, ikkinchisi `P2002` oladi va jim o'tib ketadi.
- **Sarf raw so'rov bilan hisoblanadi** — `(amount − refundedAmount) × rateUsed` ustunlar
  ustidagi ifoda, Prisma `aggregate` da bunday ifoda yo'q. Xodim limitida esa ulush
  qaytarish nisbatiga proporsional kamaytiriladi (`share.amountUzs × (1 − refunded/amount)`),
  S9 da kelishilgandek.
- **Ustma-ust tushadigan limitlar taqiqlangan** (409 `BUDGET_OVERLAP`) — aks holda bir
  doiraga ikki limit amalda bo'lib, qaysi biri ishlashi noaniq bo'lardi. TZ bu holatni
  aytmagan.
- **Qaytarishda sarf qayta hisoblanmaydi** — sarf har doim so'rov vaqtida hisoblanadi,
  ya'ni qaytarish tasdiqlangach o'z-o'zidan kamayadi. Ogohlantirish faqat chegara
  **yuqoriga** kesib o'tilganda yuboriladi, shuning uchun kamayishda hech narsa qilinmaydi.
- **Ro'yxatdagi ⚠️ belgisi uchun `GET /budgets/usage`** qo'shildi: har bir qator uchun
  alohida so'rov qilish (N+1) o'rniga UI joriy davr sarfini bir marta olib, belgilarni
  o'zi hisoblaydi. Tasdiqlash ekranidagi aniq ogohlantirish esa `budgetWarning` orqali.

**Commit:** `feat(budgets): yumshoq limitlar va 80/100% ogohlantirishlari`

---

## S11 — Bildirishnomalar ✅ (TZ 3.11)

**Nima:** BullMQ navbati + processor, 3 marta retry (eksponensial backoff),
`Notification` yozuvi + Web badge, Telegram yuborish adapteri, bloklangan bot bilan
xatosiz ishlash (`botBlocked` belgisi), job payload da `companyId` majburiy.

**Natija:** `test:int` — 231/231 yashil (yangi: bildirishnomalar 15), `test:unit` — 39/39.

**S11 da qabul qilingan qarorlar:**
- **Web yozuvi navbatdan tashqarida.** `Notification` qatori darhol bazaga tushadi,
  navbatga faqat **Telegram yuborish** qo'yiladi. Shu sababli Redis ishlamasa ham
  foydalanuvchi xabarni badge da ko'radi — navbat yagona yetkazish yo'li emas.
- **Job qo'shish asosiy amalni yiqitmaydi:** `queue.addBulk` xatosi loglanadi va oqim
  davom etadi. Aks holda Redis uzilishi xarajat yaratishni ham to'xtatib qo'yardi.
- **Xabar matni serverda tayyorlanadi** (`notification-messages.ts`), foydalanuvchining
  `language` iga qarab uz/ru. Bir xil matn Web badge ida ham, Telegram xabarida ham
  ishlatiladi — ikki mijozda takrorlash shart emas. To'liq `nestjs-i18n` S17 da keladi
  va shu jadval o'sha yerga ko'chadi.
- **`NOTIFICATION_TYPES` alohida faylga chiqarildi** (`notification-types.ts`): matn
  shabloni va processor ham shu ro'yxatga tayanadi, servisda qolsa aylanma import chiqardi.
- **Telegraf ning yengil `Telegram` mijozi** ishlatiladi, to'liq `Bot` obyekti emas:
  bu yerda faqat chiqish kanali kerak, polling yoki webhook ko'tarilmaydi (ular S16 da).
- **403 ni "bloklangan" deb hisoblash keng:** `blocked`, `deactivated`, `chat not found`
  va bo'sh tavsif ham shu toifada — bularning barchasida qayta urinish befoyda va
  job ni `failed` ga tushirish faqat navbatni chiqindi bilan to'ldirardi.
- **Worker testlarda ro'yxatga olinmaydi** (`DISABLE_QUEUE_WORKER`): BullMQ worker Redis ga
  blokli ulanish ochadi va uni har test faylida ko'tarish Jest ni jarayondan chiqmay
  qoldirdi (to'liq qator 10 daqiqadan oshib ketdi). Job qo'shish baribir ishlaydi, ya'ni
  "job soni +1" mezoni tekshiriladi; processor mantig'i esa `process()` ni aniq chaqirib
  sinaladi — cron bilan bir xil yondashuv. Testlar alohida Redis DB (`1`) ishlatadi.

**Commit:** `feat(notifications): BullMQ navbatlari, web + telegram kanallari`

---

## S12 — Hisobotlar va dashboard ✅ (TZ 3.13)

**Nima:** `/reports/summary`, `by-branch`, `by-category`, `by-employee`, `dynamics`,
`budget-vs-actual`; hisobot davri (kalendar oy yoki 25–25); Redis kesh TTL 5 daq
(kalit `companyId` bilan prefikslangan); aralash valyuta → UZS.

**Natija:** `test:int` — 250/250 yashil (yangi: hisobotlar 18), `test:unit` — 39/39.

**S12 da qabul qilingan qarorlar:**
- **Agregatlar raw SQL da.** `(amount − refundedAmount) × rateUsed` ustunlar ustidagi
  ifoda va `GROUP BY` ni Prisma `aggregate` bilan ifodalab bo'lmaydi; o'n minglab qatorni
  xotiraga tortish esa 2 soniyalik javob mezoniga sig'masdi.
- **`SPEND_COUNTED_STATUSES` bitta joyga yig'ildi** (`expenses/expense-status.ts`).
  S10 va S8 da bir xil ro'yxat ikki faylda takrorlangan edi — endi byudjet, tahrirlash
  va hisobotlar aynan shu konstantaga tayanadi.
- **`dynamics` endpointi qo'shildi** — roadmap da yo'q edi, lekin TZ 3.13 dashboard
  ro'yxatida "Dinamika grafigi (oylar kesimida trend)" bor va `date_trunc` bilan bu
  arzon.
- **Kesh kaliti `reports:{companyId}:{hisobot}:{filtrlar hash}`.** Kesh tenant
  izolyatsiyasining eng oson buziladigan joyi: so'rov umuman bazaga bormaydi, ya'ni
  Prisma extension himoya qila olmaydi. Shuning uchun `companyId` kalitning **prefiksi**
  va bu alohida test bilan qoplangan.
- **Redis yo'q bo'lsa hisobot keshsiz ishlaydi** (`enableOfflineQueue: false` + xatoni
  yutish) — kesh tezlik uchun, mavjudlik uchun emas.
- **Navbat ko'rsatkichlari (`pendingDirectorCount` / `pendingAdminCount`) sana filtriga
  bog'lanmaydi** — navbat "hozir nima kutib turgani", tarixiy kesim emas.
- **Xodim kesimi `expense_shares` bo'yicha** va qaytarish nisbatiga proporsional
  kamaytiriladi — S9 da kelishilganidek, asl xarajat immutable bo'lgani uchun ulushlar
  qaytarishda o'zgartirilmaydi.
- **Filial kesimida xodim soni alohida so'rov bilan olinadi.** Birinchi variantda
  `employees` `expenses` ga `LEFT JOIN` qilingan edi va `SUM` xodimlar soniga ko'payib
  ketdi (750 000 → 3 000 000). Test shuni ushladi; `COUNT(DISTINCT)` to'g'ri bo'lgani
  uchun xato faqat summada ko'rinardi.

**Commit:** `feat(reports): dashboard KPI va kesimli hisobotlar`

---

## S13 — Eksport E1–E10 ✅ (TZ 3.13)

**Nima:** `POST /exports` → eksport yozuvi; `GET /exports`, `GET /exports/:id`,
`GET /exports/:id/download` (signed URL), `GET /exports/types`; `exceljs` bilan xlsx
(raqam formati, jami qatori, freeze pane, avtofiltr), PDF (`pdfmake`); >1000 qator →
fon rejimi (BullMQ `exports` navbati); 24 soatdan keyin avtomatik tozalash (cron);
har eksport → `audit_log` (`action: "EXPORT"`).

**Natija:** `test:int` — 262/262 yashil (yangi: eksport 12), `test:unit` — 47/47
(yangi: `xlsx.writer` 6, `pdf.writer` 2).

**S13 da qabul qilingan qarorlar:**
- **Ruxsat `@Roles` da emas, katalogda.** Bitta endpoint E1–E10 ni qabul qiladi, ya'ni
  ruxsat **turga** bog'liq (E9 — faqat admin). `export-catalog.ts` — turlar, ruxsat
  etilgan rollar va formatlar yagona jadvalda; controller uni faqat o'qiydi.
- **Ma'lumot mavjud servislardan olinadi** (`ExpensesService.listForExport`,
  `ReportsService`) — shunda eksport ekrandagi jadval bilan bir xil filtr, bir xil
  filial doirasi va bir xil hisoblash mantig'ini ishlatadi. Alohida SQL yozilganda
  "qatorlar soni mos kelishi" mezoni birinchi o'zgarishdayoq buzilardi.
- **Sinxron/fon chegarasi — 1000 qator**, lekin ikkala yo'l ham bitta `generate()` ni
  chaqiradi: fon rejimidagi fayl sinxron fayldan farq qilmaydi.
- **Job ichida rol va filial uzatiladi.** Processor so'rov konteksti tashqarisida
  ishlaydi; faqat `companyId` uzatilganda direktor so'ragan faylga butun kompaniya
  qatorlari tushib ketardi.
- **Jami qatori formula bilan emas, hisoblangan qiymat bilan** — fayl PDF ga
  aylantirilganda yoki formulani qo'llab-quvvatlamaydigan ko'rgichda ham son ko'rinadi.
- **PDF uchun Roboto (pdfmake vfs) yuklanadi.** Standart Helvetica WinAnsi da ishlaydi
  va kirill harflarini chiza olmaydi — ruscha hisobot bo'sh kvadratlarga aylanardi.
  PDF da ustunlar 10 tagacha qisqaradi (A4 ga sig'maydi), to'liq ma'lumot xlsx da.
- **Tozalash cron yozuvni emas, faqat `storageKey` ni o'chiradi** — eksport tarixi va
  audit izi qoladi, muddati tugagan havola esa `EXPORT_NOT_READY` beradi.
- **E9 `changes` ni maydon-boyicha qatorlarga yoyadi** (TZ 3.14) — bitta amalda uch
  maydon o'zgargan bo'lsa, faylda uch qator.

**Commit:** `feat(exports): E1–E10 xlsx/pdf, fon rejimi, signed URL`

---

## S14 — Audit jurnali ✅ (TZ 3.14)

**Nima:** `@Audit()` dekoratori + `AuditInterceptor` — `old→new` diff, IP, kanal;
`GET /audit` va `GET /audit/facets` (faqat ADMIN); login, filial, kategoriya, xodim va
kurs amallari jurnalga ulandi; E9 eksporti `changes` ni qatorlarga yoyadi va `GET /audit`
bilan aynan bir xil filtrni ishlatadi. DB trigger append-only ni majburlaydi.

**Natija:** `test:int` — 282/282 yashil (yangi: audit 11, sozlamalar 9), `test:unit` — 47/47.

**S14 da qabul qilingan qarorlar:**
- **Interceptor `model` ni bilsa, `old → new` haqiqiy bo'ladi.** `@Audit({ model: 'branch' })`
  berilganda interceptor yozuvni amaldan **oldin** ham, keyin ham o'qib solishtiradi —
  so'rov tanasidan diff qurish "eski qiymat" ni umuman ko'rsata olmasdi.
- **Ikki mexanizm ataylab yonma-yon.** Murakkab oqimlar (xarajat, tasdiqlash, qaytarish,
  byudjet, eksport) `AuditService` ni o'zi chaqiradi — u yerda yoziladigan ma'lumot
  so'rov tanasidan kengroq; dekorator esa oddiy CRUD uchun, shunda yangi endpointda
  auditni unutish qiyinlashadi. Bir endpointga ikkalasi qo'yilmaydi.
- **Login `runAsync` ichida yoziladi.** So'rov `@Public`, ya'ni guard kontekstni
  to'ldirmagan va `companyId` aynan login paytida ma'lum bo'ladi.
- **Maxfiy maydonlar ro'yxati interceptorda** (`password`, `passwordHash`, `token`, …) —
  jurnalga ham, diff ga ham tushmaydi (TZ 4.2).
- **`GET /audit` `q` bilan bir qatorda `search` ni ham qabul qiladi** — frontend jadvali
  shu nom bilan yuboradi, `forbidNonWhitelisted` esa noma'lum parametrni rad etardi.
- **Filtr mantig'i bitta funksiyada** (`buildWhere`) — `GET /audit` va E9 eksporti aynan
  bir xil natija berishi shart.

**Commit:** `feat(audit): append-only jurnal va E9 eksporti`

---

## S15 — Sozlamalar ✅ (TZ 3.15)

**Nima:** `GET/PATCH /settings` (faqat ADMIN), kesh invalidatsiya, har o'zgarish auditga;
sozlanadigan: valyuta bazasi, hisobot davri boshlanish kuni, standart til, ish kunlari,
bildirishnomalar yoqilishi, eslatma vaqti, tahrirlash oynasi.

**S15 da qabul qilingan qarorlar:**
- **API tekis shaklda** (`{"reportPeriodStartDay": 25}`), xom `{key, value}` emas:
  aks holda mijoz kalit nomlarini ham, har birining ichki JSON tuzilishini ham bilishi
  kerak bo'lardi, validatsiya esa serverda qolishi shart.
- **Faqat haqiqatan o'zgargan kalit yoziladi** — forma barcha maydonlarni yuboradi,
  ya'ni har saqlashda 7 ta soxta audit yozuvi paydo bo'lishi mumkin edi.
- **`notifications.enabled` haqiqiy ta'sir qiladi** — `NotificationsService.notifyUsers`
  sozlamani tekshiradi, ya'ni sozlama "o'lik konfiguratsiya" bo'lib qolmaydi.
- **`company.defaultLanguage` ikki joyda saqlanmaydi**: sozlama yangilanganda
  `companies.defaultLanguage` ustuni ham yangilanadi (u sxemada allaqachon bor).

**Commit:** `feat(settings): kompaniya sozlamalari va kesh invalidatsiya`

---

## S16 — Telegram bot 🔄 (TZ 3.12, 3.16.5)

Bosqich hajmi katta, shuning uchun uchga bo'lindi: **S16.1** infratuzilma va kirish,
**S16.2** xarajat oqimi va statistika, **S16.3** tasdiqlash/refund/tahrirlash sahnalari.

### S16.1 — Infratuzilma, kirish, hisoblar ✅

**Nima qurildi:**
- `BotDirectoryService` — **token → companyId** xaritasi: umumiy bot (env token) va
  kompaniya boti (`Company.telegramBotToken`, AES-256-GCM bilan shifrlangan)
- `EncryptionService` (`common/crypto`) — qaytariladigan maxfiy qiymatlar uchun
- `BotLauncherService` — bir jarayonda bir nechta Telegraf instansi, graceful stop
- `BotSessionService` — Redis sessiya `bot:{botId}:{telegramId}` + DB `TelegramSession`
- `BotRouterService` + `LoginFlowHandler` + `AccountsFlowHandler`, `MenuPresenter`
- Rolga mos menyular (ishchi / direktor / admin), uz-ru matnlar (`bot-texts.ts`)

**Natija:** `test:int` — 298/298 yashil (yangi: bot 16), `test:unit` — 53/53.

**S16.1 da qabul qilingan qarorlar:**
- **Telegraf `Scenes` ishlatilmadi.** Holat baribir Redis da saqlanishi shart, sahna
  qadamlari esa bizga `flowState` union i sifatida kerak. O'z routeri transportdan
  mustaqil bo'ldi: testlar tarmoqqa chiqmaydi, `BotTransport` ni almashtirib tekshiradi.
- **`companyId` sessiyadan olinmaydi.** Har yangilanishda `activeLinkId` orqali bazadan
  hisob qayta o'qiladi va amal `runAsync` konteksti ichida bajariladi — Redis dagi
  qiymat eskirgan yoki bog'lanish bekor qilingan bo'lsa cross-tenant oqish bo'lmaydi.
- **Redis yonma-yon DB ga ham yozadi** (`save` bitta funksiyada ikkalasini yozadi):
  Redis tozalansa ham til va faol hisob yo'qolmaydi, ikki manba esa ajralib ketolmaydi.
- **Parol sessiyada saqlanmaydi.** Bitta login bir nechta kompaniyada topilganda
  parol har nomzodga tekshiriladi, keyin sessiyada faqat nomzod `userId` lari va
  `verifiedAt` qoladi (2 daqiqa) — kompaniya tanlangach parol qayta so'ralmaydi.
- **Bloklash `telegramId` bo'yicha** (`TelegramLoginAttempt`), `User` bo'yicha emas:
  botda hujumchi login nomlarini almashtirib urinishi mumkin.
- **Kompaniya boti tekshiruvi parol tasdiqlangandan keyin**: aks holda "bu bot boshqa
  kompaniya uchun" javobi login mavjudligini oshkor qilardi.
- **Menyu tugmasi oqimdan ustun turadi** — pastdagi klaviatura oqim davomida ham
  ekranda qoladi va TZ 3.12.2 hisobni oqim o'rtasida almashtirishni talab qiladi.
  Inline tugma esa hech qachon oqimning matn qadamiga tushmaydi.
- **"Hisob qo'shish" sozlamalarda ham bor**: bitta hisobda menyuda "Hisobni
  almashtirish" ko'rinmaydi (TZ 3.12.2), ya'ni ikkinchi hisobni qo'shish yo'li qolmasdi.

**Commit:** `feat(telegram): bot infratuzilmasi, kirish va hisoblar`

### S16.2 — Xarajat qo'shish oqimi, ro'yxatlar, statistika ✅

**Nima qurildi:**
- `ExpenseFlowHandler` — kategoriya (2 daraja) → kim uchun (o'zim / boshqa xodim /
  guruh) → taqsimlash (teng yoki qo'lda) → summa (`100 USD` ham) → sana → izoh →
  chek → tasdiqlash ekrani; har qadamda ⬅️ / ❌
- `ListsFlowHandler` — "Mening xarajatlarim", "Filial xarajatlari", statistika
- `format.ts` — summa/sana ko'rsatish va foydalanuvchi kiritganini o'qish

**Natija:** `test:int` — 307/307 yashil (yangi: bot xarajat oqimi 9), `test:unit` — 53/53.

**S16.2 da qabul qilingan qarorlar:**
- **Bot yozuvni o'zi yaratmaydi** — `ExpensesService.create` va `ApprovalsService.submit`
  chaqiriladi: validatsiya, raqamlash, kurs snapshot i, byudjet ogohlantirishi va audit
  bitta joyda qolishi kerak. Web bilan farq faqat kirish nuqtasida.
- **`history` massivi bilan "Orqaga"** — qadamlar shartli (guruh tanlanmasa taqsimlash
  bo'lmaydi), ya'ni "oldingi qadam" ni ro'yxatdan hisoblab bo'lmaydi. Orqaga qaytganda
  kiritilgan ma'lumot saqlanadi.
- **Fayl turi e'lon qilingan MIME dan olinmaydi** — Telegram rasmni qayta kodlaydi,
  shuning uchun bot `mimetype` ni bo'sh qoldiradi va `FilesService` mazmun imzosidan
  (magic bytes) turni aniqlaydi.
- **Chek majburiy kategoriyada tartib web bilan bir xil**: yozuv `DRAFT` yaratiladi →
  fayl biriktiriladi → `submit`. Fayl yuklanmasa xarajat yo'qolmaydi: qoralama qoladi
  va foydalanuvchiga web orqali chek biriktirishi aytiladi.
- **`Role.WORKER` holat mashinasiga qo'shildi** (`expense-status.ts`): TZ 3.7 jadvali
  bo'yicha `DRAFT` ni ishchi yuboradi va `NEEDS_FIX` dan keyin ham ishchi qayta
  yuboradi. S7 da bu o'tishlar faqat ADMIN/DIRECTOR ga berilgan edi — ishchi kanali
  (bot) yo'q edi, natijada ishchining qoralamasi hech qachon oqimga tushmasdi.
  O'tishlar `creatorOnly` — o'z yozuvi bilan cheklangan.
- **Menyu tugmasi oqimni bekor qiladi va bu aytiladi** — yarim to'ldirilgan xarajat
  jim yo'qolmasligi kerak.
- **Ishchi statistikasi `employeeId` filtri bilan** olinadi: rol bo'yicha doira ishchini
  cheklamaydi, ulush filtri esa aynan o'z xarajatlarini qoldiradi. Kesh kaliti ham
  `employeeId` ni o'z ichiga oladi, ya'ni bir ishchi natijasi boshqasiga ko'rinmaydi.
- **To'lov usuli bot da so'ralmaydi** (TZ 3.12.3 da yo'q) — `CASH` qo'yiladi.

### S16.3 — Tasdiqlash, refund, tahrirlash sahnalari ⬜

- Tasdiqlash kartochkasi + inline tugmalar + idempotentlik, navigatsiya (⬅️ ➡️)
- Refund va EditRequest sahnalari

**Qabul mezoni (butun S16):** parol xabari o'chiriladi va loglarda yo'q; hisob
almashtirilganda cross-tenant ma'lumot oqmaydi; javob ≤ 2 s (p95).

---

## S17 — i18n, xato formati, sayqal ⬜ (TZ 4.3, 5.4)

**Nima:** `nestjs-i18n` uz/ru, yagona xato formati `{ statusCode, code, message, details? }`,
barcha xabarlar i18n kaliti bilan, hardcode matn qolmasligi (lint qoidasi).

**Commit:** `feat(i18n): uz/ru tarjimalar va yagona xato formati`

---

## S18 — Test, CI, deploy ⬜ (TZ 6, 7)

**Nima:** qamrov chegaralari (pul mantiqi ≥ 90%, umumiy ≥ 75%), GitHub Actions
(lint → typecheck → test → build), `Dockerfile` (api), `docker-compose.prod.yml`,
Nginx + Let's Encrypt, kunlik `pg_dump` + tiklash skripti, `docs/deploy.md`,
`docs/user-guide-web.md`, `docs/user-guide-bot.md`.

**Commit:** `chore(ci): GitHub Actions, prod compose, backup skripti`

---

## Frontend (siz qilasiz)

Texnik topshiriq: [`FRONTEND-TZ.md`](FRONTEND-TZ.md) · Dizayn: [`DESIGN-TZ.md`](DESIGN-TZ.md)

Backend bilan parallel ishlash uchun tavsiya etilgan tartib:

| # | Bosqich | Kerakli backend bosqichi |
|---|---|---|
| F1 | Skaffold, layout, router, i18n, dizayn tokenlari | — (mock bilan) |
| F2 | Login + auth oqimi, guard lar | S2 |
| F3 | Filiallar / Xodimlar / Kategoriyalar ekranlari | S3 |
| F4 | Xarajatlar ro'yxati + kartochka + yaratish formasi | S6 |
| F5 | Tasdiqlash navbati | S7 |
| F6 | Qaytarish + tahrirlash murojaatlari | S8, S9 |
| F7 | Byudjetlar, valyuta, sozlamalar, foydalanuvchilar | S5, S10, S15 |
| F8 | Dashboard grafiklari | S12 |
| F9 | Hisobotlar + eksport ekrani | S13 |
| F10 | Audit jurnali, bildirishnoma markazi, profil | S11, S14 |

F1 dan F4 gacha `msw` mock bilan backendni kutmasdan ishlash mumkin —
mock kontraktlar `FRONTEND-TZ.md` dagi API bo'limidan olinadi.
