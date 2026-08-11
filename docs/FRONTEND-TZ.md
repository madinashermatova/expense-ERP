# Frontend TZ — Web ERP

Versiya: 1 | Sana: 2026-08-12 | Asos: [`TZ.md`](TZ.md) 3.x, 4.3, 5.4, 5.5

Ushbu hujjat **frontend ishlab chiquvchi uchun mustaqil topshiriq**. Backend parallel
quriladi ([`ROADMAP.md`](ROADMAP.md)), shuning uchun har bir ekran uchun API kontrakti
shu yerda qat'iy belgilangan — backend tayyor bo'lmaguncha `msw` mock bilan ishlash mumkin.

Dizayn qoidalari alohida: [`DESIGN-TZ.md`](DESIGN-TZ.md)

---

## 1. Stek va qat'iy qarorlar

| Qatlam | Tanlov | Izoh |
|---|---|---|
| Framework | **React 18 + TypeScript (strict)** | |
| Build | **Vite 5** | |
| Styling | **TailwindCSS + shadcn/ui** | komponentlar `src/components/ui/` ga ko'chiriladi |
| Server state | **TanStack Query v5** | barcha API chaqiruvlari faqat shu orqali |
| Client state | **Zustand** | faqat auth, til, UI preferens (jadval ustunlari, sidebar) |
| Router | **React Router v6** (data router) | |
| Forma | **react-hook-form + zod** | `zodResolver`, backend DTO bilan bir xil qoidalar |
| Grafik | **Recharts** | |
| i18n | **i18next + react-i18next** | `uz`, `ru` — hardcode matn **taqiqlanadi** |
| Sana | **date-fns + date-fns-tz** | ko'rsatish Asia/Tashkent, API ga ISO/UTC |
| HTTP | **axios** instance + interceptorlar | |
| Jadval | **TanStack Table v8** | server-side pagination/sort/filter |
| Test | **Vitest + Testing Library**, **Playwright** (e2e) | |
| Mock | **msw** | `VITE_USE_MOCK=true` |
| Lint | ESLint + Prettier + `tsc --noEmit` | CI da majburiy |

**Node 20+**, paket menejeri **npm**.

### Taqiqlar

- `any` ishlatish (lint error). Kerak bo'lsa `unknown` + zod parse.
- Komponent ichida to'g'ridan-to'g'ri `fetch` / `axios` chaqirish — faqat `src/lib/api/` orqali.
- Hardcode matn (i18n kalitisiz string JSX ichida) — lint qoidasi bilan bloklanadi.
- Rolga qarab UI ni yashirish **yagona himoya** deb hisoblash — server baribir tekshiradi,
  lekin UI ham to'g'ri yashirishi shart (ikkalasi ham kerak).
- Pul summasini `number` da hisoblash — API `string` (decimal) qaytaradi, `Intl.NumberFormat`
  bilan faqat **ko'rsatiladi**; arifmetika frontendda qilinmaydi.

---

## 2. Papka tuzilmasi

```
frontend/
├─ src/
│  ├─ app/
│  │  ├─ router.tsx            # route lar + guard lar
│  │  ├─ providers.tsx         # QueryClient, i18n, theme, toaster
│  │  └─ layouts/              # AppLayout (sidebar+header), AuthLayout
│  ├─ features/                # ekran/domen bo'yicha
│  │  ├─ auth/
│  │  ├─ dashboard/
│  │  ├─ expenses/
│  │  ├─ approvals/
│  │  ├─ refunds/
│  │  ├─ edit-requests/
│  │  ├─ branches/
│  │  ├─ employees/
│  │  ├─ categories/
│  │  ├─ budgets/
│  │  ├─ reports/
│  │  ├─ exports/
│  │  ├─ currency/
│  │  ├─ users/
│  │  ├─ audit/
│  │  ├─ notifications/
│  │  ├─ settings/
│  │  └─ profile/
│  │     ├─ api.ts             # queryOptions / mutation lar
│  │     ├─ schema.ts          # zod sxemalar + tiplar
│  │     ├─ components/
│  │     └─ *Page.tsx
│  ├─ components/
│  │  ├─ ui/                   # shadcn/ui
│  │  └─ shared/               # DataTable, PageHeader, EmptyState, ConfirmDialog,
│  │                           # MoneyText, StatusBadge, FileDropzone, DateRangePicker,
│  │                           # FilterBar, ExportButton, RoleGate
│  ├─ lib/
│  │  ├─ api/client.ts         # axios + interceptor (401 → refresh → retry)
│  │  ├─ api/types.ts          # umumiy API tiplari
│  │  ├─ format.ts             # money, date, number
│  │  ├─ permissions.ts        # can(role, action)
│  │  └─ query.ts              # queryClient sozlamalari, kalit konvensiyasi
│  ├─ i18n/
│  │  ├─ index.ts
│  │  └─ locales/{uz,ru}/{common,expenses,…}.json
│  ├─ mocks/                   # msw handlerlar + fixture lar
│  ├─ styles/globals.css       # Tailwind + dizayn tokenlari
│  └─ main.tsx
├─ tests/e2e/                  # Playwright
├─ .env.example
└─ index.html
```

**Feature qoidasi:** bir feature ikkinchisining ichki fayllariga murojaat qilmaydi.
Umumiy narsa `components/shared/` yoki `lib/` ga chiqariladi.

---

## 3. Autentifikatsiya

### Oqim

1. `POST /api/auth/login` `{ login, password }` → `{ accessToken, user }`
   (refresh token **httpOnly cookie** da avtomatik o'rnatiladi — frontend ko'rmaydi)
2. `accessToken` faqat **xotirada** (Zustand store) saqlanadi. `localStorage` ga
   **yozilmaydi** (XSS xavfi).
3. Sahifa yangilanganda: `POST /api/auth/refresh` (cookie bilan) → yangi access token.
   Muvaffaqiyatsiz bo'lsa → login sahifasi.
4. axios response interceptor: `401` → bir marta `refresh` → asl so'rovni qayta yuborish.
   Refresh ham 401 bersa → store tozalanadi → `/login`.
5. `POST /api/auth/logout` → cookie o'chiriladi.

### Rol guard lari

```ts
type Role = 'PLATFORM_OWNER' | 'ADMIN' | 'DIRECTOR' | 'WORKER';
```

- `WORKER` Web ERP ga **umuman kira olmaydi** — login muvaffaqiyatli bo'lsa ham
  "Bu tizim faqat Telegram bot orqali ishlaydi" ekrani ko'rsatiladi va logout qilinadi.
- `DIRECTOR` — faqat o'z filiali. Filial tanlash selektlari uning `branchId` si bilan
  oldindan to'ldiriladi va **o'zgartirib bo'lmaydi**.
- Route guard: `<RequireRole roles={['ADMIN']}>` — mos kelmasa 403 sahifasi.
- `RoleGate` komponenti — tugma/ustun/tab darajasida yashirish.

### Login urinishlari

`429` javobida `Retry-After` sarlavhasi bo'ladi → formada taymer bilan
"15 daqiqadan keyin qayta urinib ko'ring" ko'rsatiladi, tugma bloklanadi.

---

## 4. API konvensiyalari

Base: `VITE_API_URL` (default `http://localhost:3000/api`). Barcha so'rovlar
`Authorization: Bearer <accessToken>`, `withCredentials: true`.

### Xato formati (yagona)

```ts
type ApiError = {
  statusCode: number;
  code: string;        // masalan 'RECEIPT_REQUIRED', 'PLAN_LIMIT_EXCEEDED'
  message: string;     // i18n kaliti yoki tayyor matn
  details?: Record<string, string[]>;  // maydon → xatolar (forma uchun)
};
```

- `details` bo'lsa → `react-hook-form` `setError` bilan maydonlarga tarqatiladi.
- `details` bo'lmasa → toast (destructive).
- `code` bo'yicha maxsus ishlov: `PLAN_LIMIT_EXCEEDED` → alohida dialog,
  `EXPENSE_ALREADY_PROCESSED` (409) → "Bu ariza allaqachon qayta ishlangan" + ro'yxatni yangilash.

### Ro'yxat javobi

```ts
type Paginated<T> = {
  items: T[];
  total: number;
  page: number;      // 1 dan
  limit: number;
  totalPages: number;
};
```

### Pul va sana

- Summa — **string** (`"150000.00"`). Ko'rsatish: `Intl.NumberFormat('uz-UZ')` + valyuta belgisi.
- Sana — `"2026-08-06"` (date) yoki ISO datetime (UTC). Ko'rsatish Asia/Tashkent da.
- Yuborish: date maydonlari uchun faqat `YYYY-MM-DD`.

### Query kalitlari

```ts
['expenses', 'list', filters] | ['expenses', 'detail', id] | ['reports', 'summary', params]
```

Mutatsiyadan keyin `invalidateQueries({ queryKey: ['expenses'] })` + tegishli
`['notifications']`, `['reports']`.

---

## 5. Endpointlar (frontend ishlatadigan to'liq ro'yxat)

```
POST   /auth/login              { login, password } → { accessToken, user }
POST   /auth/refresh            → { accessToken }
POST   /auth/logout
GET    /auth/me                 → User

GET    /branches                ?status=active|archived|all
POST   /branches                [ADMIN] { code, name, address?, phone?, openedAt? }
PATCH  /branches/:id            [ADMIN]  (code o'zgartirilmaydi)
POST   /branches/:id/archive    [ADMIN]

GET    /employees               ?branchId=&status=&q=&page=&limit=
POST   /employees               { fullName, position?, branchId, phone?, hiredAt?, role, email, username? }
                                → { employee, tempPassword }   // parol bir marta qaytadi
PATCH  /employees/:id
POST   /employees/:id/transfer  [ADMIN] { toBranchId }
POST   /employees/:id/reset-password  → { tempPassword }
GET    /employees/:id           → kartochka + statistika

GET    /categories              ?status=
POST   /categories              [ADMIN]
PATCH  /categories/:id          [ADMIN]

GET    /expenses                ?from=&to=&branchId=&categoryId=&employeeId=&status=
                                &minAmount=&maxAmount=&paymentMethod=&currency=&q=
                                &sort=&order=&page=&limit=
POST   /expenses
GET    /expenses/:id
PATCH  /expenses/:id            { …, reason }   // 24 soat oynasi
DELETE /expenses/:id            [ADMIN]
POST   /expenses/:id/approve
POST   /expenses/:id/reject     { reason }      // ≥10 belgi
POST   /expenses/:id/request-fix { reason }
POST   /expenses/bulk-approve   { ids[] }       // ≤20
POST   /expenses/:id/files      multipart
GET    /files/:id/url           → { url, expiresAt }

GET    /edit-requests           ?status=
POST   /edit-requests/:id/apply
POST   /edit-requests/:id/reject { reason }

GET    /refunds                 ?status=&expenseId=
POST   /refunds                 multipart { expenseId, amount, reason, files[] }
POST   /refunds/:id/approve
POST   /refunds/:id/reject      { reason }

GET    /budgets                 ?scope=&scopeId=
POST   /budgets                 [ADMIN]
PATCH  /budgets/:id             [ADMIN]

GET    /currency/rates          ?from=&to=&currency=
POST   /currency/rates          [ADMIN] { date, currency, rate }

GET    /reports/summary         ?period=&from=&to=&branchId=
GET    /reports/by-branch
GET    /reports/by-category
GET    /reports/by-employee
GET    /reports/budget-vs-actual

POST   /exports                 { type: 'E1'..'E10', format: 'xlsx'|'pdf', filters }
                                → { jobId, status }
GET    /exports/:jobId          → { status, rowCount?, downloadUrl?, error? }
GET    /exports                 → oxirgi 24 soat tarixi

GET    /notifications           ?isRead=&page=
POST   /notifications/:id/read
POST   /notifications/read-all

GET    /settings                [ADMIN]
PATCH  /settings                [ADMIN]

GET    /audit                   [ADMIN] ?from=&to=&userId=&entityType=&action=&channel=&page=
```

---

## 6. Ekranlar

Har bir ekran uchun: **kim ko'radi · asosiy elementlar · holatlar**.
Barcha ro'yxat ekranlarida majburiy holatlar: `loading` (skeleton), `empty` (illyustratsiya
+ asosiy amal tugmasi), `error` (qayta urinish tugmasi), `forbidden` (403).

### 1. Login — barchasi
Login (email yoki username) + parol + til almashtirgich. Xato: "Login yoki parol noto'g'ri"
(qaysi biri xato ekani aytilmaydi). 429 da taymer.

### 2. Dashboard — ADMIN, DIRECTOR
- KPI kartalari: jami sarf (davr), tasdiq kutayotgan 1-bosqich, 2-bosqich,
  qaytarilgan summa, byudjet bajarilishi %
- Davr tanlagich: kun / hafta / oy / chorak / yil / maxsus oraliq
- Filiallar taqqoslash (bar chart + jadval) — **faqat ADMIN**
- Kategoriyalar ulushi (donut)
- Dinamika (line, 12 oy)
- TOP-10 xodim (jadval)
- Byudjet vs Fakt (progress bar lar)
- DIRECTOR uchun barcha bloklar o'z filiali kesimida, filial selekti bloklangan

### 3. Xarajatlar ro'yxati — ADMIN, DIRECTOR
- `FilterBar`: sana oralig'i, filial, kategoriya (daraxt selekt), xodim, status (multi),
  summa oralig'i, to'lov usuli, valyuta, qidiruv (`EXP-000123` / `CHL-2026-0045` / izoh)
- Jadval ustunlari: № (ikkala raqam), sana, filial, kategoriya, xodim(lar), summa (valyuta),
  UZS ekvivalenti, to'lov usuli, status, chek belgisi, ⚠️ limit belgisi
- Ustunlarni sozlash (ko'rsatish/yashirish, tartib) — `localStorage` da saqlanadi
- Saqlanadigan filtrlar (nom bilan) — `localStorage`
- Bulk tanlash → "Tanlanganlarni tasdiqlash" (≤20), natija hisoboti dialogda
- Server-side pagination/sort. URL query bilan sinxron (`?page=2&status=APPROVED`)
- `ExportButton` → E1 (xlsx/pdf), amaldagi filtrlar bilan

### 4. Xarajat kartochkasi — ADMIN, DIRECTOR
- Sarlavha: ikkala raqam + `StatusBadge` + summa
- Bloklar: asosiy ma'lumot · taqsimlash jadvali (xodim → ulush) · chek galereyasi
  (lightbox, PDF uchun yangi tabda signed URL) · status tarixi (timeline: kim, qachon, sabab)
  · qaytarishlar ro'yxati · audit izlari (ADMIN)
- Amallar (rol va statusga qarab): Tasdiqlash · Rad etish · Tuzatish so'rash ·
  Tahrirlash (24 soat ichida, sabab majburiy) · Qaytarish yaratish · O'chirish (ADMIN)
- Tahrirlash oynasi tugagan bo'lsa tugma disabled + tooltip "Tahrirlash muddati tugagan"

### 5. Tasdiqlash navbati — ADMIN, DIRECTOR
- Ikki tab: **1-bosqich** (`DIRECTOR_PENDING`) va **2-bosqich** (`ADMIN_PENDING`, faqat ADMIN)
- Karta ko'rinishi (chek preview bilan) yoki jadval — almashtirish mumkin
- Klaviatura: `A` tasdiqlash, `R` rad etish, `←/→` navigatsiya
- Rad etish / tuzatish → sabab dialogi (≥10 belgi, hisoblagich bilan)
- Four-eyes: admin o'zi kiritgan xarajatda tugma disabled + tushuntirish
- 409 kelsa: toast + ro'yxatdan olib tashlash

### 6. Qaytarish so'rovlari — ADMIN, DIRECTOR
Ro'yxat (status tab lari) + kartochka: asl xarajat havolasi, qaytarish summasi
(to'liq/qisman belgisi), isbot fayllari, sabab, tasdiqlash tugmalari.
Yangi qaytarish yaratish formasi: xarajat qidiruvi → summa (qolgan summadan oshmaydi,
inline validatsiya) → sabab → **fayl majburiy**.

### 7. Tahrirlash murojaatlari — ADMIN, DIRECTOR
Ro'yxat + kartochka: xarajat havolasi, ishchi tavsifi, "Qo'llash" (xarajat tahrirlash
formasini ochadi, sabab avtomatik to'ldiriladi) / "Rad etish" (sabab).

### 8. Filiallar — ADMIN
Ro'yxat (status filtri) + yaratish/tahrirlash dialogi (`code` faqat yaratishda,
`^[A-Z]{2,5}$` validatsiya) + arxivlash (tasdiq dialogi).
Kartochka: xodimlar soni, joriy oy sarfi, byudjet holati, xarajatlar havolasi.
Direktori yo'q filialda ogohlantirish banneri.

### 9. Xodimlar — ADMIN, DIRECTOR
Ro'yxat (filial, status, qidiruv). Yaratish formasi → javobdagi `tempPassword`
**bir marta** modal da ko'rsatiladi (nusxalash tugmasi + "Bu parol qayta ko'rsatilmaydi"
ogohlantirishi). Parolni tiklash — tasdiq dialogi + yangi parol modal.
Kartochka: profil, bog'langan Telegram akkauntlari (faqat ko'rish), xarajat tarixi,
jami/joriy oy/qaytarilgan summalar, ko'chirish tarixi.
DIRECTOR: faqat o'z filiali, faqat `WORKER` roli yaratadi (rol selekti bloklangan).

### 10. Kategoriyalar — ADMIN
Daraxt ko'rinishi (2 daraja), drag-drop tartiblash, yaratish/tahrirlash dialogi
(nom uz/ru, `receiptRequired`, `commentRequired`, `maxAmountPerEntry`), arxivlash.
Ishlatilgan kategoriyani o'chirishga urinish → 409 → tushuntiruvchi dialog.

### 11. Byudjetlar — ADMIN
Scope tab lari (Filial / Kategoriya / Xodim). Jadval: obyekt, davr, limit, fakt,
bajarilish % (rangli progress: <80 yashil, 80–99 sariq, ≥100 qizil), amallar.
Yaratish/tahrirlash dialogi.

### 12. Hisobotlar — ADMIN, DIRECTOR
Konstruktor: hisobot turi (by-branch / by-category / by-employee / budget-vs-actual)
+ filtrlar + guruhlash → jadval + grafik. Har biri uchun eksport tugmasi (E2–E5).

### 13. Valyuta kurslari — ADMIN
Kurslar jadvali (sana, valyuta, kurs, manba), qo'lda kurs qo'shish formasi,
hisob bazasi selekti (`AUTO` / `MANUAL`) — o'zgartirish tasdiq dialogi bilan.
CBU dan olinmagan kunlar ⚠️ bilan belgilanadi.

### 14. Foydalanuvchilar va rollar — ADMIN
Ro'yxat (rol, status, oxirgi kirish), rol o'zgartirish, faollashtirish/bloklash,
parol tiklash. `PLATFORM_OWNER` ko'rinmaydi.

### 15. Audit jurnali — ADMIN
Filtrlar (sana, foydalanuvchi, obyekt turi, amal, kanal). Jadval qatorini ochganda
`changes` diff ko'rinishi (eski → yangi, rangli). E9 eksport tugmasi.
Web/Telegram kanali ikonka bilan.

### 15a. Eksportlar tarixi — ADMIN, DIRECTOR
Jadval: tur, format, filtrlar (qisqartirilgan), holat (badge + spinner), qatorlar soni,
yaratilgan vaqt, amal qilish muddati, "Yuklab olish" tugmasi.
`QUEUED`/`RUNNING` holatida **polling har 3 soniyada** (`DONE`/`FAILED` da to'xtaydi).

### 16. Sozlamalar — ADMIN
Bo'limlar: Valyuta (baza tanlovi) · Hisobot davri (boshlanish kuni 1–28) · Til (standart) ·
Bildirishnomalar (yoqish/o'chirish) · Muddatlar (eslatma soati, tahrirlash oynasi).
O'zgarish → "Saqlash" tugmasi faollashadi, saqlangach toast.

### 17. Profil — barchasi
F.I.Sh., email, rol, filial, til almashtirish, parol o'zgartirish, tema (light/dark).

### Bildirishnoma markazi (header da)
Qo'ng'iroq ikonkasi + o'qilmagan badge. Popover: oxirgi 10 ta, "Hammasini o'qilgan
deb belgilash", "Barchasini ko'rish". Polling har 30 soniyada (`GET /notifications?isRead=false`).

---

## 7. Xarajat yaratish/tahrirlash formasi (eng murakkab)

Qadamlar bitta sahifada (accordion emas, oddiy forma):

1. **Filial** — ADMIN uchun selekt, DIRECTOR uchun bloklangan (o'z filiali)
2. **Kategoriya** — daraxt selekt (faqat `ACTIVE`). Tanlangach kategoriya qoidalari
   formaga ta'sir qiladi: `receiptRequired` → fayl maydoni majburiy belgisi olади,
   `commentRequired` → izoh majburiy, `maxAmountPerEntry` → summa validatsiyasi
3. **Kim uchun** — xodimlar multi-select (filial ichidan, `ACTIVE`)
4. **Taqsimlash** — 1 kishi bo'lsa yashirin. Ko'p bo'lsa: `Teng bo'lish` / `Qo'lda`
   - Teng: avtomatik hisob, qoldiq tiyin birinchi xodimga (backend bilan bir xil qoida)
   - Qo'lda: har bir xodimga input, **jonli yig'indi indikatori** — jami summaga teng
     bo'lmaguncha "Yuborish" bloklangan, farq qizil rangda ko'rsatiladi
5. **Summa + valyuta** — raqam maskasi (mingliklar ajratilgan), 2 kasr, musbat
6. **Sana** — date picker, kelajak sanasi bloklangan
7. **To'lov usuli** — naqd / karta / o'tkazma (radio yoki segmented)
8. **Izoh** — textarea
9. **Chek/isbot** — `FileDropzone`: 1–5 fayl, ≤10 MB, jpg/png/webp/pdf.
   Preview thumbnail, o'chirish, yuklash progress bar

**Yuborishdan oldin:** dublikat ogohlantirishi kelsa (backend javobida `duplicateWarning`)
→ tasdiq dialogi "Shunga o'xshash xarajat 10 daqiqa oldin kiritilgan. Davom etasizmi?"

**Yuborilgandan keyin:** javobda `budgetWarning` bo'lsa → sariq toast
"Filial oylik limitining 92% i ishlatildi".

**Tahrirlash rejimida:** qo'shimcha majburiy **sabab** maydoni (≥10 belgi) va
"O'zgarishlar audit jurnaliga yoziladi" ogohlantirishi.

---

## 8. Validatsiya (zod, backend bilan bir xil)

| Maydon | Qoida |
|---|---|
| `login` | bo'sh emas |
| `password` | ≥8 belgi |
| `amount` | > 0, ≤ 2 kasr, `maxAmountPerEntry` dan oshmaydi |
| `date` | ≤ bugun |
| `reason` (rad etish/tahrirlash) | ≥10 belgi |
| `branch.code` | `^[A-Z]{2,5}$` |
| `email` | RFC email |
| `phone` | `+998XXXXXXXXX` (ixtiyoriy maydon) |
| `files` | 1–5 ta, har biri ≤10 MB, MIME: jpg/png/webp/pdf |
| `shares` | yig'indi === `amount` (aniq tenglik, string decimal taqqoslash) |
| `refund.amount` | > 0, ≤ xarajatning qolgan summasi |
| `reportPeriodStartDay` | 1–28 |

Xato matnlari i18n kalitlari orqali (`validation.amount.positive` va h.k.).

---

## 9. i18n

- Standart til: `uz`. Almashtirish: header + profil + login sahifasi.
- Tanlov `localStorage` + `PATCH /settings` emas, foydalanuvchi profili orqali saqlanadi.
- Namespace lar: `common`, `auth`, `expenses`, `approvals`, `refunds`, `org`, `reports`,
  `settings`, `audit`, `validation`, `errors`.
- **Ruscha matn o'zbekchadan ~15–20% uzunroq** — tugma va ustun kengliklari
  matn bo'yicha moslashuvchan bo'lishi shart (fixed width taqiqlanadi).
- Sana/son formatlari `Intl` orqali, tilga bog'liq.
- Backend xato `message` i i18n kaliti bo'lsa (`errors.*`) — tarjima qilinadi,
  bo'lmasa matn o'zi ko'rsatiladi.

---

## 10. Mock rejimi (backendsiz ishlash)

`VITE_USE_MOCK=true` bo'lganda `msw` ishga tushadi. Talab:

- Har bir endpoint uchun handler + realistik fixture (2 kompaniya emas — bitta,
  10 filial, 50 xodim, 300 xarajat, turli statuslar)
- Sekinlik simulyatsiyasi (300–800 ms) — skeleton lar test qilinishi uchun
- Xato stsenariylari: `?mockError=403|409|422|429|500` query bilan majburlash
- Mock ma'lumot **backend seed i bilan mos** bo'lishi kerak (bir xil kategoriyalar,
  bir xil filial kodlari) — backend ulanganda ekran buzilmaydi

---

## 11. Ishlash talablari (TZ 4.1)

- Xarajatlar ro'yxati (100 qator sahifada) — ilk render ≤ 1 s (mock/local API bilan)
- Dashboard grafiklar — `React.lazy` bilan alohida chunk
- Route lar `lazy` yuklanadi; boshlang'ich bundle ≤ 250 KB gzip
- Jadval — virtualizatsiya **shart emas** (server pagination bor), lekin
  `React.memo` + barqaror `columns` massivi majburiy
- Rasm/chek — lazy load, thumbnail

---

## 12. Tayyorlik ta'rifi (frontend DoD)

- [ ] `npm run build` + `tsc --noEmit` + `lint` toza
- [ ] Barcha 17 ekran ishlaydi, 4 holat (loading/empty/error/forbidden) qamrab olingan
- [ ] Rollar bo'yicha UI to'g'ri cheklanadi (ADMIN / DIRECTOR uchun alohida tekshiruv)
- [ ] Hardcode matn yo'q — `uz` va `ru` to'liq, til almashtirilganda hamma joy tarjima bo'ladi
- [ ] Klaviatura navigatsiyasi asosiy formalarda ishlaydi, fokus ko'rinadi
- [ ] Rang kontrasti WCAG AA (light va dark)
- [ ] Responsive: ≥1280 to'liq, 768–1279 moslashgan (sidebar yig'iladi), <768 asosiy
      ekranlar ishlaydi (jadvallar gorizontal scroll)
- [ ] Vitest: `lib/`, `permissions`, forma sxemalari, taqsimlash hisobi uchun testlar
- [ ] Playwright e2e: login → xarajat yaratish → tasdiqlash → qaytarish → eksport
- [ ] Xato holatlari: 401 refresh, 403, 409 (allaqachon qayta ishlangan), 422 (maydon
      xatolari), 429 (taymer), 500 (toast) — hammasi to'g'ri ko'rsatiladi
- [ ] `.env.example` to'liq

---

## 13. Muhit o'zgaruvchilari

```
VITE_API_URL=http://localhost:3000/api
VITE_USE_MOCK=false
VITE_DEFAULT_LANGUAGE=uz
VITE_TIMEZONE=Asia/Tashkent
VITE_SENTRY_DSN=
```

Backend dev serveri **3000** portda, frontend **5173**. CORS backendda
`WEB_URL` orqali sozlangan, `credentials: true`.
