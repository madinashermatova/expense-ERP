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

## S5 — Valyuta va kurslar ⬜ (TZ 3.5)

**Nima quriladi:**
- `CurrencyService` — sanaga amaldagi kursni topish, `AUTO`/`MANUAL` baza tanlovi
- CBU cron (09:00 Asia/Tashkent), xato bo'lsa oxirgi kurs + admin ga bildirishnoma
- `POST /currency/rates` (qo'lda), `GET /currency/rates`
- `MANUAL` rejimda kurs yo'q bo'lsa USD xarajat → 422

**Qabul mezoni:** CBU 500 qaytarsa cron yiqilmaydi; kurs keyin o'zgarsa eski xarajat
UZS ekvivalenti o'zgarmaydi.

**Commit:** `feat(currency): CBU cron, qo'lda kurs, snapshot mantiqi`

---

## S6 — Xarajatlar yadrosi ⬜ (TZ 3.6)

**Nima quriladi:**
- `NumberingService` — `NumberSequence` ustida `SELECT … FOR UPDATE`, `EXP-000123` va `CHL-2026-0045`
- `POST /expenses` — validatsiya (musbat summa, kelajak sanasi yo'q, kategoriya qoidalari),
  kurs snapshot, taqsimlash (teng / qo'lda), tiyin qoldig'i birinchi xodimga
- `GET /expenses` — filtr, qidiruv (ikkala raqam), saralash, pagination
- `GET /expenses/:id`, `DELETE /expenses/:id` (soft delete + audit)
- Dublikat ogohlantirish (10 daq oynasi, bloklamaydi)

**Qabul mezoni:** 100 ta parallel yaratishda raqam dublikat yo'q; `100000/3` →
`33333.34 + 33333.33 + 33333.33`; 10 000 yozuvda ro'yxat ≤ 2 s.

**Commit:** `feat(expenses): yadro CRUD, ikki xil raqamlash, taqsimlash mantiqi`

---

## S7 — Tasdiqlash oqimi ⬜ (TZ 3.7)

**Nima quriladi:**
- Status mashinasi (o'tишлар jadvali, noto'g'ri o'tish → 422)
- `approve` / `reject` / `request-fix` + `ExpenseStatusHistory`
- Direktor o'zinikini tasdiqlay olmaydi → to'g'ridan-to'g'ri `ADMIN_PENDING`
- **Four-eyes:** admin o'zinikini tasdiqlay olmaydi; yagona faol admin bo'lsa `selfApproved=true`
- Optimistik blokirovka (`version`) → ikkinchi admin ga 409
- `POST /expenses/bulk-approve` — 20 tagacha, qisman muvaffaqiyat hisoboti
- 24 soat javobsiz ariza eslatmasi (cron + BullMQ)

**Qabul mezoni:** direktor tasdiqlagach `ADMIN_PENDING`; 5 belgili sabab → 422;
ikki admin bir vaqtda → biri 409.

**Commit:** `feat(approvals): ikki bosqichli tasdiqlash, four-eyes, optimistik lock`

---

## S8 — Tahrirlash + EditRequest ⬜ (TZ 3.8)

**Nima:** `PATCH /expenses/:id` 24 soat oynasi + majburiy sabab + audit `old→new`;
`edit-requests` CRUD (bot: WORKER yaratadi, direktor apply/reject); summa o'zgarsa
byudjet qayta hisoblanadi.

**Commit:** `feat(edit): 24 soatlik tahrirlash oynasi va tahrirlash murojaatlari`

---

## S9 — Qaytarish (Refund) ⬜ (TZ 3.9)

**Nima:** `POST /refunds` (isbot fayli majburiy), ikki bosqichli tasdiqlash,
to'liq/qisman, `refundedAmount` yangilanishi, `PARTIALLY_REFUNDED` → `REFUNDED` avtomatik
o'tishi, effektiv summa hisobi, share larga proporsional taqsimlash.

**Commit:** `feat(refunds): to'liq va qisman qaytarish oqimi`

---

## S10 — Byudjet va limitlar ⬜ (TZ 3.10)

**Nima:** `budgets` CRUD (faqat ADMIN), sarf hisobi (`APPROVED` + effektiv summa),
80% / 100% chegaralari, `BudgetAlert` bilan takrorlanmaslik, javobda `budgetWarning`.

**Commit:** `feat(budgets): yumshoq limitlar va 80/100% ogohlantirishlari`

---

## S11 — Bildirishnomalar ⬜ (TZ 3.11)

**Nima:** BullMQ navbatlari + processorlar, 3 marta retry (eksponensial backoff),
`Notification` yozuvi + Web badge, Telegram yuborish adapteri, bloklangan bot bilan
xatosiz ishlash (`botBlocked` belgisi), job payload da `companyId` majburiy.

**Commit:** `feat(notifications): BullMQ navbatlari, web + telegram kanallari`

---

## S12 — Hisobotlar va dashboard ⬜ (TZ 3.13)

**Nima:** `/reports/summary`, `by-branch`, `by-category`, `by-employee`,
`budget-vs-actual`; hisobot davri (kalendar oy yoki 25–25); Redis kesh TTL 5 daq
(kalit `companyId` bilan prefikslangan); aralash valyuta → UZS.

**Commit:** `feat(reports): dashboard KPI va kesimli hisobotlar`

---

## S13 — Eksport E1–E10 ⬜ (TZ 3.13)

**Nima:** `POST /exports` → `jobId`; `exceljs` bilan xlsx (raqam formati, jami qatori,
freeze pane, avtofiltr), PDF (`pdfmake`); >1000 qator → fon rejimi; signed URL;
24 soatdan keyin avtomatik tozalash (cron); har eksport → `audit_log`.

**Commit:** `feat(exports): E1–E10 xlsx/pdf, fon rejimi, signed URL`

---

## S14 — Audit jurnali ⬜ (TZ 3.14)

**Nima:** `AuditInterceptor` / `AuditService` — `old→new` diff, IP, kanal;
`GET /audit` (faqat ADMIN); E9 eksporti `changes` ni qatorlarga yoyadi.
DB trigger allaqachon append-only ni majburlaydi.

**Commit:** `feat(audit): append-only jurnal va E9 eksporti`

---

## S15 — Sozlamalar ⬜ (TZ 3.15)

**Nima:** `GET/PATCH /settings` (ADMIN), kesh invalidatsiya, har o'zgarish audit ga;
sozlanadigan: valyuta bazasi, davr boshlanish kuni, til, eslatma vaqti, tahrirlash oynasi.

**Commit:** `feat(settings): kompaniya sozlamalari va kesh invalidatsiya`

---

## S16 — Telegram bot ⬜ (TZ 3.12, 3.16.5)

**Nima quriladi:**
- Telegraf modul, **token → companyId** xaritasi (umumiy bot + kompaniya boti)
- Login sahnasi: login → parol → `deleteMessage` → `TelegramAccountLink`
- **Hisobni almashtirish** (parolsiz), qo'shish, chiqish, hammasidan chiqish
- Redis sessiya (`bot:{botId}:{telegramId}`), bot restartdan keyin oqim davom etadi
- Xarajat qo'shish sahnasi (9 qadam, har qadamda ⬅️ / ❌)
- Tasdiqlash kartochkasi + inline tugmalar + idempotentlik
- Refund va EditRequest sahnalari, statistika, til almashtirish

**Qabul mezoni:** parol xabari o'chiriladi va loglarda yo'q; hisob almashtirilganda
cross-tenant ma'lumot oqmaydi; javob ≤ 2 s (p95).

**Commit:** `feat(telegram): login, hisob almashtirish, xarajat oqimi`

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
