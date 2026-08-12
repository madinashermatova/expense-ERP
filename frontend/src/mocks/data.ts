export interface Branch {
  id: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  openedAt?: string;
  directorId?: string;
  directorName?: string;
  status: 'active' | 'archived';
  employeeCount: number;
  monthlySpend: number;
  monthlyLimit: number;
}

export interface Employee {
  id: string;
  fullName: string;
  position?: string;
  branchId: string;
  branchName?: string;
  phone?: string;
  hiredAt?: string;
  role: 'PLATFORM_OWNER' | 'ADMIN' | 'DIRECTOR' | 'WORKER';
  email: string;
  username?: string;
  status: 'active' | 'inactive';
  telegramUsername?: string;
  telegramChatId?: string;
  totalExpenses: number;
  currentMonthExpenses: number;
  refundedAmount: number;
}

export interface Category {
  id: string;
  parentId?: string | null;
  nameUz: string;
  nameRu: string;
  receiptRequired: boolean;
  commentRequired: boolean;
  maxAmountPerEntry?: number;
  status: 'active' | 'archived';
  orderIndex: number;
  children?: Category[];
}

export interface ExpenseShare {
  employeeId: string;
  employeeName: string;
  amount: string;
}

export interface ExpenseFile {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
}

export interface StatusHistoryItem {
  id: string;
  status: string;
  changedBy: string;
  changedByName: string;
  timestamp: string;
  reason?: string;
}

export interface Expense {
  id: string;
  globalNumber: string; // e.g. EXP-000123
  branchNumber: string; // e.g. CHL-2026-0045
  date: string;
  branchId: string;
  branchName: string;
  categoryId: string;
  categoryName: string;
  createdById: string;
  createdByName: string;
  amount: string; // Decimal string
  currency: 'UZS' | 'USD';
  amountUzs: string;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER';
  status: 'DRAFT' | 'DIRECTOR_PENDING' | 'ADMIN_PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_FIX' | 'CANCELLED';
  description?: string;
  hasReceipt: boolean;
  isOverLimit?: boolean;
  shares: ExpenseShare[];
  files: ExpenseFile[];
  statusHistory: StatusHistoryItem[];
  createdAt: string;
}

export interface Refund {
  id: string;
  expenseId: string;
  expenseGlobalNumber: string;
  branchId: string;
  branchName: string;
  employeeName: string;
  amount: string;
  originalAmount: string;
  isPartial: boolean;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  files: ExpenseFile[];
  createdAt: string;
  approvedAt?: string;
  approvedByName?: string;
}

export interface EditRequest {
  id: string;
  expenseId: string;
  expenseGlobalNumber: string;
  branchName: string;
  requestedByName: string;
  reason: string;
  originalData: Partial<Expense>;
  requestedData: Partial<Expense>;
  status: 'PENDING' | 'APPLIED' | 'REJECTED';
  createdAt: string;
}

export interface Budget {
  id: string;
  scopeType: 'BRANCH' | 'CATEGORY' | 'EMPLOYEE';
  scopeId: string;
  scopeName: string;
  period: string; // e.g. 2026-08
  amountLimit: number;
  actualAmount: number;
}

export interface CurrencyRate {
  id: string;
  date: string;
  currency: 'USD' | 'EUR' | 'RUB';
  rate: number;
  source: 'CBU' | 'MANUAL';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  entityType: 'EXPENSE' | 'REFUND' | 'EMPLOYEE' | 'BRANCH' | 'CATEGORY' | 'SETTINGS' | 'EDIT_REQUEST';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN';
  channel: 'WEB' | 'TELEGRAM';
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
}

export interface ExportJob {
  id: string;
  type: string; // E1 - E10
  typeName: string;
  format: 'xlsx' | 'pdf';
  filters: Record<string, any>;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
  rowCount: number;
  downloadUrl?: string;
  createdAt: string;
  expiresAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

// Initial Seed Data
export const initialBranches: Branch[] = [
  { id: 'b1', code: 'CHL', name: 'Chilonzor filiali', address: 'Toshkent sh., Bunyodkor ko\'chasi 15-uy', phone: '+998712001122', openedAt: '2023-01-15', directorId: 'u2', directorName: 'Rustam Rahimov', status: 'active', employeeCount: 14, monthlySpend: 24500000, monthlyLimit: 30000000 },
  { id: 'b2', code: 'YUN', name: 'Yunusobod filiali', address: 'Toshkent sh., Amir Temur shoh ko\'chasi 42-uy', phone: '+998712001133', openedAt: '2023-03-01', directorId: 'u3', directorName: 'Jasur Saidov', status: 'active', employeeCount: 12, monthlySpend: 18200000, monthlyLimit: 25000000 },
  { id: 'b3', code: 'MIR', name: 'Mirobod filiali', address: 'Toshkent sh., Nukus ko\'chasi 78-uy', phone: '+998712001144', openedAt: '2023-05-10', directorId: 'u4', directorName: 'Dilshod Karimov', status: 'active', employeeCount: 10, monthlySpend: 28900000, monthlyLimit: 28000000 },
  { id: 'b4', code: 'SAM', name: 'Samarqand filiali', address: 'Samarqand sh., Registon ko\'chasi 12-uy', phone: '+998662002211', openedAt: '2023-08-20', directorId: 'u5', directorName: 'Olim Hakimov', status: 'active', employeeCount: 8, monthlySpend: 14200000, monthlyLimit: 20000000 },
  { id: 'b5', code: 'BUX', name: 'Buxoro filiali', address: 'Buxoro sh., Bahouddin Naqshband ko\'chasi 5-uy', phone: '+998652003322', openedAt: '2023-11-05', directorId: 'u6', directorName: 'Nodir Mahmudov', status: 'active', employeeCount: 7, monthlySpend: 9800000, monthlyLimit: 15000000 },
  { id: 'b6', code: 'NAM', name: 'Namangan filiali', address: 'Namangan sh., Navoiy shoh ko\'chasi 88-uy', phone: '+998692004433', openedAt: '2024-02-14', directorId: 'u7', directorName: 'Aziz Zokirov', status: 'active', employeeCount: 9, monthlySpend: 12400000, monthlyLimit: 18000000 },
  { id: 'b7', code: 'AND', name: 'Andijon filiali', address: 'Andijon sh., Bobur shoh ko\'chasi 33-uy', phone: '+998742005544', openedAt: '2024-04-01', directorId: undefined, directorName: undefined, status: 'active', employeeCount: 6, monthlySpend: 8100000, monthlyLimit: 15000000 },
  { id: 'b8', code: 'FAR', name: 'Farg\'ona filiali', address: 'Farg\'ona sh., Mustaqillik ko\'chasi 19-uy', phone: '+998732006655', openedAt: '2024-06-18', directorId: 'u8', directorName: 'Sanjar Ergashev', status: 'active', employeeCount: 8, monthlySpend: 11500000, monthlyLimit: 16000000 },
  { id: 'b9', code: 'QAR', name: 'Qarshi filiali', address: 'Qarshi sh., Islom Karimov ko\'chasi 4-uy', phone: '+998752007766', openedAt: '2024-09-01', directorId: 'u9', directorName: 'Farhod Aliyev', status: 'active', employeeCount: 5, monthlySpend: 6700000, monthlyLimit: 12000000 },
  { id: 'b10', code: 'URG', name: 'Urganch filiali (Eski)', address: 'Urganch sh., Al-Xorazmiy ko\'chasi 2-uy', phone: '+998622008877', openedAt: '2022-01-10', status: 'archived', employeeCount: 0, monthlySpend: 0, monthlyLimit: 0 }
];

export const initialEmployees: Employee[] = [
  { id: 'u1', fullName: 'Bekzod Abdullayev (Admin)', position: 'Bosh administrator', branchId: 'b1', branchName: 'Chilonzor filiali', phone: '+998901234567', hiredAt: '2022-01-01', role: 'ADMIN', email: 'admin@erp.uz', username: 'admin', status: 'active', telegramUsername: '@bekzod_admin', totalExpenses: 45000000, currentMonthExpenses: 3200000, refundedAmount: 0 },
  { id: 'u2', fullName: 'Rustam Rahimov (Direktor)', position: 'Filial direktori', branchId: 'b1', branchName: 'Chilonzor filiali', phone: '+998902345678', hiredAt: '2023-01-15', role: 'DIRECTOR', email: 'director@erp.uz', username: 'director_chl', status: 'active', telegramUsername: '@rustam_director', totalExpenses: 38000000, currentMonthExpenses: 2800000, refundedAmount: 450000 },
  { id: 'u3', fullName: 'Jasur Saidov', position: 'Filial direktori', branchId: 'b2', branchName: 'Yunusobod filiali', phone: '+998903456789', hiredAt: '2023-03-01', role: 'DIRECTOR', email: 'jasur@erp.uz', username: 'director_yun', status: 'active', telegramUsername: '@jasur_yun', totalExpenses: 29000000, currentMonthExpenses: 1900000, refundedAmount: 0 },
  { id: 'u4', fullName: 'Dilshod Karimov', position: 'Filial direktori', branchId: 'b3', branchName: 'Mirobod filiali', phone: '+998904567890', hiredAt: '2023-05-10', role: 'DIRECTOR', email: 'dilshod@erp.uz', username: 'director_mir', status: 'active', telegramUsername: '@dilshod_mir', totalExpenses: 41000000, currentMonthExpenses: 3900000, refundedAmount: 800000 },
  { id: 'u10', fullName: 'Alisher Qodirov (Xodim)', position: 'Savdo menejeri', branchId: 'b1', branchName: 'Chilonzor filiali', phone: '+998931112233', hiredAt: '2023-02-01', role: 'WORKER', email: 'worker@erp.uz', username: 'worker_chl', status: 'active', telegramUsername: '@alisher_q', totalExpenses: 18500000, currentMonthExpenses: 1500000, refundedAmount: 120000 },
  { id: 'u11', fullName: 'Malika Usmonova', position: 'Buxgalter', branchId: 'b1', branchName: 'Chilonzor filiali', phone: '+998932223344', hiredAt: '2023-02-15', role: 'WORKER', email: 'malika@erp.uz', username: 'malika_u', status: 'active', telegramUsername: '@malika_acc', totalExpenses: 14200000, currentMonthExpenses: 1100000, refundedAmount: 0 },
  { id: 'u12', fullName: 'Sherzod Toirov', position: 'Haydovchi / Ta\'minotchi', branchId: 'b1', branchName: 'Chilonzor filiali', phone: '+998933334455', hiredAt: '2023-03-10', role: 'WORKER', email: 'sherzod@erp.uz', username: 'sherzod_t', status: 'active', telegramUsername: '@sherzod_driver', totalExpenses: 22400000, currentMonthExpenses: 2100000, refundedAmount: 350000 },
  { id: 'u13', fullName: 'Zarina Normatova', position: 'Marketing mutaxassisi', branchId: 'b1', branchName: 'Chilonzor filiali', phone: '+998934445566', hiredAt: '2023-04-01', role: 'WORKER', email: 'zarina@erp.uz', username: 'zarina_n', status: 'active', telegramUsername: '@zarina_mkt', totalExpenses: 19800000, currentMonthExpenses: 1750000, refundedAmount: 0 },
  { id: 'u14', fullName: 'Bobur Mirzayev', position: 'IT mutaxassisi', branchId: 'b2', branchName: 'Yunusobod filiali', phone: '+998935556677', hiredAt: '2023-03-15', role: 'WORKER', email: 'bobur@erp.uz', username: 'bobur_it', status: 'active', telegramUsername: '@bobur_dev', totalExpenses: 16700000, currentMonthExpenses: 1300000, refundedAmount: 0 },
  { id: 'u15', fullName: 'Nigora Ahmedova', position: 'Ofis menejeri', branchId: 'b2', branchName: 'Yunusobod filiali', phone: '+998936667788', hiredAt: '2023-04-20', role: 'WORKER', email: 'nigora@erp.uz', username: 'nigora_a', status: 'active', telegramUsername: '@nigora_office', totalExpenses: 12900000, currentMonthExpenses: 950000, refundedAmount: 0 },
  { id: 'u16', fullName: 'Farrux Shukurov', position: 'Logistika koordinatori', branchId: 'b3', branchName: 'Mirobod filiali', phone: '+998937778899', hiredAt: '2023-05-15', role: 'WORKER', email: 'farrux@erp.uz', username: 'farrux_s', status: 'active', telegramUsername: '@farrux_log', totalExpenses: 28400000, currentMonthExpenses: 2400000, refundedAmount: 500000 },
];

export const initialCategories: Category[] = [
  {
    id: 'c1',
    nameUz: 'Ofis va ma\'muriy xarajatlar',
    nameRu: 'Офисные и административные расходы',
    receiptRequired: true,
    commentRequired: false,
    maxAmountPerEntry: 10000000,
    status: 'active',
    orderIndex: 1,
    children: [
      { id: 'c1_1', parentId: 'c1', nameUz: 'Kantselyariya mollari', nameRu: 'Канцтовары', receiptRequired: true, commentRequired: false, maxAmountPerEntry: 2000000, status: 'active', orderIndex: 1 },
      { id: 'c1_2', parentId: 'c1', nameUz: 'Kofe-breyk va suv', nameRu: 'Кофе-брейк и вода', receiptRequired: false, commentRequired: false, maxAmountPerEntry: 1500000, status: 'active', orderIndex: 2 },
      { id: 'c1_3', parentId: 'c1', nameUz: 'Tozalash va gigiyena vositalari', nameRu: 'Средства уборки и гигиены', receiptRequired: true, commentRequired: false, maxAmountPerEntry: 3000000, status: 'active', orderIndex: 3 },
    ]
  },
  {
    id: 'c2',
    nameUz: 'Transport va yoqilg\'i',
    nameRu: 'Транспорт и топливо',
    receiptRequired: true,
    commentRequired: true,
    maxAmountPerEntry: 5000000,
    status: 'active',
    orderIndex: 2,
    children: [
      { id: 'c2_1', parentId: 'c2', nameUz: 'Benzin va yoqilg\'i', nameRu: 'Бензин и топливо', receiptRequired: true, commentRequired: true, maxAmountPerEntry: 2000000, status: 'active', orderIndex: 1 },
      { id: 'c2_2', parentId: 'c2', nameUz: 'Taksi va jamoat transporti', nameRu: 'Такси и общественный транспорт', receiptRequired: true, commentRequired: true, maxAmountPerEntry: 500000, status: 'active', orderIndex: 2 },
      { id: 'c2_3', parentId: 'c2', nameUz: 'Avtoulov ta\'miri va yuvish', nameRu: 'Ремонт авто и автомойка', receiptRequired: true, commentRequired: true, maxAmountPerEntry: 4000000, status: 'active', orderIndex: 3 },
    ]
  },
  {
    id: 'c3',
    nameUz: 'Marketing va reklama',
    nameRu: 'Маркетинг и реклама',
    receiptRequired: true,
    commentRequired: true,
    maxAmountPerEntry: 25000000,
    status: 'active',
    orderIndex: 3,
    children: [
      { id: 'c3_1', parentId: 'c3', nameUz: 'Target va onlayn reklama', nameRu: 'Таргетинг и онлайн реклама', receiptRequired: true, commentRequired: true, maxAmountPerEntry: 20000000, status: 'active', orderIndex: 1 },
      { id: 'c3_2', parentId: 'c3', nameUz: 'Banner va poligrafiya', nameRu: 'Баннеры и полиграфия', receiptRequired: true, commentRequired: false, maxAmountPerEntry: 5000000, status: 'active', orderIndex: 2 },
    ]
  },
  {
    id: 'c4',
    nameUz: 'IT va texnika uskunalari',
    nameRu: 'IT и техническое оборудование',
    receiptRequired: true,
    commentRequired: true,
    maxAmountPerEntry: 15000000,
    status: 'active',
    orderIndex: 4,
    children: [
      { id: 'c4_1', parentId: 'c4', nameUz: 'Dasturiy ta\'minot litsenziyalari', nameRu: 'Лицензии ПО', receiptRequired: true, commentRequired: true, maxAmountPerEntry: 8000000, status: 'active', orderIndex: 1 },
      { id: 'c4_2', parentId: 'c4', nameUz: 'Kompyuter ehtiyot qismlari', nameRu: 'Компьютерные комплектующие', receiptRequired: true, commentRequired: true, maxAmountPerEntry: 10000000, status: 'active', orderIndex: 2 },
    ]
  },
  {
    id: 'c5',
    nameUz: 'Xizmat safari (Komandirovka)',
    nameRu: 'Командировочные расходы',
    receiptRequired: true,
    commentRequired: true,
    maxAmountPerEntry: 12000000,
    status: 'active',
    orderIndex: 5,
    children: [
      { id: 'c5_1', parentId: 'c5', nameUz: 'Mehmonxona to\'lovi', nameRu: 'Оплата гостиницы', receiptRequired: true, commentRequired: true, maxAmountPerEntry: 6000000, status: 'active', orderIndex: 1 },
      { id: 'c5_2', parentId: 'c5', nameUz: 'Aviabilet va poyezd chiptalari', nameRu: 'Авиа и ж/д билеты', receiptRequired: true, commentRequired: true, maxAmountPerEntry: 5000000, status: 'active', orderIndex: 2 },
    ]
  },
];

export const initialExpenses: Expense[] = [
  {
    id: 'exp-1',
    globalNumber: 'EXP-000101',
    branchNumber: 'CHL-2026-0041',
    date: '2026-08-11',
    branchId: 'b1',
    branchName: 'Chilonzor filiali',
    categoryId: 'c1_1',
    categoryName: 'Kantselyariya mollari',
    createdById: 'u11',
    createdByName: 'Malika Usmonova',
    amount: '480000.00',
    currency: 'UZS',
    amountUzs: '480000.00',
    paymentMethod: 'CARD',
    status: 'DIRECTOR_PENDING',
    description: 'Filial xodimlari uchun oylik A4 qog\'oz, ruchkalar va papkalar xaridi.',
    hasReceipt: true,
    isOverLimit: false,
    shares: [
      { employeeId: 'u11', employeeName: 'Malika Usmonova', amount: '240000.00' },
      { employeeId: 'u10', employeeName: 'Alisher Qodirov', amount: '240000.00' }
    ],
    files: [
      { id: 'f1', name: 'kantselyariya_chek_0811.jpg', url: 'https://images.unsplash.com/photo-1554415707-9e49017a1430?w=600&auto=format&fit=crop&q=80', size: 1024 * 340, type: 'image/jpeg' }
    ],
    statusHistory: [
      { id: 'h1', status: 'DRAFT', changedBy: 'u11', changedByName: 'Malika Usmonova', timestamp: '2026-08-11 10:20' },
      { id: 'h2', status: 'DIRECTOR_PENDING', changedBy: 'u11', changedByName: 'Malika Usmonova', timestamp: '2026-08-11 10:25' }
    ],
    createdAt: '2026-08-11 10:20:00'
  },
  {
    id: 'exp-2',
    globalNumber: 'EXP-000102',
    branchNumber: 'CHL-2026-0042',
    date: '2026-08-10',
    branchId: 'b1',
    branchName: 'Chilonzor filiali',
    categoryId: 'c2_1',
    categoryName: 'Benzin va yoqilg\'i',
    createdById: 'u12',
    createdByName: 'Sherzod Toirov',
    amount: '950000.00',
    currency: 'UZS',
    amountUzs: '950000.00',
    paymentMethod: 'CARD',
    status: 'ADMIN_PENDING',
    description: 'Mijozlarga tovar yetkazib berish bo\'yicha xizmat safari yoqilg\'i sarfi.',
    hasReceipt: true,
    isOverLimit: false,
    shares: [
      { employeeId: 'u12', employeeName: 'Sherzod Toirov', amount: '950000.00' }
    ],
    files: [
      { id: 'f2', name: 'lukoil_fuel_receipt.jpg', url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=600&auto=format&fit=crop&q=80', size: 1024 * 450, type: 'image/jpeg' }
    ],
    statusHistory: [
      { id: 'h3', status: 'DIRECTOR_PENDING', changedBy: 'u12', changedByName: 'Sherzod Toirov', timestamp: '2026-08-10 14:10' },
      { id: 'h4', status: 'ADMIN_PENDING', changedBy: 'u2', changedByName: 'Rustam Rahimov (Direktor)', timestamp: '2026-08-10 16:40', reason: 'Filial direktori tomonidan tasdiqlandi' }
    ],
    createdAt: '2026-08-10 14:10:00'
  },
  {
    id: 'exp-3',
    globalNumber: 'EXP-000103',
    branchNumber: 'MIR-2026-0029',
    date: '2026-08-09',
    branchId: 'b3',
    branchName: 'Mirobod filiali',
    categoryId: 'c3_1',
    categoryName: 'Target va onlayn reklama',
    createdById: 'u16',
    createdByName: 'Farrux Shukurov',
    amount: '12500000.00',
    currency: 'UZS',
    amountUzs: '12500000.00',
    paymentMethod: 'TRANSFER',
    status: 'APPROVED',
    description: 'Instagram va Facebook platformalarida avgust oylik savdo kampaniyasi.',
    hasReceipt: true,
    isOverLimit: true,
    shares: [
      { employeeId: 'u16', employeeName: 'Farrux Shukurov', amount: '12500000.00' }
    ],
    files: [
      { id: 'f3', name: 'meta_invoice_aug2026.pdf', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', size: 1024 * 1200, type: 'application/pdf' }
    ],
    statusHistory: [
      { id: 'h5', status: 'DIRECTOR_PENDING', changedBy: 'u16', changedByName: 'Farrux Shukurov', timestamp: '2026-08-09 09:15' },
      { id: 'h6', status: 'ADMIN_PENDING', changedBy: 'u4', changedByName: 'Dilshod Karimov', timestamp: '2026-08-09 11:30' },
      { id: 'h7', status: 'APPROVED', changedBy: 'u1', changedByName: 'Bekzod Abdullayev (Admin)', timestamp: '2026-08-09 15:00', reason: 'Reja bo\'yicha to\'liq ma\'qullandi' }
    ],
    createdAt: '2026-08-09 09:15:00'
  },
  {
    id: 'exp-4',
    globalNumber: 'EXP-000104',
    branchNumber: 'YUN-2026-0018',
    date: '2026-08-08',
    branchId: 'b2',
    branchName: 'Yunusobod filiali',
    categoryId: 'c4_2',
    categoryName: 'Kompyuter ehtiyot qismlari',
    createdById: 'u14',
    createdByName: 'Bobur Mirzayev',
    amount: '3400000.00',
    currency: 'UZS',
    amountUzs: '3400000.00',
    paymentMethod: 'TRANSFER',
    status: 'NEEDS_FIX',
    description: 'Server xonasi uchun qo\'shimcha SSD disklar va operativ xotira (RAM).',
    hasReceipt: false,
    isOverLimit: false,
    shares: [
      { employeeId: 'u14', employeeName: 'Bobur Mirzayev', amount: '340000.00' }
    ],
    files: [],
    statusHistory: [
      { id: 'h8', status: 'DIRECTOR_PENDING', changedBy: 'u14', changedByName: 'Bobur Mirzayev', timestamp: '2026-08-08 11:00' },
      { id: 'h9', status: 'NEEDS_FIX', changedBy: 'u3', changedByName: 'Jasur Saidov', timestamp: '2026-08-08 14:20', reason: 'Do\'kondan olingan hisob-faktura (chek) ilova qilinmagan. Iltimos chekni yuklang.' }
    ],
    createdAt: '2026-08-08 11:00:00'
  },
  {
    id: 'exp-5',
    globalNumber: 'EXP-000105',
    branchNumber: 'CHL-2026-0043',
    date: '2026-08-07',
    branchId: 'b1',
    branchName: 'Chilonzor filiali',
    categoryId: 'c1_2',
    categoryName: 'Kofe-breyk va suv',
    createdById: 'u10',
    createdByName: 'Alisher Qodirov',
    amount: '350000.00',
    currency: 'UZS',
    amountUzs: '350000.00',
    paymentMethod: 'CASH',
    status: 'APPROVED',
    description: 'Mehmonlar va xodimlar uchun toza ichimlik suvi (19L idishlar xaridi).',
    hasReceipt: true,
    isOverLimit: false,
    shares: [
      { employeeId: 'u10', employeeName: 'Alisher Qodirov', amount: '350000.00' }
    ],
    files: [
      { id: 'f5', name: 'suv_chek.jpg', url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80', size: 1024 * 280, type: 'image/jpeg' }
    ],
    statusHistory: [
      { id: 'h10', status: 'DIRECTOR_PENDING', changedBy: 'u10', changedByName: 'Alisher Qodirov', timestamp: '2026-08-07 16:10' },
      { id: 'h11', status: 'APPROVED', changedBy: 'u2', changedByName: 'Rustam Rahimov', timestamp: '2026-08-07 17:05' }
    ],
    createdAt: '2026-08-07 16:10:00'
  },
  {
    id: 'exp-6',
    globalNumber: 'EXP-000106',
    branchNumber: 'SAM-2026-0012',
    date: '2026-08-06',
    branchId: 'b4',
    branchName: 'Samarqand filiali',
    categoryId: 'c5_1',
    categoryName: 'Mehmonxona to\'lovi',
    createdById: 'u5',
    createdByName: 'Olim Hakimov',
    amount: '1800000.00',
    currency: 'UZS',
    amountUzs: '1800000.00',
    paymentMethod: 'CARD',
    status: 'REJECTED',
    description: 'Toshkent bosh ofisiga kelgan xodim uchun mehmonxona bronlash to\'lovi.',
    hasReceipt: true,
    isOverLimit: false,
    shares: [
      { employeeId: 'u5', employeeName: 'Olim Hakimov', amount: '1800000.00' }
    ],
    files: [
      { id: 'f6', name: 'hotel_bill.jpg', url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop&q=80', size: 1024 * 510, type: 'image/jpeg' }
    ],
    statusHistory: [
      { id: 'h12', status: 'DIRECTOR_PENDING', changedBy: 'u5', changedByName: 'Olim Hakimov', timestamp: '2026-08-06 18:00' },
      { id: 'h13', status: 'REJECTED', changedBy: 'u1', changedByName: 'Bekzod Abdullayev (Admin)', timestamp: '2026-08-07 09:30', reason: 'Oldindan xizmat safari buyrug\'i va ruxsati olinmaganligi sababli rad etildi.' }
    ],
    createdAt: '2026-08-06 18:00:00'
  }
];

export const initialRefunds: Refund[] = [
  {
    id: 'ref-1',
    expenseId: 'exp-3',
    expenseGlobalNumber: 'EXP-000103',
    branchId: 'b3',
    branchName: 'Mirobod filiali',
    employeeName: 'Farrux Shukurov',
    amount: '800000.00',
    originalAmount: '12500000.00',
    isPartial: true,
    reason: 'Reklama kampaniyasi byudjetidan ishlatilmay qolgan qoldiq mablag\' kassaga qaytarildi.',
    status: 'APPROVED',
    files: [{ id: 'rf1', name: 'bank_receipt_refund.jpg', url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80', size: 1024 * 310, type: 'image/jpeg' }],
    createdAt: '2026-08-10 11:30',
    approvedAt: '2026-08-10 15:45',
    approvedByName: 'Bekzod Abdullayev'
  },
  {
    id: 'ref-2',
    expenseId: 'exp-5',
    expenseGlobalNumber: 'EXP-000105',
    branchId: 'b1',
    branchName: 'Chilonzor filiali',
    employeeName: 'Alisher Qodirov',
    amount: '120000.00',
    originalAmount: '350000.00',
    isPartial: true,
    reason: 'Do\'kondagi chegirma sababli ortib qolgan summa.',
    status: 'PENDING',
    files: [{ id: 'rf2', name: 'kassaga_qaytarish.jpg', url: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?w=600&auto=format&fit=crop&q=80', size: 1024 * 220, type: 'image/jpeg' }],
    createdAt: '2026-08-11 16:00'
  }
];

export const initialEditRequests: EditRequest[] = [
  {
    id: 'ed-1',
    expenseId: 'exp-1',
    expenseGlobalNumber: 'EXP-000101',
    branchName: 'Chilonzor filiali',
    requestedByName: 'Malika Usmonova',
    reason: 'Kantselyariya qog\'ozlari bilan birga fayllar ham olingandi, summani 520,000 so\'mga to\'g\'irlash kerak.',
    originalData: { amount: '480000.00', description: 'Filial xodimlari uchun oylik A4 qog\'oz, ruchkalar va papkalar xaridi.' },
    requestedData: { amount: '520000.00', description: 'Filial xodimlari uchun oylik A4 qog\'oz, ruchkalar, papkalar va 100 dona fayl xaridi.' },
    status: 'PENDING',
    createdAt: '2026-08-11 14:00'
  }
];

export const initialBudgets: Budget[] = [
  { id: 'bg1', scopeType: 'BRANCH', scopeId: 'b1', scopeName: 'Chilonzor filiali', period: '2026-08', amountLimit: 30000000, actualAmount: 24500000 },
  { id: 'bg2', scopeType: 'BRANCH', scopeId: 'b2', scopeName: 'Yunusobod filiali', period: '2026-08', amountLimit: 25000000, actualAmount: 18200000 },
  { id: 'bg3', scopeType: 'BRANCH', scopeId: 'b3', scopeName: 'Mirobod filiali', period: '2026-08', amountLimit: 28000000, actualAmount: 28900000 },
  { id: 'bg4', scopeType: 'CATEGORY', scopeId: 'c1', scopeName: 'Ofis va ma\'muriy xarajatlar', period: '2026-08', amountLimit: 15000000, actualAmount: 9800000 },
  { id: 'bg5', scopeType: 'CATEGORY', scopeId: 'c2', scopeName: 'Transport va yoqilg\'i', period: '2026-08', amountLimit: 20000000, actualAmount: 16400000 },
  { id: 'bg6', scopeType: 'CATEGORY', scopeId: 'c3', scopeName: 'Marketing va reklama', period: '2026-08', amountLimit: 40000000, actualAmount: 38500000 },
  { id: 'bg7', scopeType: 'EMPLOYEE', scopeId: 'u12', scopeName: 'Sherzod Toirov', period: '2026-08', amountLimit: 3000000, actualAmount: 2100000 }
];

export const initialCurrencyRates: CurrencyRate[] = [
  { id: 'cr1', date: '2026-08-12', currency: 'USD', rate: 12850.00, source: 'CBU' },
  { id: 'cr2', date: '2026-08-12', currency: 'EUR', rate: 13950.00, source: 'CBU' },
  { id: 'cr3', date: '2026-08-12', currency: 'RUB', rate: 142.50, source: 'CBU' },
  { id: 'cr4', date: '2026-08-11', currency: 'USD', rate: 12840.00, source: 'CBU' },
  { id: 'cr5', date: '2026-08-10', currency: 'USD', rate: 12835.00, source: 'MANUAL' },
];

export const initialAuditLogs: AuditLog[] = [
  {
    id: 'aud-1',
    timestamp: '2026-08-12 09:45:12',
    userId: 'u1',
    userName: 'Bekzod Abdullayev (Admin)',
    entityType: 'EXPENSE',
    entityId: 'exp-3',
    action: 'APPROVE',
    channel: 'WEB',
    oldValue: { status: 'ADMIN_PENDING' },
    newValue: { status: 'APPROVED', approvedBy: 'u1' },
    ipAddress: '192.168.1.45'
  },
  {
    id: 'aud-2',
    timestamp: '2026-08-11 16:10:05',
    userId: 'u10',
    userName: 'Alisher Qodirov',
    entityType: 'EXPENSE',
    entityId: 'exp-5',
    action: 'CREATE',
    channel: 'TELEGRAM',
    newValue: { globalNumber: 'EXP-000105', amount: '350000.00', category: 'Kofe-breyk va suv' },
    ipAddress: '94.158.52.12'
  },
  {
    id: 'aud-3',
    timestamp: '2026-08-11 10:25:00',
    userId: 'u11',
    userName: 'Malika Usmonova',
    entityType: 'EXPENSE',
    entityId: 'exp-1',
    action: 'UPDATE',
    channel: 'WEB',
    oldValue: { status: 'DRAFT' },
    newValue: { status: 'DIRECTOR_PENDING' },
    ipAddress: '192.168.1.88'
  },
  {
    id: 'aud-4',
    timestamp: '2026-08-10 16:40:22',
    userId: 'u2',
    userName: 'Rustam Rahimov (Direktor)',
    entityType: 'EXPENSE',
    entityId: 'exp-2',
    action: 'APPROVE',
    channel: 'WEB',
    oldValue: { status: 'DIRECTOR_PENDING' },
    newValue: { status: 'ADMIN_PENDING', reason: 'Filial direktori tomonidan tasdiqlandi' },
    ipAddress: '192.168.1.12'
  },
  {
    id: 'aud-5',
    timestamp: '2026-08-10 11:30:15',
    userId: 'u16',
    userName: 'Farrux Shukurov',
    entityType: 'REFUND',
    entityId: 'ref-1',
    action: 'CREATE',
    channel: 'WEB',
    newValue: { expenseId: 'exp-3', amount: '800000.00', reason: 'Ortib qolgan qoldiq' },
    ipAddress: '192.168.2.14'
  }
];

export const initialExportJobs: ExportJob[] = [
  {
    id: 'job-1',
    type: 'E1',
    typeName: 'Xarajatlar reestri (E1)',
    format: 'xlsx',
    filters: { branch: 'Chilonzor filiali', period: '2026-08' },
    status: 'DONE',
    rowCount: 142,
    downloadUrl: '#download-e1',
    createdAt: '2026-08-12 08:30:00',
    expiresAt: '2026-08-13 08:30:00'
  },
  {
    id: 'job-2',
    type: 'E2',
    typeName: 'Filiallar kesimida tahlil (E2)',
    format: 'pdf',
    filters: { year: 2026 },
    status: 'DONE',
    rowCount: 10,
    downloadUrl: '#download-e2',
    createdAt: '2026-08-11 17:15:00',
    expiresAt: '2026-08-12 17:15:00'
  },
  {
    id: 'job-3',
    type: 'E9',
    typeName: 'Audit jurnali (E9)',
    format: 'xlsx',
    filters: { from: '2026-08-01', to: '2026-08-12' },
    status: 'RUNNING',
    rowCount: 380,
    createdAt: '2026-08-12 09:40:00',
    expiresAt: '2026-08-13 09:40:00'
  }
];

export const initialNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Yangi tasdiqlash so\'rovi',
    message: 'Sherzod Toirov "Benzin va yoqilg\'i" bo\'yicha 950,000 so\'mlik xarajat kiritdi.',
    type: 'INFO',
    isRead: false,
    link: '/approvals',
    createdAt: '10 daqiqa oldin'
  },
  {
    id: 'notif-2',
    title: 'Tahrirlash murojaati keldi',
    message: 'Malika Usmonova EXP-000101 xarajati bo\'yicha o\'zgartirish so\'ramoqda.',
    type: 'WARNING',
    isRead: false,
    link: '/edit-requests',
    createdAt: '35 daqiqa oldin'
  },
  {
    id: 'notif-3',
    title: 'Byudjet ogohlantirishi (92%)',
    message: 'Mirobod filiali oylik limitining 92% miqdorini ishlatdi.',
    type: 'WARNING',
    isRead: false,
    link: '/budgets',
    createdAt: '2 soat oldin'
  },
  {
    id: 'notif-4',
    title: 'Qaytarish so\'rovi tasdiqlandi',
    message: 'EXP-000103 bo\'yicha 800,000 so\'mlik qaytarish tasdiqlandi.',
    type: 'SUCCESS',
    isRead: true,
    link: '/refunds',
    createdAt: 'Kecha'
  }
];
