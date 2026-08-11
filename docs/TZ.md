# TZ: Xarajatlar Boshqaruvi Tizimi (Web ERP + Telegram Bot)
Versiya: 5 | Sana: 2026-08-08 | Holat: approved

---

## 1. Maqsad va doira

### 1.1 Muammo

Kompaniyada 4–5 va undan ortiq filial mavjud. Ishchilar uchun qilinadigan xarajatlar
(rasxodlar) Excel/qog'ozda yuritiladi. Natijada:

- Ma'lumot tarqoq va kechikib keladi
- Har bir ishchiga qancha pul sarflangani noaniq
- Filiallar o'rtasida taqqoslash imkoni yo'q
- Xarajat isboti (chek, kvitansiya) saqlanmaydi yoki yo'qoladi
- Rahbariyat real vaqtda umumiy manzarani ko'ra olmaydi
- Qaytarilgan tovar/xizmat bo'yicha pul qaytimi hech qayerda qayd etilmaydi

### 1.2 Doiraga kiradi

| # | Komponent | Foydalanuvchilar | Vazifasi |
|---|---|---|---|
| 1 | **Web ERP** | Bosh (super) admin, Filial direktori | Boshqaruv, tasdiqlash, hisobotlar, sozlamalar |
| 2 | **Telegram bot** | Ishchi, Filial direktori, Bosh admin | Xarajat kiritish, chek yuklash, tasdiqlash, murojaatlar |
| 3 | **Backend API** | — | Biznes-logika, RBAC, fayl saqlash, navbatlar |

Modullar: Auth/RBAC, Filiallar, Xodimlar, Kategoriyalar, Xarajatlar (yadro),
Ikki bosqichli tasdiqlash, Tahrirlash so'rovlari, **Qaytarish (refund)**, Byudjet/limitlar,
Bildirishnomalar, Hisobot va analitika, Eksport (Excel/PDF), Audit jurnali, Valyuta kurslari.

### 1.3 Doiraga KIRMAYDI

Quyidagilar ushbu TZ doirasiga kirmaydi va alohida kelishiladi:

- Buxgalteriya tizimlari (1C va h.k.) bilan integratsiya
- Ish haqi (oylik) hisoblash moduli
- Bank / to'lov tizimlari bilan integratsiya, real pul ko'chirish
- Mobil ilova (iOS/Android native)
- OCR — chekdagi summani avtomatik o'qish
- Kirim (daromad) hisobi — tizim faqat **chiqim** va uning **qaytimi** bilan ishlaydi
- **Email bildirishnomalar** — faqat Telegram va Web ichki bildirishnomalari
- **Excel/eski ma'lumotlarni import qilish** — tizim toza ma'lumot bilan boshlanadi
- Ombor / inventarizatsiya hisobi (qaytarilgan tovar ombor hisobida yuritilmaydi)
- SSO / LDAP / Active Directory integratsiyasi
- **SaaS sotuv qismi** — tariflar UI, to'lov/billing, self-service ro'yxatdan o'tish,
  onboarding sehrgari, trial, invoys, obuna bekor qilish

> ⚠️ **Muhim farq:** SaaS **funksionalligi** hozir qurilmaydi, lekin **arxitektura SaaS ga
> moslab yoziladi** — 3.16-bandga qarang. Keyinchalik SaaS ga o'tish uchun ma'lumot
> modelini yoki so'rovlarni qayta yozish talab qilinmasligi kerak.

---

## 2. Foydalanuvchilar va stsenariylar

### 2.1 Rollar

**R1. Bosh super admin** — kompaniya egasi / moliya direktori. Tizimning to'liq egasi.
Filiallar, kategoriyalar, byudjetlar, foydalanuvchilar va global hisobotlarni boshqaradi.
**Har bir xarajatning yakuniy tasdiqlovchisi.** Tizimda bir nechta bosh admin bo'lishi mumkin.

**R2. Filial direktori** — bitta filialga biriktiriladi. O'z filiali ishchilarini
boshqaradi (qo'sha oladi), ular kiritgan xarajatlarni birinchi bosqichda tasdiqlaydi yoki
rad etadi, filial byudjetini kuzatadi. Web ERP va Telegram bot — ikkalasidan foydalanadi.

**R3. Ishchi** — faqat Telegram bot. O'z xarajatini kiritadi, chek/kvitansiya suratini
yuklaydi, arizasining holatini kuzatadi, tahrirlash va qaytarish bo'yicha murojaat yuboradi,
o'zi bo'yicha qisqa statistikani ko'radi.

### 2.2 Rollar matritsasi

| Imkoniyat | Bosh super admin | Filial direktori | Ishchi |
|---|---|---|---|
| Web ERP ga kirish | ✅ | ✅ | ❌ |
| Telegram botdan foydalanish | ✅ | ✅ | ✅ |
| Barcha filiallarni ko'rish | ✅ | ❌ (faqat o'z filiali) | ❌ |
| Filial yaratish / tahrirlash / arxivlash | ✅ | ❌ | ❌ |
| Xodim qo'shish / rol berish | ✅ (barcha filial) | ✅ (faqat o'z filiali, ishchi roli) | ❌ |
| Xarajat kategoriyalari boshqaruvi | ✅ | ❌ | ❌ |
| Xarajat kiritish | ✅ | ✅ | ✅ |
| 1-bosqich tasdiqlash | ✅ | ✅ (o'z filiali) | ❌ |
| 2-bosqich (yakuniy) tasdiqlash | ✅ | ❌ | ❌ |
| Tasdiqlangan xarajatni tahrirlash (24 soat) | ✅ | ✅ (o'z filiali) | ❌ (murojaat yuboradi) |
| Qaytarishni tasdiqlash | ✅ | ✅ (1-bosqich) | ❌ (murojaat yuboradi) |
| Byudjet (limit) belgilash | ✅ | ❌ | ❌ |
| Valyuta kursi va hisob bazasini sozlash | ✅ | ❌ | ❌ |
| Hisobotlar va analitika | ✅ (global) | ✅ (o'z filiali) | ✅ (faqat o'zi, botda) |
| Eksport (Excel / PDF) | ✅ | ✅ (o'z filiali) | ❌ |
| Audit jurnali | ✅ | ❌ | ❌ |
| Tizim sozlamalari | ✅ | ❌ | ❌ |

### 2.3 Asosiy stsenariylar

- **S1**: Ishchi bot orqali tushlik xarajatini kiritadi → direktor tasdiqlaydi →
  bosh admin yakuniy tasdiqlaydi → summa filial va xodim hisobiga yoziladi.
- **S2**: Direktor xarajatni rad etadi → ishchi sabab bilan bildirishnoma oladi.
- **S3**: Bosh admin direktor tasdiqlagan xarajatni rad etadi → ishchi va direktor xabardor bo'ladi.
- **S4**: Ishchi noto'g'ri summa kiritganini payqaydi → bot orqali tahrirlash murojaati
  yuboradi → direktor 24 soat ichida sababni ko'rsatib tuzatadi.
- **S5**: Ofisga kompyuter olindi, xarajat tizimga kiritildi va tasdiqlandi. Kompyuter
  talabga javob bermadi, do'konga qaytarildi, pul qaytarildi → ishchi bot orqali isbot
  bilan qaytarish murojaati yuboradi → direktor va bosh admin tasdiqlaydi → xarajat
  "qaytarilgan" deb belgilanadi va hisobotlardan chegiriladi.
- **S6**: Filial oylik byudjetining 80% iga yetdi → direktor va bosh adminga ogohlantirish keladi.
- **S7**: Bosh admin dashboardda 5 filialni bir ekranda taqqoslaydi va Excelga eksport qiladi.

---

## 3. Funksional talablar

### 3.1 Autentifikatsiya va avtorizatsiya

- Web ERP ga kirish: **email + parol**, JWT (access + refresh token).
- Parollar `argon2id` bilan hash qilinadi. Ochiq holda hech qayerda saqlanmaydi.
- Refresh token httpOnly cookie da, access token qisqa muddatli (15 daq).
- Rol asosida kirish nazorati (RBAC): har bir endpoint rol va filial doirasi bo'yicha tekshiriladi.
- Filial doirasi (scope): direktor faqat o'z `branchId` ma'lumotlarini ko'radi — bu
  server tomonda majburlanadi, frontend filtriga tayanilmaydi.
- Login urinishlari cheklanadi: 5 ta muvaffaqiyatsiz urinishdan keyin 15 daqiqa blok.
- Ishchi roli Web ERP ga kira olmaydi (login muvaffaqiyatli bo'lsa ham 403).
- **Telegram bot autentifikatsiyasi: login (email yoki username) + parol.** Telefon
  raqami orqali kirish ishlatilmaydi. Web va bot **bitta `User` hisob ma'lumotidan**
  foydalanadi — ya'ni har bir xodim (WORKER ham) `User` yozuviga va parolga ega bo'ladi.
- Botda muvaffaqiyatli kirishdan keyin `TelegramAccountLink` yozuvi yaratiladi
  (`telegramId` ↔ `userId`). Bitta Telegram akkaunt **bir nechta hisobga** bog'lanishi
  mumkin (turli kompaniyalar yoki rollar) — 3.12.2 "Hisobni almashtirish" bandiga qarang.
- **Parol xavfsizligi botda:** foydalanuvchi parolni yozgan xabar tizim tomonidan
  **darhol o'chiriladi** (`deleteMessage`) va hech qayerda (log, audit, sessiya) saqlanmaydi.
- Botda kirish urinishlari cheklanadi: bitta `telegramId` uchun 5 ta muvaffaqiyatsiz
  urinishdan keyin 15 daqiqa blok (web bilan bir xil siyosat, hisoblagich umumiy).
- Bot sessiyasi 30 kun amal qiladi; muddat tugagach qayta kirish so'raladi.
  Foydalanuvchi istalgan vaqtda "Chiqish" (logout) qila oladi — bog'lanish o'chiriladi.
- Rol bo'yicha cheklov o'zgarmaydi: WORKER botga kira oladi, lekin Web ERP ga kira olmaydi.

**Qabul mezoni:**
- Ishchi roli akkaunti bilan `/api/expenses` ga so'rov 403 qaytaradi.
- A filial direktori B filial xarajatini `GET /api/expenses/:id` bilan so'rasa 404/403 qaytadi.
- Bazada `users.password_hash` maydoni `$argon2id$` bilan boshlanadi.
- 6-chi noto'g'ri parol urinishida javob 429 va `Retry-After` sarlavhasi bilan qaytadi.
- Muddati o'tgan access token bilan so'rov 401 qaytaradi va refresh oqimi yangi token beradi.
- Botda parol yuborilgandan keyin o'sha xabar chatdan o'chirilgan bo'ladi
  (`deleteMessage` chaqirilgani test bilan tekshiriladi).
- Bot loglarida va `audit_log` da parol matni umuman uchramaydi (log skanerlash testi).
- Botda 6-chi noto'g'ri parol urinishida foydalanuvchi 15 daqiqalik blok xabarini oladi.
- Nofaol (`isActive=false`) foydalanuvchi to'g'ri parol bilan ham botga kira olmaydi.

### 3.2 Filiallar moduli

- Filial CRUD: nomi, manzili, telefoni, direktori, ochilgan sanasi, status (faol/arxiv).
- Filialga xodimlarni biriktirish.
- Filialni **arxivlash** (fizik o'chirish yo'q) — tarixiy ma'lumot to'liq saqlanadi.
- Arxivlangan filialga yangi xarajat kiritib bo'lmaydi, lekin hisobotlarda ko'rinadi.
- Har bir filialda kamida bitta direktor bo'lishi kerak (ogohlantirish beriladi).

**Qabul mezoni:**
- Faqat bosh admin filial yarata oladi; direktor urinsa 403.
- Arxivlangan filial uchun xarajat yaratish so'rovi 422 va tushunarli xato matni qaytaradi.
- Filial arxivlangandan keyin uning eski xarajatlari hisobotlarda o'zgarishsiz qoladi
  (arxivlashdan oldingi va keyingi jami summa teng).
- Filial ro'yxati `?status=active|archived|all` filtri bilan ishlaydi.

### 3.3 Xodimlar moduli

- Xodim kartochkasi: F.I.Sh., lavozim, filial, telefon, ishga kirgan sana,
  status (faol/nofaol), rol, bog'langan Telegram akkauntlari (faqat ko'rish).
- **Har bir xodimga `User` hisobi yaratiladi** (WORKER ham) — login (email yoki username)
  va boshlang'ich parol. Botga kirish shu hisob orqali amalga oshadi (3.12.1).
- Xodim yaratilganda tizim boshlang'ich parol generatsiya qiladi va uni **bir marta**
  ko'rsatadi (yoki admin qo'lda belgilaydi). Parol keyin qayta ko'rsatilmaydi.
- Admin/direktor xodim parolini **qayta tiklay** oladi (yangi parol generatsiya qilinadi).
  Parol tiklanganda o'sha xodimning barcha Telegram bog'lanishlari bekor qilinadi.
- Telefon raqami — ma'lumot maydoni, autentifikatsiyada ishlatilmaydi.
- Xodim qo'shish huquqi: bosh admin — barcha filialga, istalgan rol bilan;
  filial direktori — faqat o'z filialiga va faqat **ishchi** roli bilan.
- Xodimni boshqa filialga ko'chirish — ko'chirish tarixi saqlanadi, eski xarajatlar
  eski filialga biriktirilgan holicha qoladi.
- Xodim kartochkasida: xarajat tarixi, jami summa, joriy oy summasi, qaytarilganlar.
- Nofaol xodim bot orqali kira olmaydi va unga xarajat biriktirib bo'lmaydi.
- Telefon raqami tizim bo'ylab unikal.

**Qabul mezoni:**
- Direktor `role=admin` bilan xodim yaratmoqchi bo'lsa 403 qaytadi.
- Direktor boshqa filial `branchId` si bilan xodim yaratmoqchi bo'lsa 403 qaytadi.
- Mavjud telefon raqami bilan xodim yaratish 409 qaytaradi.
- Xodim A filialdan B filialga ko'chirilgach, uning eski xarajatlari hisobotda hali ham
  A filial summasida qoladi.
- Xodim yaratilgach unga tegishli `User` yozuvi va parol hash i mavjud bo'ladi.
- Xodim paroli qayta tiklangach uning barcha `TelegramAccountLink` yozuvlari
  `isRevoked=true` bo'ladi va botda qayta kirish so'raladi.
- Nofaol xodim to'g'ri parol bilan ham botga kira olmaydi va tushunarli xabar oladi.

### 3.4 Xarajat kategoriyalari

- Ikki darajali ierarxiya: bosh kategoriya → ichki kategoriya.
- Har bir kategoriya uchun sozlamalar:
  - `receiptRequired` (chek majburiymi) — **ha/yo'q**, admin belgilaydi
  - `maxAmountPerEntry` — bir martalik maksimal summa (ixtiyoriy)
  - `commentRequired` — izoh majburiymi
- Boshlang'ich seed ro'yxat:
  - **Ovqatlanish** → Tushlik, Korporativ tadbir, Suv/choy
  - **Malaka oshirish** → Kurs, Trening, Sertifikat, Kitob/materiallar
  - **Transport** → Yo'l xarajati, Taksi, Yoqilg'i
  - **Sog'liq** → Med. ko'rik, Sug'urta
  - **Ish jihozlari** → Forma, Asboblar, Kanselyariya
  - **Boshqa**
- Kategoriya o'chirilmaydi, faqat arxivlanadi (ishlatilgan bo'lsa).

**Qabul mezoni:**
- `receiptRequired=true` bo'lgan kategoriyaga chek fayli biriktirmasdan xarajat
  yuborilsa 422 va "Ushbu kategoriya uchun chek majburiy" xatosi qaytadi.
- `maxAmountPerEntry` dan oshiq summa kiritilsa 422 qaytadi.
- Ishlatilgan kategoriyani o'chirish urinishi 409 qaytaradi, arxivlash esa muvaffaqiyatli.
- Bot menyusida faqat faol kategoriyalar ko'rsatiladi.

### 3.5 Valyuta va kurslar

- Qo'llab-quvvatlanadigan valyutalar: **UZS**, **USD**.
- Kurs manbalari **ikkalasi ham** mavjud:
  1. **Avtomatik** — CBU (cbu.uz) ochiq API dan kunlik kurs tortiladi (kuniga 1 marta,
     cron 09:00 Asia/Tashkent).
  2. **Qo'lda** — bosh admin sanaga kurs qiymatini qo'lda kiritadi.
- Bosh admin sozlamalarda **hisoblash bazasini tanlaydi**: `AUTO` (CBU) yoki `MANUAL`.
  Tanlangan baza barcha hisobot va konvertatsiyalarda ishlatiladi.
- Xarajat yaratilganda o'sha sanadagi amaldagi kurs yozuvga **snapshot** qilib saqlanadi
  (`rateUsed`, `rateSource`) — keyinchalik kurs o'zgarsa tarixiy hisobot o'zgarmaydi.
- CBU API mavjud bo'lmasa, oxirgi ma'lum kurs ishlatiladi va bosh adminga ogohlantirish keladi.
- Hisobotlarda asosiy hisob valyutasi — **UZS**.

**Qabul mezoni:**
- USD da kiritilgan xarajat yozuvida `rateUsed` va `rateSource` maydonlari to'ldirilgan bo'ladi.
- Kurs keyin o'zgartirilsa, avval yaratilgan xarajatning UZS ekvivalenti o'zgarmaydi.
- Sozlamada `MANUAL` tanlansa va o'sha sana uchun qo'lda kurs kiritilmagan bo'lsa,
  USD xarajat yaratish 422 va tushunarli xato bilan bloklanadi.
- CBU API 500 qaytarganda cron xato bermay tugaydi va oxirgi kursni saqlab qoladi,
  bosh adminga bildirishnoma boradi.
- Aralash valyutali hisobot jami summasi UZS da to'g'ri chiqadi (unit test bilan tekshiriladi).

### 3.6 Xarajatlar moduli (yadro)

Xarajat yozuvining maydonlari:

| Maydon | Turi | Majburiy |
|---|---|---|
| Filial | tanlov | ✅ (kiritganga qarab avtomatik) |
| Xodim(lar) (kim uchun) | ko'p tanlov | ✅ |
| Kategoriya | tanlov | ✅ |
| Summa | son (musbat, 2 kasr) | ✅ |
| Valyuta | UZS / USD | ✅ |
| Sana | sana (kelajakda bo'lmasligi kerak) | ✅ |
| Izoh | matn | ⚠️ kategoriyaga bog'liq |
| Isbot (chek/kvitansiya) | fayl/rasm, 1–5 ta, ≤10 MB | ⚠️ kategoriyaga bog'liq |
| To'lov usuli | naqd / karta / o'tkazma | ✅ |
| Kiritgan shaxs | avtomatik | ✅ |
| Status | avtomatik | ✅ |

**Taqsimlash qoidasi:** bitta xarajat bir nechta xodimga taqsimlanishi mumkin
(masalan 5 kishilik tushlik → 500 000 so'm → har biriga 100 000 so'm).
Taqsimlash usullari: **teng bo'lish** yoki **qo'lda summa kiritish**.
Qo'lda kiritilganda ulushlar yig'indisi umumiy summaga **aniq teng** bo'lishi shart.

**Raqamlash qoidasi:** har bir xarajat **ikkita raqamga** ega bo'ladi:

| Maydon | Format | Ma'nosi |
|---|---|---|
| `globalNumber` | `EXP-000123` | Tizim bo'ylab yagona, uzluksiz ketma-ketlik |
| `branchNumber` | `CHL-2026-0045` | Filial kodi + yil + filial ichidagi ketma-ketlik |

- Filial kodi (`Branch.code`, masalan `CHL`) — 2–5 ta lotin harfi, tizim bo'ylab unikal,
  filial yaratilganda belgilanadi va keyin o'zgartirilmaydi.
- Filial ichidagi ketma-ketlik **har yil boshida 1 dan qayta boshlanadi**.
- Ikkala raqam ham xarajat yaratilganda **bitta tranzaksiyada** beriladi va keyin
  hech qachon o'zgarmaydi (xarajat tahrirlansa ham, qaytarilsa ham).
- Ikkala raqam ham qidiruvda ishlaydi, ro'yxat jadvalida va eksportda alohida ustun
  sifatida chiqadi, bot kartochkasida ikkalasi ham ko'rsatiladi.
- Parallel yaratishda raqam dublikat bo'lmasligi kerak (DB sequence / `SELECT ... FOR UPDATE`).

- Xarajatlar **hech qachon fizik o'chirilmaydi** (soft delete + audit).
- Dublikat aniqlash: bir xil xodim + kategoriya + summa + sana kombinatsiyasi 10 daqiqa
  ichida takrorlansa, ogohlantirish ko'rsatiladi (bloklamaydi).
- Ro'yxat sahifasi: filtr, qidiruv, saralash, pagination, bulk-tasdiqlash.

**Qabul mezoni:**
- Manfiy yoki nol summa bilan xarajat yaratish 422 qaytaradi.
- Kelajak sanasi bilan xarajat yaratish 422 qaytaradi.
- Qo'lda taqsimlashda ulushlar yig'indisi umumiy summaga teng bo'lmasa 422 qaytadi.
- Teng taqsimlashda qoldiq tiyinlar birinchi xodimga qo'shiladi va yig'indi aniq teng chiqadi
  (masalan 100 000 / 3 → 33 333.34 + 33 333.33 + 33 333.33).
- 5 tadan ortiq fayl yuklash 422 qaytaradi; 10 MB dan katta fayl 413 qaytaradi.
- `DELETE /api/expenses/:id` yozuvni bazadan o'chirmaydi, `deletedAt` ni to'ldiradi va
  audit jurnaliga yozuv qo'shadi.
- 10 000 yozuvli bazada ro'yxat sahifasi ≤ 2 soniyada javob beradi.
- Yaratilgan xarajatda `globalNumber` va `branchNumber` ikkalasi ham bo'sh bo'lmaydi.
- 100 ta xarajat parallel yaratilganda `globalNumber` va `branchNumber` qiymatlari
  takrorlanmaydi (konkurentlik testi).
- Chilonzor filialida yangi yilning birinchi xarajati `CHL-2027-0001` raqamini oladi,
  `globalNumber` esa uzluksiz davom etadi.
- Xarajat tahrirlangandan yoki qaytarilgandan keyin ikkala raqam ham o'zgarmagan bo'ladi.
- Qidiruv maydoniga `CHL-2026-0045` yoki `EXP-000123` kiritilganda o'sha yagona yozuv topiladi.

### 3.7 Ikki bosqichli tasdiqlash oqimi

**Muhim qoida: har bir xarajat, summasidan qat'i nazar (1 so'm ham, 100 mln ham),
ikki bosqichdan o'tadi:**

```
Ishchi kiritadi
      ↓
[DIRECTOR_PENDING]  → Filial direktori qarori
      ↓ tasdiqlandi
[ADMIN_PENDING]     → Bosh super admin qarori
      ↓ tasdiqlandi
[APPROVED]          → filial va xodim hisobiga yoziladi
```

Statuslar:

| Status | Ma'nosi | Kim o'zgartira oladi |
|---|---|---|
| `DRAFT` | Bot orqali kiritilmoqda, yakunlanmagan | Ishchi |
| `DIRECTOR_PENDING` | Direktor tasdig'i navbatida | Direktor, Bosh admin |
| `ADMIN_PENDING` | Bosh admin yakuniy tasdig'i navbatida | Bosh admin |
| `NEEDS_FIX` | Tuzatish so'raldi | Direktor / Bosh admin → Ishchi |
| `APPROVED` | Ikki bosqichdan o'tgan, rasmiy xarajat | — |
| `REJECTED` | Sabab bilan rad etilgan | Direktor, Bosh admin |
| `CANCELLED` | Ishchi o'zi bekor qilgan | Ishchi (faqat `DIRECTOR_PENDING` da) |
| `REFUNDED` | Pul qaytarilgan (3.9-band) | — |

Qoidalar:

- Rad etish va tuzatish so'rashda **sabab matni majburiy** (≥10 belgi).
- Direktor **o'zi kiritgan** xarajatni o'zi tasdiqlay olmaydi → to'g'ridan-to'g'ri
  `ADMIN_PENDING` ga o'tadi.
- Tizimda **bir nechta bosh super admin** bo'ladi. Ularning huquqlari teng, istalgani
  2-bosqich tasdig'ini bera oladi (birinchi qaror qabul qilinadi, qolganlarga
  "allaqachon qayta ishlangan" ko'rsatiladi).
- Bosh admin **o'zi kiritgan** xarajatni o'zi tasdiqlay olmaydi — uni **boshqa bosh admin**
  tasdiqlashi shart (four-eyes principle). Agar tizimda faqat bitta faol bosh admin qolgan
  bo'lsa, u o'zinikini tasdiqlay oladi, lekin audit yozuviga `selfApproved: true` belgisi
  qo'yiladi va Web da ogohlantirish ko'rsatiladi.
- Har qanday bosqichda bosh admin rad etsa, xarajat `REJECTED` bo'ladi.
- `NEEDS_FIX` dan keyin ishchi tuzatib qayta yuboradi → oqim **1-bosqichdan** boshlanadi.
- 24 soat ichida ko'rilmagan ariza bo'yicha tasdiqlovchiga eslatma yuboriladi.
- Faqat `APPROVED` xarajatlar hisobot va byudjet sarfida hisobga olinadi.

**Qabul mezoni:**
- Ishchi kiritgan xarajat direktor tasdiqlagach `ADMIN_PENDING` bo'ladi, `APPROVED` emas.
- `ADMIN_PENDING` holatidagi xarajatni direktor tasdiqlashga urinsa 403 qaytadi.
- Direktor o'zi kiritgan xarajat yaratilishi bilanoq `ADMIN_PENDING` statusida bo'ladi.
- 5 belgili sabab bilan rad etish 422 qaytaradi.
- `DIRECTOR_PENDING` va `ADMIN_PENDING` xarajatlar dashboard "jami sarf" ko'rsatkichiga
  qo'shilmaydi (integratsion test).
- Har bir status o'zgarishi `expense_status_history` jadvaliga (kim, qachon, sabab) yoziladi.
- Bosh admin A o'zi kiritgan xarajatni tasdiqlashga urinsa, tizimda boshqa faol bosh admin
  bor bo'lganda 403 va "Boshqa bosh admin tasdiqlashi kerak" xatosi qaytadi.
- Tizimda bitta faol bosh admin bo'lganda o'zini tasdiqlash muvaffaqiyatli o'tadi va
  audit yozuvida `selfApproved: true` bo'ladi.
- Ikki bosh admin bir vaqtda bitta arizani tasdiqlasa, faqat bittasi muvaffaqiyatli bo'ladi,
  ikkinchisi 409 "allaqachon qayta ishlangan" oladi (optimistik blokirovka).
- Bulk-tasdiqlash 20 ta arizani bitta tranzaksiyada qayta ishlaydi; bittasi xato bersa
  boshqalari muvaffaqiyatli o'tadi va natija hisoboti qaytadi.

### 3.8 Tasdiqlangandan keyin tahrirlash

- `APPROVED` xarajatni tahrirlash **tasdiqlangandan keyin 24 soat ichida** mumkin.
- Tahrirlashi mumkin bo'lganlar: **filial direktori** (o'z filiali) va **bosh super admin**.
- Tahrirlashda **asos (sabab) matni majburiy** (≥10 belgi).
- Ishchi o'zi tahrirlay olmaydi — bot orqali **tahrirlash murojaati** yuboradi
  (`EditRequest`: xarajat ID, nima o'zgarishi kerak, sabab). Murojaat direktorga tushadi.
- 24 soat o'tgach tahrirlash bloklanadi; yagona yo'l — bosh admin tomonidan storno
  (bekor qiluvchi yozuv) yaratish.
- Har bir tahrir audit jurnaliga **eski qiymat → yangi qiymat** ko'rinishida yoziladi.
- Summa tahrirlansa byudjet sarfi qayta hisoblanadi va limit ogohlantirishlari qayta baholanadi.

**Qabul mezoni:**
- `approvedAt` dan 24 soat 1 daqiqa o'tgan xarajatni tahrirlash 422 va
  "Tahrirlash muddati tugagan" xatosi bilan bloklanadi.
- Sababsiz tahrirlash so'rovi 422 qaytaradi.
- Tahrirdan keyin `audit_log` da eski va yangi summa qiymatlari ikkalasi ham mavjud bo'ladi.
- Ishchi `PATCH /api/expenses/:id` ga urinsa 403 qaytadi.
- Bot orqali yuborilgan tahrirlash murojaati direktorga bildirishnoma sifatida yetib boradi
  va Web ERP dagi "Murojaatlar" ro'yxatida ko'rinadi.

### 3.9 Qaytarish (Refund) moduli

**Biznes holati:** ofisga kompyuter olindi, to'lov qilindi va tizimga xarajat sifatida
kiritilib tasdiqlandi. Kompyuter talabga javob bermadi va do'konga qaytarildi, do'kon pulni
qaytardi. Bunday hollarda xarajat tizimda "qaytarilgan" deb kuzatilishi kerak.

Oqim:

```
Ishchi botda "Pulni qaytarish" → mavjud APPROVED xarajatni tanlaydi
      ↓ summa (to'liq yoki qisman) + sabab + isbot fayli (majburiy)
[RefundRequest: DIRECTOR_PENDING]
      ↓ direktor tasdiqlaydi
[RefundRequest: ADMIN_PENDING]
      ↓ bosh admin tasdiqlaydi
[RefundRequest: APPROVED]  → xarajat REFUNDED / PARTIALLY_REFUNDED bo'ladi
```

Qoidalar:

- Qaytarish so'rovi faqat `APPROVED` statusidagi xarajatga yaratiladi.
- **To'liq** yoki **qisman** qaytarish qo'llab-quvvatlanadi. Qisman bo'lsa xarajat statusi
  `PARTIALLY_REFUNDED` bo'ladi va effektiv summa = summa − qaytarilgan summa.
- Qaytarish summasi xarajatning qolgan summasidan oshmaydi.
- **Isbot fayli majburiy** (qaytarish kvitansiyasi/chek) — istisnosiz.
- Qaytarish ham **ikki bosqichli** tasdiqlashdan o'tadi (direktor → bosh admin).
- Hisobot va byudjet sarfida **effektiv summa** ishlatiladi — qaytarilgan pul sarfdan chegiriladi.
- Asl xarajat yozuvi o'zgartirilmaydi (immutable); qaytarish alohida bog'langan yozuv.
- Direktor va bosh admin Web ERP dan ham qaytarish yarata oladi.
- Bitta xarajatga bir nechta qisman qaytarish bo'lishi mumkin.

**Qabul mezoni:**
- `DIRECTOR_PENDING` statusidagi xarajatga qaytarish yaratish 422 qaytaradi.
- Isbot faylsiz qaytarish so'rovi 422 va "Qaytarish uchun isbot majburiy" xatosi qaytaradi.
- Xarajat qolgan summasidan katta qaytarish summasi 422 qaytaradi.
- 500 000 so'mlik xarajatga 200 000 so'm qaytarish tasdiqlangach: xarajat statusi
  `PARTIALLY_REFUNDED`, hisobotdagi effektiv summa 300 000 so'm bo'ladi.
- To'liq qaytarishdan keyin xarajat `REFUNDED` bo'ladi va filial oylik sarfiga 0 qo'shadi.
- Ikkita qisman qaytarish (200 000 + 300 000) yig'indisi to'liq summaga yetganda status
  avtomatik `REFUNDED` ga o'tadi.
- Qaytarish direktor tasdig'idan keyin darhol `APPROVED` bo'lmaydi — `ADMIN_PENDING` ga o'tadi.

### 3.10 Byudjet va limitlar

- Limit turlari: **filial oylik**, **kategoriya oylik**, **xodim boshiga oylik**.
- Limit belgilash huquqi — faqat bosh super admin.
- **Limit yumshoq (soft)**: limitdan oshgan xarajat **bloklanmaydi**, faqat ogohlantiriladi.
- Ogohlantirish chegaralari: **80%** va **100%** — bot + Web bildirishnomasi.
- Limitdan oshgan xarajat ro'yxatda ⚠️ belgisi bilan ajratiladi va tasdiqlash ekranida
  aniq ko'rsatiladi.
- Byudjet davri: sozlamalarda belgilangan hisobot davriga bog'lanadi (3.13-band).
- Sarf hisobida faqat `APPROVED` xarajatlarning **effektiv summasi** (qaytarish chegirilgan)
  ishtirok etadi.

**Qabul mezoni:**
- Limit 100% dan oshsa ham xarajat muvaffaqiyatli yaratiladi (201), lekin javobda
  `budgetWarning` obyekti qaytadi.
- Filial sarfi 80% ga birinchi marta yetganda direktor va bosh adminga bildirishnoma boradi;
  keyingi xarajatlarda takroriy 80% bildirishnomasi yuborilmaydi (bir davrda bir marta).
- Qaytarish tasdiqlangach filial sarfi kamayadi va 100% dan pastga tushsa, keyingi davrda
  ogohlantirish qayta ishga tushishi mumkin bo'ladi.
- Limit belgilanmagan filial uchun ogohlantirish umuman yuborilmaydi.

### 3.11 Bildirishnomalar

| Hodisa | Kimga | Kanal |
|---|---|---|
| Yangi xarajat kiritildi | Filial direktori | Bot + Web |
| Direktor tasdiqladi (2-bosqich kutilmoqda) | Bosh admin | Bot + Web |
| Xarajat yakuniy tasdiqlandi / rad etildi | Ishchi (+ direktor) | Bot + Web |
| Tuzatish so'raldi | Ishchi | Bot |
| Tahrirlash murojaati yuborildi | Direktor | Bot + Web |
| Qaytarish murojaati yuborildi | Direktor → Bosh admin | Bot + Web |
| Qaytarish tasdiqlandi / rad etildi | Ishchi | Bot |
| Limit 80% / 100% | Direktor + Bosh admin | Bot + Web |
| 24 soat javobsiz ariza | Tasdiqlovchi (eslatma) | Bot |
| Kunlik/haftalik xulosa | Bosh admin | Bot |
| Valyuta kursi olinmadi | Bosh admin | Bot + Web |

- Bildirishnomalar Redis + BullMQ navbati orqali asinxron yuboriladi.
- Yuborilmagan bildirishnoma 3 marta qayta uriniladi (eksponensial backoff).
- Web ichida o'qilmagan bildirishnomalar hisoblagichi (badge) bo'ladi.
- Email kanali **doiraga kirmaydi**.

**Qabul mezoni:**
- Xarajat yaratilgach direktor uchun navbatga bildirishnoma job qo'shiladi (test: job soni +1).
- Telegram API xato qaytarsa job retry ga tushadi va 3 urinishdan keyin
  `failed` holatiga o'tadi hamda log yoziladi.
- Foydalanuvchi Telegramda botni bloklagan bo'lsa, tizim xato bermay davom etadi va
  xodim kartochkasida "bot bloklangan" belgisi paydo bo'ladi.
- Web bildirishnomani o'qilgan deb belgilash badge sonini kamaytiradi.

### 3.12 Telegram bot

#### 3.12.1 Kirish (login + parol)

1. `/start` → tilni tanlash (**O'zbekcha / Ruscha**)
2. "🔐 Kirish" → **login** so'raladi (email yoki username)
3. **Parol** so'raladi → foydalanuvchi yozadi
4. Tizim parolni tekshiradi va **parol yozilgan xabarni darhol o'chiradi**
5. Muvaffaqiyatli bo'lsa: `TelegramAccountLink` yaratiladi, hisob faol qilinadi,
   salomlashish + rolga mos menyu ko'rsatiladi
6. Xato bo'lsa: "Login yoki parol noto'g'ri" (qaysi biri xato ekani **aytilmaydi**),
   qayta urinish taklif qilinadi
7. 5 ta muvaffaqiyatsiz urinishdan keyin 15 daqiqa blok

- Telefon raqami orqali kirish (Contact tugmasi) **ishlatilmaydi**. Telefon xodim
  kartochkasida ma'lumot sifatida qoladi, autentifikatsiyada qatnashmaydi.
- Kirmagan foydalanuvchiga faqat "Kirish" va "Yordam" tugmalari ko'rinadi.
- Parolni unutgan bo'lsa: "Administratoringizga murojaat qiling" (parolni bot orqali
  tiklash doiraga kirmaydi).

#### 3.12.2 Hisobni almashtirish (switch account)

Bitta Telegram akkaunt **bir nechta hisobga** bog'lanishi mumkin — masalan bir odam
ikki kompaniyada ishlaydi, yoki bitta odamda ham direktor, ham ishchi hisobi bor.

- `TelegramAccountLink` jadvali: bitta `telegramId` uchun **N ta** bog'langan hisob.
- Ayni paytda **faqat bittasi faol** (`TelegramSession.activeLinkId`). Barcha amallar,
  bildirishnomalar konteksti va menyu faol hisobga tegishli bo'ladi.
- Menyuda **`🔄 Hisobni almashtirish`** tugmasi:
  - Bog'langan hisoblar ro'yxati chiqadi: `Kompaniya nomi — F.I.Sh. (rol)`,
    faol hisob ✅ bilan belgilanadi
  - Hisob tanlansa — **parol qayta so'ralmaydi**, kontekst darhol almashadi
  - `➕ Boshqa hisob qo'shish` → 3.12.1 dagi login+parol oqimi qaytadan
  - `🚪 Chiqish` → faol hisob bog'lanishi o'chiriladi; boshqa bog'langan hisob bo'lsa
    unga o'tiladi, bo'lmasa kirish ekraniga qaytadi
  - `🚪 Barcha hisoblardan chiqish` → barcha bog'lanishlar o'chiriladi
- Hisob almashtirilganda joriy yarim tugallangan oqim (masalan xarajat kiritish)
  **bekor qilinadi** va foydalanuvchi bu haqda ogohlantiriladi.
- Bir hisob bog'langan bo'lsa "Hisobni almashtirish" tugmasi ko'rinmaydi
  (o'rniga "Chiqish" bo'ladi).
- **Bildirishnomalar barcha bog'langan hisoblar bo'yicha keladi** (faol bo'lmasa ham),
  lekin xabar sarlavhasida qaysi hisob/kompaniya ekani ko'rsatiladi. Bildirishnoma
  ustida amal bajarish uchun tizim avtomatik o'sha hisobga o'tishni taklif qiladi.

#### 3.12.3 Menyular

**Ishchi menyusi:**
```
➕ Xarajat qo'shish
📋 Mening xarajatlarim
↩️ Pulni qaytarish
✏️ Tahrirlash so'rovi
📊 Statistikam (oylik)
🔄 Hisobni almashtirish
⚙️ Sozlamalar (til, profil)
❓ Yordam
```

**Xarajat qo'shish oqimi (bosqichma-bosqich):**
1. Kategoriya → inline tugmalar
2. Kim uchun → o'zim / boshqa xodim / guruh (filial ro'yxatidan ko'p tanlov)
3. Taqsimlash (guruh bo'lsa) → teng bo'lish / qo'lda
4. Summa + valyuta → validatsiya (musbat son, kategoriya maksimumi)
5. Sana → "Bugun" tugmasi yoki qo'lda kiritish
6. Izoh → matn yoki "O'tkazib yuborish" (kategoriya talab qilsa majburiy)
7. Chek/isbot → rasm/hujjat (kategoriya talab qilsa majburiy)
8. Tasdiqlash ekrani → ✅ Yuborish / ✏️ Tahrirlash / ❌ Bekor qilish
9. "Arizangiz #1234 direktorga yuborildi"

Har bosqichda ⬅️ **Orqaga** va ❌ **Bekor qilish** tugmalari **bo'lishi shart**.

**Direktor menyusi:**
```
🔔 Tasdiqlash kutilmoqda (N)
↩️ Qaytarish so'rovlari (N)
✏️ Tahrirlash so'rovlari (N)
📋 Filial xarajatlari
📊 Filial statistikasi
👥 Xodimlar
➕ Xarajat qo'shish
🔄 Hisobni almashtirish
🌐 Web ERP ga o'tish (link)
```

**Bosh admin menyusi:** yuqoridagilarga qo'shimcha `✅ Yakuniy tasdiqlash (N)` va global statistika.

**Tasdiqlash kartochkasi:**
```
🆕 Yangi xarajat #1234
🏢 Filial: Chilonzor
👤 Xodim: Aliyev Vali
📂 Kategoriya: Ovqatlanish → Tushlik
💰 Summa: 150 000 so'm
📅 Sana: 06.08.2026
📝 Izoh: Jamoaviy tushlik
📎 Chek: [rasm]
⚠️ Byudjet: oylik limitning 92% i

[✅ Tasdiqlash] [❌ Rad etish] [✏️ Tuzatish so'rash]
```

- Rad etish / Tuzatish bosilsa → sabab yozish majburiy.
- Ketma-ket arizalarni ko'rish uchun navigatsiya (⬅️ ➡️).
- Bot sessiya holati Redis da saqlanadi; bot qayta ishga tushsa oqim yo'qolmaydi.
- Bir nechta hisob bog'langan bo'lsa, kartochka sarlavhasida kompaniya nomi ko'rsatiladi.

**Qabul mezoni:**
- Kirmagan Telegram foydalanuvchisi menyu tugmalarini bosganda faqat kirish taklifini oladi.
- To'g'ri login+parol bilan kirish muvaffaqiyatli o'tadi va rolga mos menyu ochiladi.
- Noto'g'ri parolda xabar "Login yoki parol noto'g'ri" bo'ladi — login mavjudligi
  oshkor qilinmaydi.
- Ikkita turli kompaniya hisobiga kirgan foydalanuvchida "Hisobni almashtirish" ro'yxatida
  2 ta yozuv bo'ladi va faol hisob ✅ bilan belgilanadi.
- Hisob almashtirilgandan keyin "Mening xarajatlarim" faqat yangi faol hisobning
  kompaniyasidagi yozuvlarni ko'rsatadi (cross-tenant oqib ketmaydi).
- Hisob almashtirishda parol qayta so'ralmaydi.
- Yarim tugallangan xarajat oqimi paytida hisob almashtirilsa, oqim bekor qilinadi va
  foydalanuvchi ogohlantiriladi.
- Faqat bitta hisob bog'langan foydalanuvchida "Hisobni almashtirish" tugmasi ko'rinmaydi.
- "Chiqish" dan keyin foydalanuvchi menyuga kira olmaydi va qayta login so'raladi.
- 30 kundan keyin sessiya muddati tugaydi va qayta kirish so'raladi.
- Har bir oqim bosqichida "Orqaga" tugmasi oldingi bosqichga qaytaradi va kiritilgan
  ma'lumot saqlanib qoladi.
- `receiptRequired=true` kategoriyada foydalanuvchi rasmsiz davom eta olmaydi.
- Bot qayta ishga tushirilgandan keyin yarim yo'lda qolgan oqim davom etadi (Redis sessiya).
- Bot javob vaqti ≤ 2 soniya (o'lchov: 50 ta ketma-ket so'rov p95).
- Tilni ruschaga o'zgartirgach barcha tugma va xabarlar rus tilida chiqadi.
- Direktor tasdiqlash tugmasini ikki marta bossa, ikkinchi bosishda "allaqachon
  qayta ishlangan" xabari chiqadi (idempotentlik).

### 3.13 Hisobotlar va analitika

**Bosh admin dashboardi:**
- Umumiy xarajat (kun / hafta / oy / chorak / yil)
- Filiallar bo'yicha taqqoslash (bar chart + jadval)
- Kategoriyalar bo'yicha ulush (pie chart)
- Dinamika grafigi (oylar kesimida trend)
- TOP-10 eng ko'p xarajat qilingan xodimlar
- Bir xodimga o'rtacha xarajat (filiallar bo'yicha taqqoslash)
- Byudjet vs Fakt
- Tasdiqlash kutayotgan arizalar soni (1-bosqich va 2-bosqich alohida)
- Qaytarilgan summalar bloki

**Filial direktori dashboardi:** yuqoridagilarning o'z filiali kesimidagi versiyasi.

**Filtrlar:** sana oralig'i, filial, kategoriya, xodim, status, summa oralig'i, to'lov usuli, valyuta.

**Hisobot davri:** sozlamalarda tanlanadi — **kalendar oy (1–31, default)** yoki
**sozlanadigan davr** (masalan 25-dan 25-gacha; admin oy boshlanish kunini 1–28 oralig'ida belgilaydi).

**Eksport (Excel .xlsx va PDF):** eksport tizimning ko'ndalang imkoniyati — quyidagi
barcha ro'yxat va hisobotlar amaldagi filtrlar bilan eksport qilinadi:

| # | Nima eksport qilinadi | Formatlar | Kim |
|---|---|---|---|
| E1 | Xarajatlar ro'yxati (barcha maydonlar + ikkala raqam + taqsimlash + status) | xlsx, pdf | Admin, Direktor |
| E2 | Hisobot: filiallar bo'yicha | xlsx, pdf | Admin |
| E3 | Hisobot: kategoriyalar bo'yicha | xlsx, pdf | Admin, Direktor |
| E4 | Hisobot: xodimlar bo'yicha | xlsx, pdf | Admin, Direktor |
| E5 | Byudjet vs Fakt | xlsx, pdf | Admin, Direktor |
| E6 | Qaytarishlar (refund) ro'yxati | xlsx | Admin, Direktor |
| E7 | Xodimlar ro'yxati | xlsx | Admin, Direktor |
| E8 | Filiallar ro'yxati | xlsx | Admin |
| E9 | **Audit jurnali (loglar)** | xlsx | **Faqat Admin** |
| E10 | Tasdiqlash tarixi (status history) | xlsx | Admin |

Umumiy qoidalar:
- Eksport **amaldagi filtrlarni aynan takrorlaydi** — ekranda ko'ringan ma'lumot
  eksportda ham xuddi shunday bo'ladi (qatorlar soni va jami summa mos keladi).
- Eksport **rol va filial doirasiga bo'ysunadi** — direktor eksporti faqat o'z filiali
  ma'lumotini o'z ichiga oladi.
- Fayl sarlavhasi: hisobot nomi, davr, filtrlar ro'yxati, yaratilgan sana/vaqt
  (Asia/Tashkent), eksport qilgan foydalanuvchi.
- Ustun sarlavhalari foydalanuvchi tanlagan tilda (uz/ru).
- Excelda: summa ustunlari **raqam formatida** (matn emas), sana — sana formatida,
  oxirgi qatorda **jami**, sarlavha qatori muzlatilgan (freeze pane) va avtofiltr yoqilgan.
- 1 000 qatordan katta eksport **BullMQ orqali fon rejimida** generatsiya qilinadi,
  tayyor bo'lgach signed URL havolasi beriladi (Web bildirishnoma + bot).
- Eksport fayli 24 soatdan keyin storagedan avtomatik o'chiriladi.
- **Har bir eksport amali audit jurnaliga yoziladi** (kim, nima, qanday filtr bilan).

**Qabul mezoni:**
- Barcha hisobotlarda faqat `APPROVED` xarajatlarning effektiv summasi hisoblanadi.
- Direktor hisoboti faqat o'z filiali ma'lumotini qaytaradi (boshqa filial `branchId`
  bilan so'rov 403).
- Excel eksport faylida ustunlar va jami qatori UI dagi jadval bilan bir xil bo'ladi.
- E1–E10 dagi har bir eksport turi uchun kamida bitta avtomatlashtirilgan test mavjud.
- Direktor E9 (audit) eksportini so'rasa 403 qaytadi.
- Direktor xarajatlar eksportini yuklaganda faylda faqat o'z filiali qatorlari bo'ladi.
- Eksport faylidagi qatorlar soni va jami summa ekrandagi filtrlangan natija bilan
  aynan mos keladi.
- Excel faylida summa katakchasi `typeof === number` bo'ladi (matn emas) va jami qatori mavjud.
- 1 000 qatordan katta eksport so'rovi darhol `jobId` qaytaradi (so'rov bloklanmaydi).
- Har bir eksportdan keyin `audit_log` da `action: "EXPORT"` yozuvi paydo bo'ladi.
- Davr boshlanish kuni 25 ga o'zgartirilsa, "joriy oy" ko'rsatkichi 25-iyuldan
  24-avgustgacha oraliqni qamrab oladi.
- Aralash valyutali hisobotda jami summa UZS da, har bir yozuvda o'z valyutasi ko'rinadi.
- 10 000 yozuvli eksport 30 soniyada tayyor bo'ladi va so'rovni bloklamaydi (fon rejimi).

### 3.14 Audit jurnali

- Har bir muhim amal yoziladi: kim, qachon, qaysi obyekt, nima o'zgardi
  (eski qiymat → yangi qiymat), IP va kanal (web/bot).
- Yoziladigan amallar: login, xarajat yaratish/tahrirlash/o'chirish, status o'zgarishi,
  qaytarish, byudjet o'zgarishi, foydalanuvchi/rol o'zgarishi, kategoriya o'zgarishi,
  kurs manbai o'zgarishi, sozlama o'zgarishi.
- Audit yozuvlari **o'zgartirilmaydi va o'chirilmaydi** (append-only).
- Yoziladigan amallar ro'yxatiga **eksport** (`EXPORT`) ham kiradi: kim, qaysi hisobotni,
  qanday filtr bilan, qaysi formatda yuklab oldi.
- Faqat bosh super admin ko'radi. Filtr: sana, foydalanuvchi, obyekt turi, amal, kanal.
- **Audit jurnali Excel (.xlsx) ga eksport qilinadi** (E9) — amaldagi filtrlar bilan.
  Eksport ustunlari: sana/vaqt, foydalanuvchi, rol, amal, obyekt turi, obyekt raqami,
  o'zgargan maydon, eski qiymat, yangi qiymat, kanal, IP.
- `changes` JSON maydoni eksportda maydon-boyicha alohida qatorlarga yoyiladi
  (bitta amalda 3 ta maydon o'zgargan bo'lsa — 3 ta qator).

**Qabul mezoni:**
- Xarajat summasi tahrirlangach audit yozuvida `{ field: "amount", old: X, new: Y }` bo'ladi.
- Audit yozuvini `PUT`/`DELETE` qilish uchun API endpoint umuman mavjud emas.
- Direktor `/api/audit` ga so'rov yuborsa 403 qaytadi.
- Bot orqali qilingan amal audit yozuvida `channel: "telegram"` bilan belgilanadi.
- Audit jurnalini Excelga eksport qilish ishlaydi va faylda eski/yangi qiymat ustunlari
  to'ldirilgan bo'ladi.
- Audit eksportining o'zi ham audit jurnaliga `EXPORT` yozuvi sifatida tushadi.

### 3.15 Sozlamalar

Bosh admin sozlay oladi: valyuta hisob bazasi (AUTO/MANUAL), hisobot davri boshlanish kuni,
ish kunlari, standart til, bildirishnoma yoqish/o'chirish, javobsiz ariza eslatma vaqti
(default 24 soat), tasdiqlangandan keyin tahrirlash oynasi (default 24 soat).

**Qabul mezoni:**
- Sozlama o'zgartirilgach yangi qiymat darhol kuchga kiradi (kesh invalidatsiya qilinadi).
- Har bir sozlama o'zgarishi audit jurnaliga tushadi.
- Direktor sozlamalar sahifasiga kira olmaydi (403).

### 3.16 SaaS tayyorgarligi (multi-tenant arxitektura)

Tizim kelajakda **SaaS** sifatida ko'p kompaniyaga xizmat qiladi va tariflar joriy etiladi.
Sotuv/billing qismi hozir qurilmaydi (1.3-band), lekin **poydevor birinchi kundan
shunday quriladi** — keyin retrofit qilish qimmatga tushadi.

#### 3.16.1 Tenant izolyatsiyasi

- Model: **bitta baza + `companyId` ustuni** (shared DB, row-level isolation).
- Istisno: platforma darajasidagi jadvallar (`Company`, `Plan`, `TelegramSession`,
  `TelegramLoginAttempt`) — 5.3-bandga qarang. Ular middleware allow-list ida aniq belgilanadi.
- **Har bir biznes jadvalida `companyId` majburiy** (`Branch`, `Employee`, `User`,
  `Category`, `Expense`, `ExpenseShare`, `ExpenseFile`, `Refund`, `EditRequest`, `Budget`,
  `CurrencyRate`, `Notification`, `AuditLog`, `Setting`, `ExportJob` — istisnosiz hammasi).
- Tenant konteksti so'rov boshida aniqlanadi (JWT `companyId` claim yoki bot orqali
  xodim → kompaniya) va `AsyncLocalStorage` da saqlanadi.
- **Prisma middleware / extension** barcha `find*`, `update*`, `delete*` so'rovlariga
  avtomatik `WHERE companyId = ctx.companyId` qo'shadi va `create` da `companyId` ni
  avtomatik to'ldiradi. Qo'lda filtr yozishga tayanilmaydi.
- Kontekstsiz (companyId aniqlanmagan) biznes so'rov **xato beradi**, hammasini
  qaytarmaydi — bu eng xavfli nosozlik turi.
- Fayl storage kalitlari `companyId` bilan prefikslanadi: `{companyId}/expenses/{id}/{file}`.
- Redis kalitlari va kesh ham `companyId` bilan prefikslanadi (kesh oqib ketmasligi uchun).
- BullMQ job payload larida `companyId` majburiy maydon.

#### 3.16.2 Unikallik doirasi

Hozir bitta kompaniya bo'lsa ham, unikal cheklovlar **tenant doirasida** yoziladi
(global emas) — keyin migratsiya qilish shart bo'lmasligi uchun:

| Maydon | Unikallik |
|---|---|
| `User.email` | `UNIQUE(companyId, email)` |
| `Employee.phone` | `UNIQUE(companyId, phone)` |
| `Branch.code` | `UNIQUE(companyId, code)` |
| `Expense.globalNumber` | `UNIQUE(companyId, globalNumber)` |
| `Expense.branchNumber` | `UNIQUE(companyId, branchId, branchSeqYear, seq)` |
| `TelegramAccountLink` | `UNIQUE(telegramId, userId)` — bitta Telegram akkaunt **ko'p hisobga** bog'lanadi |
| `Company.slug` | `UNIQUE` — global |

Ketma-ketliklar (`globalNumber`) ham **har kompaniya uchun alohida** boshlanadi —
yangi kompaniyaning birinchi xarajati `EXP-000001` bo'ladi.

#### 3.16.3 Rollar iyerarxiyasi

Yangi rol qo'shiladi (hozir faqat texnik foydalanish uchun, UI minimal):

- **`PLATFORM_OWNER`** (platforma egasi) — kompaniyalarni yaratadi/o'chiradi, tariflarni
  belgilaydi, barcha tenantlar ustidan texnik nazorat. Bu **`ADMIN` dan yuqori** rol.
- `ADMIN` (bosh super admin) — endi **kompaniya doirasida** eng yuqori rol.
- `DIRECTOR`, `WORKER` — o'zgarishsiz.

`ADMIN` hech qachon boshqa kompaniya ma'lumotini ko'ra olmaydi — bu server tomonda
majburlanadi va alohida test bilan qamrab olinadi.

#### 3.16.4 Tarif (plan) modeli

Tariflar hozir **sotilmaydi va UI si qurilmaydi**, lekin model va tekshiruv nuqtalari
tayyorlanadi:

- `Plan` va `CompanySubscription` jadvallari yaratiladi.
- Cheklov o'lchovlari (foydalanuvchi tanlovi bo'yicha):
  - **`maxBranches`** — filiallar soni
  - **`maxEmployees`** — faol xodimlar soni
- Standart `DEFAULT` tarif seed qilinadi: ikkala limit ham `null` (= cheksiz).
  Mavjud yagona kompaniya shu tarifga bog'lanadi — ya'ni hozirgi xatti-harakat o'zgarmaydi.
- Filial va xodim yaratish servislarida **limit tekshirish nuqtasi (hook)** yoziladi:
  limit `null` bo'lsa o'tkazadi, son bo'lsa tekshiradi va oshsa `403 PLAN_LIMIT_EXCEEDED`
  qaytaradi. Bu nuqta hozir ham kod ichida mavjud bo'ladi, faqat hech qachon ishga tushmaydi.
- Kelajakda qo'shilishi mumkin bo'lgan o'lchovlar (`maxExpensesPerMonth`, `storageGb`)
  uchun `Plan` jadvalida joy qoldiriladi, lekin tekshiruvi yozilmaydi.

#### 3.16.5 Telegram bot SaaS rejimi

**Ikkala rejim ham qo'llab-quvvatlanadi:**

1. **Umumiy bot (default)** — barcha kompaniyalar bitta platforma botidan foydalanadi.
   Tenant **login+parol orqali aniqlanadi**: `User` topilgach uning `companyId` si
   kontekst bo'ladi. Telefon raqami tenant aniqlashda qatnashmaydi.
2. **Kompaniyaning o'z boti** — kompaniya o'z brendida bot ochadi, tokenni sozlamalarga
   kiritadi (`Company.telegramBotToken`, shifrlangan holda saqlanadi). Bu bot faqat
   shu kompaniya xodimlariga xizmat qiladi.

- Bot ishga tushirish qatlami **token → companyId** xaritasi bilan ishlaydi
  (bitta jarayonda bir nechta Telegraf instansi).
- Kompaniya boti sozlanmagan bo'lsa avtomatik umumiy botga tushadi.
- **Kompaniya botida** kirish faqat o'sha kompaniya hisoblari bilan mumkin: boshqa
  kompaniya logini bilan kirishga urinish rad etiladi. Shu sababli kompaniya botida
  "Hisobni almashtirish" faqat o'sha kompaniya ichidagi hisoblar bilan cheklanadi.
- **Umumiy botda** foydalanuvchi turli kompaniyalardagi hisoblarini bog'lab, ular
  o'rtasida almashtira oladi (3.12.2).
- Bot sessiya kaliti: `bot:{botId}:{telegramId}`; faol tenant `activeLinkId` orqali
  aniqlanadi va har bir amalda `companyId` konteksti shundan olinadi.

#### 3.16.6 Nimalar hozir qurilmaydi

Faqat model va hook — UI va biznes jarayoni yo'q: tarif tanlash ekrani, to'lov, invoys,
trial muddati, self-service ro'yxatdan o'tish, kompaniya onboarding sehrgari, obuna bekor
qilish, platforma admin paneli (kompaniyalar `PLATFORM_OWNER` tomonidan seed/CLI orqali yaratiladi).

**Qabul mezoni:**
- Barcha biznes jadvallarida `companyId` ustuni mavjud va `NOT NULL`
  (sxema bo'yicha avtomatik test tekshiradi).
- Prisma middleware o'chirilganda tenant izolyatsiya testi **yiqiladi** — ya'ni
  izolyatsiya qo'lda yozilgan filtrlarga emas, markazlashgan qatlamga tayanadi.
- Ikkita kompaniya seed qilinganda: A kompaniya `ADMIN` i B kompaniya xarajatini
  `GET /api/expenses/:id` bilan so'rasa 404 qaytadi; ro'yxatda ham B ning yozuvlari chiqmaydi.
- A kompaniya `ADMIN` i B kompaniya `branchId` si bilan xarajat yaratmoqchi bo'lsa 422/403 qaytadi.
- Hisobot va eksport natijalarida boshqa kompaniya yozuvi umuman uchramaydi
  (ikki tenantli ma'lumot bilan integratsion test).
- Har ikkala kompaniyada ham xarajat raqamlanishi `EXP-000001` dan mustaqil boshlanadi
  va bir-biriga ta'sir qilmaydi.
- Bir xil email bilan ikki xil kompaniyada foydalanuvchi yaratish **muvaffaqiyatli** o'tadi.
- Bir xil `telegramId` ikkita turli kompaniya hisobiga bog'lanishi **muvaffaqiyatli** o'tadi
  va ikkalasi almashtirish ro'yxatida ko'rinadi.
- Kompaniya botida boshqa kompaniya logini bilan kirishga urinish rad etiladi.
- `DEFAULT` tarifda `maxBranches=null` bo'lganda 100 ta filial yaratish muvaffaqiyatli o'tadi.
- `maxBranches=3` qilib qo'yilgan test tarifida 4-chi filial `403 PLAN_LIMIT_EXCEEDED` qaytaradi
  (hook ishlayotganini isbotlaydi).
- Kompaniya o'z bot tokenini kiritsa, shu bot orqali kelgan xabarlar o'sha kompaniya
  kontekstida qayta ishlanadi; token bazada ochiq matnda saqlanmaydi.
- Telefon raqami ikki kompaniyada topilganda umumiy bot kompaniya tanlash tugmalarini ko'rsatadi.
- Fayl storage kaliti `{companyId}/` bilan boshlanadi va boshqa kompaniya signed URL
  ololmaydi (403).

---

## 4. Nofunksional talablar

### 4.1 Ishlash

- Xarajatlar ro'yxati sahifasi 10 000 yozuv bazada bo'lganda ≤ 2 soniyada yuklanadi (pagination bilan).
- Telegram bot javobi ≤ 2 soniya (p95).
- Dashboard KPI so'rovlari ≤ 3 soniya; og'ir agregatlar keshlanadi (Redis, TTL 5 daqiqa).
- Eksport 10 000 yozuv uchun ≤ 30 soniya, fon rejimida.
- Kengayuvchanlik: filiallar soni 4–5 dan 50+ gacha o'sishga tayyor; indekslar
  `branchId`, `employeeId`, `categoryId`, `date`, `status` bo'yicha.

### 4.2 Xavfsizlik

- Parollar `argon2id` bilan hash.
- JWT access (15 daq) + refresh (7 kun), refresh rotatsiyasi.
- RBAC + **tenant scope** + filial scope server tomonda majburlanadi. Tenant izolyatsiyasi
  markazlashgan Prisma qatlamida, endpoint kodiga tayanmaydi.
- `Company.telegramBotToken` bazada shifrlangan holda saqlanadi (AES-GCM, kalit `.env` da).
- Fayllarga kirish faqat vaqtinchalik **signed URL** orqali (TTL 15 daqiqa).
- Rate limiting: auth endpointlar 5 req/min, umumiy API 100 req/min per IP.
- Kiruvchi ma'lumot `class-validator` bilan tekshiriladi (whitelist + forbidNonWhitelisted).
- SQL injection — ORM parametrizatsiyasi; XSS — React eskeypi + CSP sarlavhalari.
- Yuklangan fayl turi va MIME tekshiriladi (faqat jpg/png/webp/pdf).
- Sirlar `.env` da, repozitoriyga tushmaydi; `.env.example` shablon sifatida.
- Ma'lumot butunligi: xarajatlar hech qachon fizik o'chirilmaydi (soft delete + audit).
- Zaxira nusxa: kunlik avtomatik PostgreSQL dump, 30 kun saqlash, tiklash skripti bilan.

### 4.3 Kirish imkoniyati va UX

- Tillar: **o'zbek (lotin)** va **rus** — web va botda to'liq (i18n, hardcode matn yo'q).
- Vaqt zonasi: **Asia/Tashkent**; bazada UTC saqlanadi.
- Responsive: desktop birinchi, planshetda to'liq ishlaydi.
- Brauzerlar: Chrome, Edge, Firefox, Safari — oxirgi 2 versiya.
- Klaviatura navigatsiyasi asosiy formalarda ishlaydi, fokus ko'rinadigan bo'ladi.
- Rang kontrasti WCAG AA darajasida.
- Jadval ustunlarini sozlash, bulk-amallar, saqlanadigan filtrlar.
- Qorong'i rejim — ixtiyoriy (nice-to-have).

---

## 5. Texnik arxitektura

### 5.1 Stek

| Qatlam | Texnologiya |
|---|---|
| Backend | **NestJS** (Node.js 20+, TypeScript) |
| Ma'lumotlar bazasi | **PostgreSQL 16** |
| ORM | **Prisma** |
| Kesh / navbat | **Redis 7 + BullMQ** |
| Frontend | **React 18 + TypeScript + Vite** |
| UI | **shadcn/ui + TailwindCSS** |
| Grafiklar | **Recharts** |
| Telegram bot | **Telegraf** (NestJS ichida modul, bitta jarayon) |
| Fayl saqlash | **MinIO** (S3-mos), prodda cloud S3 ham mumkin |
| Auth | JWT (access + refresh), RBAC |
| Eksport | `exceljs` (xlsx), `puppeteer` yoki `pdfmake` (pdf) |
| Test | Jest (unit), Supertest + Testcontainers (integratsion), Playwright (e2e) |
| Deploy | **Docker + docker-compose**, Nginx reverse proxy; bulut: VPS |
| Monitoring | Sentry (xatolar), strukturaviy JSON loglar (pino) |
| CI | GitHub Actions: lint → test → build → image |

### 5.2 Papka tuzilmasi

```
/
├─ apps/
│  ├─ api/                      # NestJS backend + Telegram bot
│  │  ├─ src/
│  │  │  ├─ modules/
│  │  │  │  ├─ tenancy/          # companyId konteksti, Prisma middleware, guard
│  │  │  │  ├─ companies/        # Company, Plan, CompanySubscription (minimal)
│  │  │  │  ├─ auth/
│  │  │  │  ├─ users/
│  │  │  │  ├─ branches/
│  │  │  │  ├─ employees/
│  │  │  │  ├─ categories/
│  │  │  │  ├─ expenses/
│  │  │  │  ├─ approvals/
│  │  │  │  ├─ refunds/
│  │  │  │  ├─ edit-requests/
│  │  │  │  ├─ budgets/
│  │  │  │  ├─ currency/
│  │  │  │  ├─ notifications/
│  │  │  │  ├─ reports/
│  │  │  │  ├─ files/
│  │  │  │  ├─ audit/
│  │  │  │  ├─ settings/
│  │  │  │  └─ telegram/        # Telegraf sahnalar (scenes)
│  │  │  ├─ common/             # guards, interceptors, filters, decorators
│  │  │  ├─ jobs/               # BullMQ processorlar va cron
│  │  │  └─ main.ts
│  │  ├─ prisma/                # schema.prisma, migrations, seed.ts
│  │  └─ test/
│  └─ web/                      # React + Vite
│     ├─ src/
│     │  ├─ pages/
│     │  ├─ features/
│     │  ├─ components/ui/
│     │  ├─ lib/api/
│     │  ├─ i18n/               # uz.json, ru.json
│     │  └─ main.tsx
│     └─ tests/
├─ packages/
│  └─ shared/                   # umumiy tiplar, enumlar, zod sxemalar
├─ docker/                      # Dockerfile lar, nginx.conf
├─ docker-compose.yml
├─ docker-compose.prod.yml
├─ .env.example
└─ docs/                        # deploy.md, user-guide-web.md, user-guide-bot.md
```

### 5.3 Ma'lumot modeli (asosiy jadvallar)

> **Tenant qoidasi:** quyidagi barcha jadvallarda `companyId` maydoni mavjud va `NOT NULL`.
> Takrorlanmasligi uchun har birida qayta yozilmagan.
>
> **Istisnolar (ataylab tenantdan tashqari):** `Company`, `Plan`, `TelegramSession`,
> `TelegramLoginAttempt` — bular platforma darajasidagi jadvallar, chunki bitta Telegram
> akkaunt bir nechta kompaniyaga tegishli bo'lishi mumkin. Bu jadvallar Prisma tenant
> middleware ro'yxatidan **aniq chiqarib qo'yiladi** (allow-list) va ular orqali biznes
> ma'lumotiga kirish har doim `activeLinkId → companyId` konteksti bilan amalga oshiriladi.

```
Company         id, name, slug(unique), status(ACTIVE|SUSPENDED), telegramBotToken(encrypted,
                nullable), timezone, defaultLanguage, createdAt

Plan            id, code(unique), name, maxBranches(nullable), maxEmployees(nullable),
                maxExpensesPerMonth(nullable, hozir tekshirilmaydi),
                storageGb(nullable, hozir tekshirilmaydi)

CompanySubscription  id, companyId, planId, startedAt, expiresAt(nullable), status

User            id, companyId, email, passwordHash,
                role(PLATFORM_OWNER|ADMIN|DIRECTOR|WORKER), employeeId,
                isActive, lastLoginAt, failedLoginCount, lockedUntil
                UNIQUE(companyId, email)

Branch          id, companyId, code(2-5 harf), name, address, phone, openedAt,
                status(ACTIVE|ARCHIVED), createdAt
                UNIQUE(companyId, code)

Employee        id, companyId, fullName, position, branchId, phone,
                hiredAt, status(ACTIVE|INACTIVE), language(UZ|RU), botBlocked
                UNIQUE(companyId, phone)
                # telegramId bu yerda emas — TelegramAccountLink da (ko'p hisob uchun)

TelegramAccountLink  id, telegramId, userId, companyId, botId, linkedAt, lastUsedAt,
                     expiresAt(30 kun), isRevoked
                     UNIQUE(telegramId, userId)

TelegramSession      telegramId, botId, activeLinkId, language, flowState(json), updatedAt
                     PRIMARY KEY(telegramId, botId)

TelegramLoginAttempt telegramId, failedCount, lockedUntil, lastAttemptAt

EmployeeTransfer id, employeeId, fromBranchId, toBranchId, movedAt, movedByUserId

Category        id, parentId, name_uz, name_ru, receiptRequired, commentRequired,
                maxAmountPerEntry, status(ACTIVE|ARCHIVED)

Expense         id, globalNumber(unique seq), branchNumber(unique per branch+year),
                branchSeqYear, branchId, categoryId, amount, currency(UZS|USD),
                rateUsed, rateSource(AUTO|MANUAL), amountUzs, date, comment,
                paymentMethod(CASH|CARD|TRANSFER), createdByUserId, channel(WEB|TELEGRAM),
                status, approvedAt, directorApprovedByUserId, adminApprovedByUserId,
                refundedAmount, deletedAt, createdAt, updatedAt

ExpenseShare    id, expenseId, employeeId, amount        # taqsimlash

ExpenseFile     id, expenseId, storageKey, mimeType, sizeBytes, uploadedByUserId

ExpenseStatusHistory  id, expenseId, fromStatus, toStatus, byUserId, reason, createdAt

EditRequest     id, expenseId, requestedByEmployeeId, description, status
                (PENDING|APPLIED|REJECTED), handledByUserId, handledAt

Refund          id, expenseId, amount, currency, reason, status
                (DIRECTOR_PENDING|ADMIN_PENDING|APPROVED|REJECTED),
                requestedByUserId, directorApprovedByUserId, adminApprovedByUserId, createdAt

RefundFile      id, refundId, storageKey, mimeType, sizeBytes

Budget          id, scope(BRANCH|CATEGORY|EMPLOYEE), scopeId, periodType, amount,
                currency, effectiveFrom, effectiveTo

BudgetAlert     id, budgetId, period, threshold(80|100), sentAt

CurrencyRate    id, date, currency, rate, source(AUTO|MANUAL), createdByUserId

Notification    id, userId, type, payload(json), channel, isRead, sentAt

AuditLog        id, userId, action, entityType, entityId, changes(json), ip, channel, createdAt

Setting         key, value(json), updatedByUserId, updatedAt
```

Muhim invariantlar:
- `SUM(ExpenseShare.amount) == Expense.amount` (DB constraint yoki tranzaksiya tekshiruvi)
- `Expense.refundedAmount <= Expense.amount`
- `Expense.amountUzs` yaratilishda hisoblanadi va o'zgarmaydi (kurs snapshot)
- `UNIQUE(companyId, globalNumber)` va `UNIQUE(companyId, branchId, branchSeqYear, seq)`
- `Branch.code` kompaniya doirasida unikal va o'zgarmas (immutable)
- Har bir foreign key bog'lanishida ikkala yozuvning `companyId` si bir xil bo'lishi shart
  (cross-tenant bog'lanish taqiqlanadi — servis qatlamida tekshiriladi)

```
ExportJob       id, requestedByUserId, type(E1..E10), format(XLSX|PDF), filters(json),
                status(QUEUED|RUNNING|DONE|FAILED), storageKey, rowCount,
                createdAt, finishedAt, expiresAt
```

### 5.4 API kontrakt (asosiy endpointlar)

Barchasi `/api` prefiksi ostida, JWT talab qiladi (login/refresh dan tashqari).

```
POST   /auth/login                    { email, password } → { accessToken, user }
POST   /auth/refresh                  → { accessToken }
POST   /auth/logout
POST   /employees/:id/reset-password   [ADMIN | DIRECTOR] → { tempPassword } (bir marta)

# Bot ichki oqimi (HTTP endpoint emas, Telegraf sahnalari):
#   login → parol → TelegramAccountLink yaratish
#   switch-account → activeLinkId almashtirish (parolsiz)
#   logout / logout-all → link(lar)ni bekor qilish

GET    /branches                      ?status=
POST   /branches                      [ADMIN]
PATCH  /branches/:id                  [ADMIN]
POST   /branches/:id/archive          [ADMIN]

GET    /employees                     ?branchId=&status=&q=
POST   /employees                     [ADMIN | DIRECTOR(o'z filiali, WORKER roli)]
PATCH  /employees/:id
POST   /employees/:id/transfer        [ADMIN]

GET    /categories
POST   /categories                    [ADMIN]
PATCH  /categories/:id                [ADMIN]

GET    /expenses                      ?from=&to=&branchId=&categoryId=&employeeId=
                                      &status=&minAmount=&maxAmount=&page=&limit=
POST   /expenses
GET    /expenses/:id
PATCH  /expenses/:id                  [ADMIN | DIRECTOR] + reason, 24 soat oynasi
DELETE /expenses/:id                  [ADMIN] soft delete
POST   /expenses/:id/approve          [DIRECTOR → ADMIN_PENDING] | [ADMIN → APPROVED]
POST   /expenses/:id/reject           { reason }
POST   /expenses/:id/request-fix      { reason }
POST   /expenses/bulk-approve         { ids[] }
POST   /expenses/:id/files            multipart
GET    /files/:id/url                 → signed URL

GET    /edit-requests                 ?status=
POST   /edit-requests                 [bot: WORKER]
POST   /edit-requests/:id/apply       [ADMIN | DIRECTOR]
POST   /edit-requests/:id/reject      { reason }

GET    /refunds                       ?status=&expenseId=
POST   /refunds                       { expenseId, amount, reason } + files (majburiy)
POST   /refunds/:id/approve
POST   /refunds/:id/reject            { reason }

GET    /budgets
POST   /budgets                       [ADMIN]
PATCH  /budgets/:id                   [ADMIN]

GET    /currency/rates                ?from=&to=
POST   /currency/rates                [ADMIN] qo'lda kurs
GET    /settings                      [ADMIN]
PATCH  /settings                      [ADMIN]

GET    /reports/summary               ?period=&branchId=
GET    /reports/by-branch
GET    /reports/by-category
GET    /reports/by-employee
GET    /reports/budget-vs-actual
POST   /exports                       { type: E1..E10, filters, format: xlsx|pdf } → { jobId }
GET    /exports/:jobId                → { status, rowCount, downloadUrl? }
GET    /exports                       → o'z eksport tarixi (oxirgi 24 soat)

GET    /notifications                 ?isRead=
POST   /notifications/:id/read

GET    /audit                         [ADMIN] ?from=&to=&userId=&entityType=
```

Xato formati yagona: `{ statusCode, code, message, details? }`, xabarlar i18n kalitlari bilan.

### 5.5 Web ERP ekranlari

| # | Ekran | Kim ko'radi |
|---|---|---|
| 1 | Kirish (login) | Barchasi |
| 2 | Dashboard (KPI + grafiklar) | Admin, Direktor |
| 3 | Xarajatlar ro'yxati (filtr, qidiruv, jadval, bulk) | Admin, Direktor |
| 4 | Xarajat kartochkasi (detal + chek + tarix + izohlar) | Admin, Direktor |
| 5 | Tasdiqlash navbati (1-bosqich / 2-bosqich tablar) | Admin, Direktor |
| 6 | Qaytarish so'rovlari | Admin, Direktor |
| 7 | Tahrirlash murojaatlari | Admin, Direktor |
| 8 | Filiallar ro'yxati va kartochkasi | Admin |
| 9 | Xodimlar ro'yxati va kartochkasi | Admin, Direktor |
| 10 | Kategoriyalar boshqaruvi | Admin |
| 11 | Byudjetlar / limitlar | Admin |
| 12 | Hisobotlar (konstruktor + eksport) | Admin, Direktor |
| 13 | Valyuta kurslari | Admin |
| 14 | Foydalanuvchilar va rollar | Admin |
| 15 | Audit jurnali (filtr + Excel eksport) | Admin |
| 15a | Eksportlar tarixi (holat + yuklab olish) | Admin, Direktor |
| 16 | Sozlamalar | Admin |
| 17 | Profil | Barchasi |

---

## 6. Testlash strategiyasi

| Daraja | Nima test qilinadi | Vosita | Buyruq |
|---|---|---|---|
| Unit | Taqsimlash matematikasi, kurs konvertatsiyasi, byudjet foizi, effektiv summa, status mashinasi | Jest | `npm run test:unit` |
| Integratsion | API endpointlar, RBAC va filial scope, tranzaksiyalar, soft delete, audit yozuvi | Supertest + Testcontainers (real Postgres) | `npm run test:int` |
| **Tenant izolyatsiya** | Ikki kompaniya seed → har bir endpoint, hisobot, eksport, fayl va bot oqimida ma'lumot oqib ketmasligi | Supertest + Testcontainers | `npm run test:tenancy` |
| Bot | Telegraf sahnalari: xarajat oqimi, orqaga/bekor qilish, sessiya tiklanishi | Jest + Telegraf test harness | `npm run test:bot` |
| E2E | Login → xarajat → 2 bosqich tasdiqlash → qaytarish → hisobot eksport | Playwright | `npm run test:e2e` |
| Lint/Type | ESLint, Prettier, `tsc --noEmit` | — | `npm run lint && npm run typecheck` |

Qoidalar:
- Integratsion testlar **mock DB ishlatmaydi** — Testcontainers orqali real Postgres.
- Har bir 3.x bandidagi qabul mezoni uchun kamida bitta avtomatlashtirilgan test bo'ladi.
- Pul hisob-kitobi bilan bog'liq kod uchun test qamrovi ≥ 90%; umumiy backend ≥ 75%.
- CI da barcha darajalar ishlaydi; qizil test bilan merge qilinmaydi.
- Barcha yangi API endpoint uchun kamida: happy path + auth/403 + validatsiya 422 testi
  + **cross-tenant 404 testi**.
- `test:tenancy` CI da majburiy — u yiqilsa merge bloklanadi.

---

## 7. Tayyorlik ta'rifi (Definition of Done)

- [ ] Uchala rol o'z huquqlari doirasida ishlaydi, huquqdan tashqari amal server tomonda bloklanadi
- [ ] Ishchi bot orqali chek bilan xarajat kirita oladi
- [ ] Har bir xarajat ikki bosqichdan (direktor → bosh admin) o'tadi, summadan qat'i nazar
- [ ] Ishchi va direktor har bir status o'zgarishida bildirishnoma oladi
- [ ] Tasdiqlangan xarajat 24 soat ichida sabab bilan tahrirlanadi; ishchi murojaat yubora oladi
- [ ] Qaytarish (to'liq va qisman) oqimi ishlaydi, isbot majburiy, hisobotdan chegiriladi
- [ ] Bir nechta bosh admin qo'llab-quvvatlanadi; bosh admin o'zinikini tasdiqlay olmaydi
- [ ] Byudjet limiti oshganda ogohlantirish ishlaydi (bloklamaydi)
- [ ] Valyuta CBU API dan avtomatik va qo'lda kiritiladi, hisob bazasi tanlanadi, kurs snapshot saqlanadi
- [ ] Bosh admin barcha filiallarni bitta ekranda taqqoslay oladi
- [ ] Har bir xarajat ikkita raqamga ega: global (`EXP-000123`) va filial (`CHL-2026-0045`)
- [ ] E1–E10 eksport turlari Excel (.xlsx) ga ishlaydi, hisobotlar PDF ga ham chiqadi
- [ ] Audit jurnali (loglar) Excelga eksport qilinadi, faqat bosh admin uchun
- [ ] Eksport rol/filial doirasiga bo'ysunadi va har bir eksport audit ga yoziladi
- [ ] Har bir muhim o'zgarish audit jurnaliga eski→yangi qiymat bilan tushadi
- [ ] Tizim o'zbek va rus tillarida to'liq ishlaydi (web + bot), hardcode matn yo'q
- [ ] `docker-compose up` bilan loyiha bir buyruqda ko'tariladi (api, web, postgres, redis, minio, nginx)
- [ ] Prod deploy (VPS) hujjati va kunlik DB backup skripti topshirilgan
- [ ] Barcha testlar CI da yashil, qamrov chegaralari bajarilgan
- [ ] Foydalanuvchi qo'llanmasi: `docs/user-guide-web.md` va `docs/user-guide-bot.md`
- [ ] `.env.example` to'liq, sirlar repozitoriyda yo'q
- [ ] Barcha biznes jadvallarida `companyId` mavjud, izolyatsiya markazlashgan Prisma
      qatlamida ishlaydi va `test:tenancy` to'liq yashil
- [ ] Unikal cheklovlar tenant doirasida; xarajat raqamlanishi har kompaniyada mustaqil
- [ ] `Plan` / `CompanySubscription` modeli va limit-hook lari mavjud (default cheksiz),
      test tarifi bilan hook ishlayotgani isbotlangan
- [ ] Telegram bot ikkala rejimda ishlaydi: umumiy platforma boti va kompaniya o'z boti
- [ ] Botga kirish **login + parol** orqali; parol xabari darhol o'chiriladi va loglarda yo'q
- [ ] Botda **hisobni almashtirish** ishlaydi: bir nechta hisob bog'lanadi, parolsiz
      almashadi, kontekst (kompaniya/rol) to'g'ri o'zgaradi
- [ ] Seed skripti: **2 kompaniya** (tenant izolyatsiyani isbotlash uchun), har birida
      2 bosh admin, 2 filial (kodlari bilan), 2 direktor, 5 ishchi, kategoriyalar daraxti,
      boshlang'ich valyuta kursi va `DEFAULT` tarif

---

## 8. Ochiq savollar / taxminlar

Odam bilan tasdiqlangan qarorlar (savol emas):
- Valyuta: UZS + USD, kurs CBU API dan **va** qo'lda; hisob bazasini admin tanlaydi
- Byudjet limiti: **yumshoq** — faqat ogohlantiradi, bloklamaydi
- Tasdiqlash: **har doim ikki bosqichli** (direktor → bosh admin), summa chegarasi yo'q
- Tasdiqlangandan keyin tahrirlash: 24 soat, asos majburiy, direktor va bosh admin;
  ishchi bot orqali murojaat yuboradi
- **Qaytarish (refund)** moduli — isbot bilan, ikki bosqichli tasdiqlash
- Chek majburiyligi: kategoriya sozlamasida belgilanadi
- Xodim qo'shish: direktor o'z filialiga, bosh admin barchasiga
- Hisobot davri: kalendar oy (default) + sozlanadigan davr (masalan 25–25)
- Email bildirishnoma: **yo'q**, faqat Telegram + Web
- Excel import: **yo'q**
- Xarajat raqamlash: **ikkalasi ham** — global (`EXP-000123`) va filial ichidagi (`CHL-2026-0045`)
- Eksport: Excelga keng qamrovli (E1–E10), shu jumladan **audit jurnali (loglar)**
- Qaytarish: **to'liq va qisman** — ikkalasi ham qo'llab-quvvatlanadi
- Bosh super admin: **bir nechta**, huquqlari teng; o'zinikini boshqa bosh admin tasdiqlaydi
- **SaaS:** arxitektura multi-tenant qilib yoziladi (bitta baza + `companyId`), lekin
  tariflar sotuvi/billing/self-service hozir qurilmaydi — faqat model va limit-hook lar
- Telegram bot: umumiy platforma boti **va** kompaniyaning o'z boti — ikkalasi ham
- **Botga kirish: login + parol** (telefon raqami orqali emas); web va bot bitta hisobdan
- **Botda hisobni almashtirish (switch account)** — bitta Telegram akkaunt ko'p hisobga bog'lanadi
- Tarif cheklovlari: **filiallar soni** va **xodimlar soni** (boshqalari keyin)

Taxminlar (odam keyin ko'rib chiqadi):

- **[TAXMIN]** Tahrirlash oynasi 24 soat va javobsiz ariza eslatmasi 24 soat —
  ikkalasi ham sozlamada o'zgartiriladi.
- **[TAXMIN]** Fayl limiti: bitta xarajatga 1–5 fayl, har biri ≤10 MB, faqat jpg/png/webp/pdf.
- **[TAXMIN]** Bir martalik yuklash: `maxAmountPerEntry` kategoriya darajasida, majburiy emas.
- **[TAXMIN]** Byudjet ogohlantirish chegaralari 80% va 100% — sozlanmaydi (kodda qat'iy).
- **[TAXMIN]** Bot va API bitta NestJS jarayonida ishlaydi (alohida servis emas) —
  yuk oshsa ajratish mumkin.
- **[TAXMIN]** MinIO lokal va prodda ishlatiladi; cloud S3 ga o'tish konfiguratsiya orqali.
- **[TAXMIN]** PDF eksport `puppeteer` bilan (Docker image kattaroq bo'ladi); yengilroq
  variant kerak bo'lsa `pdfmake` ga o'tiladi.
- **[TAXMIN]** Prod deploy: VPS + Docker Compose + Nginx + Let's Encrypt. Kubernetes emas.
- **[TAXMIN]** Filial raqami formati `CHL-2026-0045` (filial kodi + yil + 4 xonali seq)
  va har yil 1 dan qayta boshlanadi. Boshqa format kerak bo'lsa oson o'zgartiriladi.
- **[TAXMIN]** Eksport fayllari 24 soatdan keyin avtomatik o'chiriladi.
- **[TAXMIN]** Fon rejimiga o'tish chegarasi 1 000 qator.
- **[TAXMIN]** Audit eksporti faqat xlsx (PDF kerak emas — jadval juda keng).
- **[TAXMIN]** Kompaniyalar hozir `PLATFORM_OWNER` tomonidan seed/CLI orqali yaratiladi;
  platforma admin paneli UI si qurilmaydi.
- **[TAXMIN]** `Company.timezone` va `defaultLanguage` kompaniya darajasida sozlanadi;
  hozirgi yagona kompaniya uchun `Asia/Tashkent` va `UZ`.
- **[TAXMIN]** Bot sessiyasi 30 kun; muddat tugagach qayta login so'raladi.
- **[TAXMIN]** Login sifatida **email** ishlatiladi (username ham qo'llab-quvvatlanadi,
  lekin default — email).
- **[TAXMIN]** Parolni bot orqali tiklash yo'q — admin/direktor qayta tiklaydi.
- **[TAXMIN]** Xodim yaratilganda parol avtomatik generatsiya qilinadi va bir marta
  ko'rsatiladi; xodim uni birinchi kirishda o'zgartirishi **majburiy emas**.
- **[TAXMIN]** Bildirishnomalar barcha bog'langan hisoblar bo'yicha keladi (faol
  bo'lmaganlari ham), sarlavhada kompaniya nomi ko'rsatiladi.
- **[TAXMIN]** `Company.status = SUSPENDED` bo'lganda login va bot bloklanadi, lekin
  ma'lumot saqlanadi (obuna to'xtatilishi uchun tayyorgarlik).
- **[TAXMIN]** Tarif limiti oshganda faqat **yangi yaratish** bloklanadi; mavjud
  filial/xodimlar o'chirilmaydi va ishlashda davom etadi.
- **[TAXMIN]** Ishchi Web ERP ga umuman kira olmaydi (faqat o'qish uchun ham).
- **[TAXMIN]** Dublikat aniqlash oynasi 10 daqiqa, faqat ogohlantiradi.
