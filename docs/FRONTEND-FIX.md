# Frontend ni tuzatish va API larga ulash rejasi

Manba: [`FRONTEND-TZ.md`](FRONTEND-TZ.md) (nima bo'lishi kerak), [`API.md`](API.md)
(backend haqiqatda nima beradi), [`ROADMAP.md`](ROADMAP.md) (S0–S17 bajarilgan ish).

Bu hujjat **frontend ni ishlaydigan holatga keltirish** uchun: build ni tiklash,
API chaqiruvlarini haqiqiy backendga ulash, yetishmayotgan amallarni qo'shish.
Bosqichlar `F1…F6` deb belgilangan va ketma-ket bajariladi — har biri o'zidan
oldingisiga tayanadi.

---

## 0. Hozirgi holat (o'lchangan, 2026-08-12)

| Tekshiruv | Natija |
|---|---|
| `npm run build` (`tsc -b && vite build`) | **89 ta TS xatosi**, build to'xtaydi |
| `npx vite build` (faqat bundling) | ✅ o'tadi (1.08 MB bundle) |
| `npm run lint` (oxlint) | **14 error** (`rules-of-hooks`), 25 warning |
| `npx vitest run` | 1 fayl yiqiladi (Playwright spec vitest ga tushgan), 4 test o'tadi |
| Backendda **yo'q** endpointga murojaat | 5 joy (dashboard ×2, reports, currencies ×2) |
| Mock/yashirilgan ma'lumot | 2 joy (`exports`, `notifications`) |
| `any` ishlatilgan joy | 50 |

**Asosiy xulosa:** frontend `vite dev` da "ishlaydi" ko'rinadi, chunki `vite` tiplarni
tekshirmaydi. Tiplar tekshirilganda 89 xato chiqadi, ulardan **28 tasi bitta yo'q
fayl** (`vite-env.d.ts`) tufayli. Ishga tushirilganda esa Dashboard, Hisobotlar va
Valyuta bo'limlari **404 oladi** — ular hech qachon backendga mos kelmagan.

Xatolar sinflari:

| Kod | Soni | Sababi |
|---|---|---|
| `TS6133` / `TS6192` | 52 | ishlatilmagan import/o'zgaruvchi (`noUnusedLocals: true`) |
| `TS2307` / `TS2882` | 28 | `*.module.css`, `globals.css` va `import.meta.env` uchun tip deklaratsiyasi yo'q |
| `TS2322` | 5 | 3 ta `Badge variant="secondary"` (bunday variant yo'q) + 2 ta RHF resolver |
| `TS2345` | 2 | `handleSubmit` va zod chiqish tipi mos kelmaydi |
| `TS2339` | 2 | `import.meta.env` |

---

## F1 — Build ni tiklash (faqat tip qatlami, xatti-harakat o'zgarmaydi)

### F1.1 `src/vite-env.d.ts` yaratish → 28 xato yopiladi

Fayl umuman yo'q. Vite loyihalarida shu fayl `*.css`, `*.module.css`, `*.svg` va
`import.meta.env` tiplarini olib keladi.

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

`ImportMetaEnv` ni qo'lda e'lon qilish sababi: `VITE_API_URL` yo'q bo'lsa ham kod
`|| 'http://localhost:3000/api'` bilan ishlaydi, ya'ni maydon **ixtiyoriy** bo'lishi
kerak; `vite/client` ning umumiy tipi buni ko'rsatmaydi.

Ta'sir qiladigan fayllar (o'zgartirish shart emas, xato o'z-o'zidan yopiladi):
`src/main.tsx`, `src/lib/api/client.ts`, barcha `*.module.css` import qiladigan 22 komponent.

### F1.2 Ishlatilmagan importlarni tozalash → 52 xato

React 19 + `jsx: "react-jsx"` da `import React from 'react'` **kerak emas**. Tozalash
kerak bo'lgan fayllar (har birida 1–6 ta):

```
src/features/dashboard/components/Charts.tsx        (6)
src/features/employees/EmployeesPage.tsx            (3)
src/features/auth/components/LoginForm.tsx          (2: React, getValues)
src/features/categories/CategoriesPage.tsx          (2: React, refetch)
src/features/expenses/components/ExpenseForm.tsx    (2: append, remove)
src/features/refunds/components/RefundForm.tsx      (2)
src/components/shared/RequireRole.tsx               (2)
src/features/expenses/ExpenseDetailsPage.tsx        (butun import satri)
+ 12 fayl × 1 ta (React yoki `t`)
```

**Diqqat:** `ExpenseForm.tsx` dagi `append`/`remove` — bu shunchaki "ishlatilmagan
o'zgaruvchi" emas: guruh xarajatida ulushlarni qo'lda tahrirlash **yozilmagan**
(F4.2 ga qarang). Ularni o'chirish emas, ishlatish kerak.

### F1.3 `Badge variant="secondary"` → 3 xato

`Badge` ning API si yopiq: `neutral | success | warning | destructive | info`.
`secondary` variantini qo'shish emas, chaqiruvlarni to'g'rilash kerak — dizayn
tokenlari `globals.css` da shu besh holat uchun aniqlangan:

| Fayl | Hozir | Bo'lishi kerak |
|---|---|---|
| `BranchesPage.tsx:90` | `variant={b.status === 'ACTIVE' ? 'default' : 'secondary'}` | `'success'` / `'neutral'` |
| `EmployeesPage.tsx:102` | `'secondary' \| 'default'` | `'success'` / `'neutral'` |
| `CategoriesPage.tsx:67` | `variant="secondary"` ("Chek kerak") | `'info'` |

`Button` da `variant="secondary"` **to'g'ri** (u tugmada mavjud) — tegilmaydi.

### F1.4 react-hook-form + zod: kirish/chiqish tipi → 4 xato

`CategoryFormDialog.tsx` va `settings/components/CategoryForm.tsx` da zod sxemasida
`.default(false)` bor: **kirish**da maydon ixtiyoriy, **chiqish**da majburiy. Bitta
generik bilan `useForm` ikkalasini ifodalay olmaydi.

```ts
// noto'g'ri (hozir):
const { control, handleSubmit } = useForm<CategoryFormData>({
  resolver: zodResolver(categorySchema),
});

// to'g'ri:
type CategoryFormInput = z.input<typeof categorySchema>;
type CategoryFormData = z.output<typeof categorySchema>;

const { control, handleSubmit } = useForm<CategoryFormInput, unknown, CategoryFormData>({
  resolver: zodResolver(categorySchema),
  defaultValues: { receiptRequired: false, commentRequired: false },
});
```

Shu qoida barcha formalarga qo'llanadi (`schema.ts` fayllarida `.default()` bo'lsa).
Alternativa — sxemadan `.default()` ni olib tashlab, `defaultValues` ga ko'chirish;
lekin u holda backend uchun majburiy maydon "ixtiyoriy" bo'lib qoladi, shuning uchun
yuqoridagi variant tanlanadi.

### F1 qabul mezoni

- `npm run build` → 0 xato, `dist/` yasaladi.
- Hech bir faylga `@ts-ignore` yoki `as any` **qo'shilmaydi** (mavjudlari F5 da kamayadi).

---

## F2 — Lint va React hooks qoidalari

### F2.1 `rules-of-hooks` buzilishi → 14 error

**`src/features/settings/SettingsPage.tsx`** — komponent boshida rol tekshiruvi bor:

```tsx
const { user } = useAuthStore();
if (user?.role !== 'ADMIN' && user?.role !== 'PLATFORM_OWNER') {
  return <Navigate to="/" />;      // ← shundan keyin 9 ta hook chaqiriladi
}
const [activeTab, setActiveTab] = useState(...);
```

Bu React ning qat'iy qoidasini buzadi va rol o'zgarganda ilova qulashi mumkin.
Tuzatish: **inline guard olib tashlanadi** — marshrut allaqachon
`RequireRole roles={['ADMIN']}` bilan o'ralgan (`router.tsx:78`), ya'ni tekshiruv
ikki joyda takrorlangan. `PLATFORM_OWNER` ham kerak bo'lsa, `RequireRole` ga
qo'shiladi.

**`src/features/approvals/components/ExpenseDetailModal.tsx`** — shartli hooklar;
`if (!expenseId) return null` dan keyin `useQuery` chaqirilgan. Tuzatish: `useQuery`
ni yuqoriga ko'chirib, `enabled: !!expenseId` bilan boshqarish.

### F2.2 Warninglar (25)

- 20 × ishlatilmagan o'zgaruvchi (F1.2 bilan ustma-ust tushadi);
- 5 × `exhaustive-deps` — `useEffect` bog'liqliklari to'liq emas. Har birini ko'rib
  chiqish kerak: bog'liqlik qo'shish yoki (agar ataylab bo'lsa) izoh bilan
  `// eslint-disable-next-line` qoldirish.

### F2 qabul mezoni

- `npm run lint` → 0 error, 0 warning.

---

## F3 — API chaqiruvlarini haqiqiy backendga ulash

### F3.1 Umuman mavjud bo'lmagan endpointlar

| Frontend hozir chaqiradi | Holat | Backendda haqiqatda |
|---|---|---|
| `GET /dashboard/stats` | ❌ 404 | `GET /reports/summary` |
| `GET /dashboard/charts` | ❌ 404 | `GET /reports/dynamics`, `GET /reports/by-category`, `GET /reports/by-branch` |
| `GET /reports` (bitta, `?type=`) | ❌ 404 | `GET /reports/by-branch \| by-category \| by-employee \| budget-vs-actual` |
| `GET /currencies` | ❌ 404 | `GET /currency/rates`, `GET /currency/rates/current` |
| `POST /currencies` | ❌ 404 | `POST /currency/rates` |

**Qaror:** backendga `dashboard` yoki umumiy `reports` endpointi **qo'shilmaydi** —
TZ 5.4 da ular yo'q, `/reports/*` esa kesimlarni allaqachon beradi. Frontendda
`useDashboardStats`/`useDashboardCharts` **adapter hooklar** bo'lib qoladi: bir
nechta `/reports/*` so'rovini yig'ib, sahifaga kerakli shaklga aylantiradi.

Dashboard maydonlari qanday to'ldiriladi (`SummaryReport` dan):

| Sahifadagi maydon | Manba |
|---|---|
| `stats.totalExpense` | `summary.totalUzs` |
| `stats.pending1` | `summary.pendingDirectorCount` |
| `stats.pending2` | `summary.pendingAdminCount` |
| `stats.budgetPercent` | `GET /reports/budget-vs-actual` → `usedPercent` (eng yuqorisi yoki umumiy) |
| `charts.dynamics` | `GET /reports/dynamics?granularity=month` |
| `charts.categories` | `GET /reports/by-category` |
| — (yangi) `charts.branches` | `GET /reports/by-branch` (TZ 6.2 da bar chart talab qilinadi) |

### F3.2 Xarajat yaratish — so'rov shakli xato

`src/features/expenses/api.ts` → `useCreateExpense` hozir shunday yuboradi:

```ts
formData.append('data', JSON.stringify(data));   // ← backend bunday maydonni bilmaydi
files.forEach(f => formData.append('files', f));
await apiClient.post('/expenses', formData);     // ← 422 VALIDATION_FAILED
```

Backend ikki qadamni kutadi (`expenses.controller.ts`):

1. `POST /expenses` — **JSON** `CreateExpenseDto`:
   `{ branchId, categoryId, employeeIds[], amount, currency, date, comment?, paymentMethod, shares? }`
2. `POST /expenses/:id/files` — **multipart**, `files` maydoni (≤5 fayl, ≤10 MB)
3. Chek majburiy kategoriyada yozuv `DRAFT` bo'lib yaratiladi → fayl biriktirilgach
   `POST /expenses/:id/submit` chaqirilishi kerak (bot aynan shunday qiladi).

Bundan tashqari `src/features/expenses/schema.ts` da:

- **`currency` yo'q** — backend uchun majburiy (`UZS | USD`);
- **`comment` yo'q**, o'rniga `reason` bor — `reason` faqat **tahrirlash**da
  (`PATCH /expenses/:id`) kerak, yaratishda `comment` yuboriladi;
- `paymentMethod` qiymatlari to'g'ri (`CASH | CARD | TRANSFER`).

### F3.3 Yashirilgan xatolar va mock ma'lumot

**`src/features/exports/api.ts`** — `catch` ichida ikki qator soxta eksport
qaytariladi ("Mocking for now as it's not ready in real backend yet"). Backend S13 da
tayyor: `GET /exports` → `Paginated<ExportJobView>`. Mock olib tashlanadi.

**`src/features/notifications/api.ts`** — `catch (e) { return [] }` xatoni butunlay
yashiradi: token eskirgan bo'lsa ham foydalanuvchi "bildirishnoma yo'q" deb ko'radi.
`try/catch` olib tashlanadi, `data.items` ishlatiladi.

### F3.4 Javob shakllari

Backend ro'yxatlarni **`Paginated<T>`** (`{ items, total, page, limit, totalPages }`)
qaytaradi. Istisnolar:

| Endpoint | Shakl |
|---|---|
| `GET /categories` | `CategoryView[]` — **daraxt** (2 daraja, `children[]`) |
| `GET /currency/rates` | `RateView[]` |
| `GET /budgets/usage` | `BudgetUsageView[]` |
| `GET /reports/*` | obyekt yoki massiv (kesimga qarab) |
| `GET /exports/types` | `ExportDefinition[]` |
| `GET /audit/facets` | `{ actions: string[]; entityTypes: string[] }` |

Hozir kodda `response.data.items || response.data` shaklidagi "ikki tomonga
ishlaydigan" fallbacklar bor (`expenses/api.ts`, `notifications/api.ts`) — ular
mock davridan qolgan. Ular olib tashlanadi va **bir shakl** qoldiriladi, aks holda
sahifa qaysi shakl kelganini bilmasdan ishlaydi.

### F3.5 Tuzilma: `src/lib/api/`

Yangi fayllar:

- **`src/lib/api/types.ts`** — backend `*View` interfeyslarining ko'zgusi
  (`ExpenseView`, `BranchView`, `EmployeeView`, `CategoryView`, `RefundView`,
  `EditRequestView`, `BudgetView`, `RateView`, `NotificationView`, `ExportJobView`,
  `SummaryReport`, `GroupedRow`, `Paginated<T>`, `ApiError`).
  Qo'lda yoziladi: backendda OpenAPI/Swagger yo'q, generator qo'shish alohida ish.
  Har bir tip yonida manba fayl izohda ko'rsatiladi (`backend/src/modules/...`).
- **`src/lib/api/endpoints.ts`** — yo'llar bitta joyda (`EXPENSES = '/expenses'` …),
  shunda `/dashboard/stats` kabi mavjud bo'lmagan yo'l ikkinchi marta paydo bo'lmaydi.

### F3 qabul mezoni

- Har bir `apiClient.*` chaqiruvi `API.md` dagi endpointga to'g'ri keladi
  (tekshirish: `grep -rn "apiClient\." src | ...` ro'yxati bilan solishtirish).
- Hech bir `api.ts` da `catch` ichida soxta ma'lumot qaytarilmaydi.
- `any` faqat `unknown` ga aylantirib bo'lmaydigan joyda qoladi (maqsad: ≤5).

---

## F4 — Yetishmayotgan amallar va ekranlar (TZ 6 bo'yicha)

TZ 6 da 17 ekran sanab o'tilgan. Marshrutlar 15 tasi uchun bor, lekin ichidagi
amallar to'liq emas. Quyidagi ro'yxat — **ulanmagan** backend imkoniyatlari.

### F4.1 Xarajat kartochkasi (TZ 6.4)

| Amal | Endpoint | Holat |
|---|---|---|
| Kartochkani ochish | `GET /expenses/:id` | ❌ yo'q |
| Tahrirlash (24 soat oynasi, sabab majburiy) | `PATCH /expenses/:id` | ❌ yo'q |
| O'chirish (ADMIN) | `DELETE /expenses/:id` | ❌ yo'q |
| Qoralamani yuborish | `POST /expenses/:id/submit` | ❌ yo'q |
| Tuzatish so'rash | `POST /expenses/:id/request-fix` | ❌ yo'q (`approve`/`reject` bor) |
| Bekor qilish (kiritgan shaxs) | `POST /expenses/:id/cancel` | ❌ yo'q |
| Fayl qo'shish / o'chirish | `POST /expenses/:id/files`, `DELETE /expenses/:id/files/:fileId` | ❌ yo'q |
| Chekni ko'rish (signed URL) | `GET /files/:id/url` | ❌ yo'q |

### F4.2 Xarajat formasi (TZ 7)

- **Guruh uchun qo'lda taqsimlash yozilmagan** — `useFieldArray` chaqirilgan, lekin
  `append`/`remove` ishlatilmaydi (F1.2). Sxemada `shares` bor va yig'indi tekshiruvi
  ham bor, ya'ni faqat UI qismi yetishmaydi.
- Valyuta tanlash yo'q (F3.2).
- Kategoriya qoidalari (`receiptRequired`, `commentRequired`, `maxAmountPerEntry`)
  formada ishlatilmaydi — TZ 7 ularni **kategoriya tanlangach darhol** qo'llashni
  talab qiladi (chek majburiy bo'lsa Dropzone majburiy bo'ladi va h.k.).

### F4.3 Boshqa modullar

| Ekran | Ulanmagan endpoint |
|---|---|
| Filiallar | `POST /branches/:id/restore` |
| Kategoriyalar | `POST /categories/:id/archive`, `/restore`, `DELETE /categories/:id` |
| Xodimlar | `GET /employees/:id` (kartochka), `GET /employees/:id/transfers` (tarix) |
| Byudjetlar | `GET /budgets/usage` (sarf/limit), `PATCH /budgets/:id`, `DELETE /budgets/:id` |
| Valyuta | `GET /currency/rates`, `/rates/current`, `POST /currency/rates`, `GET/POST /currency/base` |
| Sozlamalar | `GET /settings`, `PATCH /settings` — **umuman ulanmagan** |
| Audit | `GET /audit/facets` (filtr ro'yxatlari) |
| Eksportlar | `GET /exports/types`, `GET /exports/:id`, `GET /exports/:id/download` |
| Bildirishnomalar | `GET /notifications/unread-count`, `POST /notifications/:id/read` |
| Profil | `GET /auth/me`, til o'zgartirish (`PATCH /settings` emas — profil tili `User.language`) |
| Qaytarishlar | `GET /refunds/:id` (kartochka) |

**Diqqat:** "Sozlamalar" sahifasi hozir kompaniya sozlamalarini emas, ma'lumotnoma
jadvallarini (filial/xodim/kategoriya/byudjet/valyuta) ko'rsatadi. TZ 6.16 esa
`GET/PATCH /settings` (valyuta bazasi, hisobot davri, ish kunlari, eslatma vaqti,
tahrirlash oynasi) uchun alohida ekran talab qiladi. Ikkisi ajratiladi:
`/settings` — kompaniya sozlamalari, ma'lumotnomalar esa o'z sahifalarida
(`/branches`, `/employees`, `/categories`, `/budgets`, `/currency`).

### F4.4 Ikki nusxadagi formalar

Bir xil ish uchun ikki komponent to'plami mavjud:

```
src/features/settings/components/{BranchForm,CategoryForm,EmployeeForm,BudgetForm,CurrencyForm}.tsx
src/features/{branches,categories,employees}/components/*FormDialog.tsx
```

`SettingsPage` birinchisini, alohida sahifalar ikkinchisini ishlatadi. **Bittasi
qoldiriladi** (`features/<modul>/components/*FormDialog.tsx`), `settings/components/*`
o'chiriladi — F4.3 dagi ajratishdan keyin ular baribir kerak bo'lmaydi.

### F4 qabul mezoni

- TZ 6 dagi har bir ekran uchun amallar ro'yxati bajarilgan yoki hujjatda
  "doiraga kirmaydi" deb belgilangan.
- `src/features/settings/components/` katalogi yo'q.
- Bir xil ma'lumot uchun ikkita chaqiruv qoldirilmaydi (bitta `queryKey`).

---

## F5 — Xato va i18n konvensiyalari (S17 dan keyingi holat)

Backend S17 da o'zgardi, frontend hali eski shaklga qarab yozilgan.

### F5.1 `details` endi maydon bo'yicha keladi

```jsonc
{ "statusCode": 422, "code": "VALIDATION_FAILED",
  "message": "Kiritilgan ma'lumot noto'g'ri",
  "details": { "code": ["Filial kodi 2–5 ta lotin harfidan iborat bo'lishi kerak"],
               "shares.0.amount": ["Summa noto'g'ri formatda"] } }
```

Kerak: umumiy yordamchi `src/lib/api/formErrors.ts` — `details` ni RHF ning
`setError(field, { message })` ga o'girish; ichma-ich yo'llar (`shares.0.amount`)
RHF nomlash bilan bir xil, ya'ni to'g'ridan-to'g'ri mos keladi.

### F5.2 `code` bo'yicha maxsus ishlov

`src/lib/api/client.ts` da hozir `EXPENSE_ALREADY_PROCESSED` tekshiriladi — bunday
kod backendda **yo'q**, to'g'risi `ALREADY_PROCESSED`. Ro'yxatni to'g'rilash va
kengaytirish kerak:

| Kod | Ishlov |
|---|---|
| `MULTIPLE_COMPANIES` | login formasida kompaniya tanlash (allaqachon bor) |
| `ALREADY_PROCESSED` | ro'yxatni yangilash + xabar |
| `PLAN_LIMIT_EXCEEDED` | alohida modal ("tarif limiti") |
| `EDIT_WINDOW_CLOSED` | tahrirlash formasini yopish, tuzatish so'rashni taklif qilish |
| `RECEIPT_REQUIRED` / `COMMENT_REQUIRED` | mos maydonga fokus |
| `WEB_ACCESS_DENIED` | login sahifasida "botdan foydalaning" |

### F5.3 Matnlar

Server `message` ni **tarjima qilib** qaytaradi (`x-lang` yuboriladi — bu allaqachon
ulangan), shuning uchun frontendda xato matnini takrorlash kerak emas. Lekin
sahifalarda hali hardcode o'zbekcha matnlar bor (jadval sarlavhalari, tugmalar,
bo'sh holat matnlari). TZ 9: barcha matn i18n orqali. Hozir 6 ta namespace bor
(`common`, `refunds`, `editRequests`, `settings`, `reports`, `audit`) — yetishmaydi:
`expenses`, `approvals`, `branches`, `employees`, `categories`, `budgets`,
`exports`, `notifications`, `auth`, `dashboard`.

### F5 qabul mezoni

- Validatsiya xatosi forma maydonlarida ko'rinadi (toast emas).
- `grep -rn "'[A-Z_]*ALREADY" src` — faqat backend kodlariga mos nomlar.
- Sahifalarda o'zbekcha/ruscha satr literal qolmaydi (i18n kaliti).

---

## F6 — Testlar

### F6.1 `vitest` va Playwright ni ajratish

`npx vitest run` hozir `e2e/expense-flow.spec.ts` ni ham yuklashga urinadi va
yiqiladi. `vitest.config.ts` ga:

```ts
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/setupTests.ts'],
  exclude: ['e2e/**', 'node_modules/**'],
}
```

### F6.2 Unit testlar (vitest + Testing Library)

Hozir bittasi bor (`src/lib/distribution.test.ts`, 4 test). Qo'shilishi kerak:

- `formErrors` — `details` → RHF `setError` o'girish;
- dashboard adapteri — `/reports/*` javoblaridan sahifa maydonlariga aylantirish;
- `ExpenseForm` — kategoriya qoidalari (chek majburiy bo'lsa yuborish bloklanadi),
  ulushlar yig'indisi tekshiruvi;
- [x] **F4.1 Expense Card (TZ 6.4):** Tasdiqlash/qaytarish/bekor qilish (approvals va o'zining view'sida) — `ExpenseDetailsPage` qayta yozildi.
- [x] **F4.2 Xarajat Yaratish (TZ 6.3):** Guruh uchun qo'lda taqsimlash formasi va kategoriya qoidalari (chek, izoh) ishlamoqda.
- [x] **F4.3 Boshqa modullar:** Budgets va Currency uchun page'lar yaratildi, Settings formalar ajratildi.

## 5. F5 — Error Handling & I18N (Yakunlangan)
- [x] **F5.1 Xatolik formasi:** `handleFormErrors` orqali 422 xatolar `react-hook-form` fieldlariga to'g'ri map qilinadi.
- [x] **F5.2 Maxsus xatolar:** `client.ts` interceptorida `ALREADY_PROCESSED`, `PLAN_LIMIT_EXCEEDED` va hokazolar ushlanadi.

## 6. F6 — Testlar (Yakunlangan)
- [x] **F6.1 Config:** Vitest va Playwright bir-biridan ajratildi (e2e papka exclude qilindi).
- [x] **F6.2 Unit tests:** `formErrors.test.ts` va boshqalar yozildi.
- [x] **F6.3 E2E:** `expense-flow.spec.ts` test-case lari yozildi, va configda ma'lumot ko'rsatildi.

### F6 qabul mezoni

- `npx vitest run` → barcha fayllar o'tadi.
- `npx playwright test` → oqim testi haqiqatan tekshiradi (`.catch(() => {})` yo'q).

---

## Bajarish tartibi va tekshiruv nuqtalari

| Bosqich | Nima | Qabul mezoni |
|---|---|---|
| **F1** | `vite-env.d.ts`, ishlatilmagan importlar, Badge variant, RHF generiklari | `npm run build` yashil |
| **F2** | hooks qoidalari, lint warninglari | `npm run lint` yashil |
| **F3** | `lib/api/{types,endpoints}.ts`, dashboard/reports/currency adapterlari, xarajat yaratish ikki qadam, mocklarni olib tashlash | har bir chaqiruv `API.md` ga mos; sahifalar 404 olmaydi |
| **F4** | yetishmagan amallar va ekranlar, formalarni birlashtirish | TZ 6 ro'yxati bo'yicha o'tish |
| **F5** | `details` → forma, `code` ishlovi, i18n namespace lari | validatsiya maydonda ko'rinadi, literal matn yo'q |
| **F6** | vitest/playwright ajratish, yangi testlar | `vitest` va `playwright` yashil |

F1 va F2 ni **birinchi** qilish shart: ular tugagach `tsc` boshqa o'zgarishlarda
xatoni darhol ko'rsatadi. F3 dan keyin ilova haqiqiy ma'lumot bilan ishlaydi, ya'ni
F4 ni qo'lda tekshirish mumkin bo'ladi.

---

## Qabul mezoni (butun ish uchun)

1. `npm run build`, `npm run lint`, `npx vitest run` — uchtasi yashil.
2. `docker compose up -d` + backend + `npm run dev` bilan: Dashboard, Xarajatlar,
   Tasdiqlash, Qaytarishlar, Tahrirlash murojaatlari, Hisobotlar, Filiallar,
   Xodimlar, Kategoriyalar, Byudjetlar, Valyuta, Audit, Eksportlar, Sozlamalar,
   Profil — **hech biri 404 yoki bo'sh mock ko'rsatmaydi**.
3. Xarajat yaratish oqimi web dan ishlaydi: chek majburiy kategoriyada fayl
   biriktirilmasa yuborishga ruxsat bermaydi, biriktirilgach ariza direktorga tushadi.
4. Validatsiya xatosi mos maydon ostida chiqadi; server xabari so'rov tilida.
5. Rol bo'yicha: ishchi web ga umuman kira olmaydi (`WEB_ACCESS_DENIED`), direktor
   faqat o'z filialini ko'radi, audit va sozlamalar faqat adminda.
6. Ikkita til: interfeys va server xabarlari `uz`/`ru` da to'liq.

---

## Qarorlar va risklar

- **Backendga yangi endpoint qo'shilmaydi.** Dashboard va hisobot ekranlari mavjud
  `/reports/*` ustiga adapter bilan quriladi — TZ 5.4 da `dashboard` endpointi yo'q
  va uni qo'shish bir xil ma'lumotni ikki joyda hisoblash degani.
- **Tiplar qo'lda ko'chiriladi** (`lib/api/types.ts`). Generator (OpenAPI → TS) yo'q,
  chunki backendda Swagger sxemasi yig'ilmagan. Generator qo'shish alohida ish sifatida
  S18 dan keyin ko'riladi; hozir qo'lda ko'zgu yetarli, chunki `*View` interfeyslari
  barqaror va ular yonida manba fayl izohda ko'rsatiladi.
- **`Badge` API si o'zgarmaydi** — yangi variant qo'shish o'rniga chaqiruvlar mavjud
  beshta holatga moslanadi, aks holda dizayn tokenlari cheksiz o'sadi.
- **Eng katta xavf — javob shakllari.** Hozirgi `data.items || data` fallbacklari
  qaysi shakl kelganini yashiradi; ularni olib tashlaganda ba'zi sahifalar
  "ma'lumot yo'q" holatiga tushishi mumkin. Shu sababli F3 bosqichi modul-modul
  bajariladi va har modul brauzerda tekshiriladi.
- **`ExpenseForm` eng murakkab qism** (TZ 7): kategoriya qoidalari, guruh
  taqsimlash, valyuta, fayl yuklash va `submit` qadami. Uni F4 ning oxirida, qolgan
  hammasi ishlagandan keyin qilish kerak.
