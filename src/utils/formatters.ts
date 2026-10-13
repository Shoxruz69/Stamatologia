// Valyutani o'zbek so'mida chiroyli formatlash
export const formatCurrency = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '0 so‘m';
  }
  // Butun son sifatida yaxlitlash (floating-point xatolarini oldini olish)
  const integerAmount = Math.round(amount);
  const formatted = integerAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} so‘m`;
};

// Oddiy raqam formatlash (masalan, 1 250)
export const formatNumber = (num: number): string => {
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export const UZ_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
];

export const UZ_DAYS = [
  'Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'
];

// YYYY-MM-DD qismlarini xavfsiz ajratish (vaqt mintaqasi va soat siljishisiz)
export const parseDateParts = (dateInput?: any): { year: number; month: number; day: number } | null => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    return {
      year: dateInput.getFullYear(),
      month: dateInput.getMonth() + 1,
      day: dateInput.getDate(),
    };
  }
  const clean = String(dateInput).trim().split('T')[0].split(' ')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }
  return null;
};

// YYYY-MM-DD dan xavfsiz mahalliy Date obyekti (12:00 da olinadi, timezone sakrashlarini oldini oladi)
export const parseLocalDate = (dateStr?: any): Date => {
  const parts = parseDateParts(dateStr);
  if (parts) {
    return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
  }
  return new Date();
};

// Date obyektidan YYYY-MM-DD string olish
export const toDateString = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Sanani o'zbekcha formatda ko'rsatish: "12-oktabr, 2026"
export const formatDate = (dateInput?: any): string => {
  if (!dateInput) return '-';
  const parts = parseDateParts(dateInput);
  if (parts) {
    return `${parts.day}-${UZ_MONTHS[parts.month - 1]}, ${parts.year}`;
  }
  const d = new Date(dateInput);
  if (!isNaN(d.getTime())) {
    return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
  }
  return String(dateInput);
};

// Sana va haftaning kuni: "12-oktabr, 2026 (Dushanba)"
export const formatDateWithWeekday = (dateString?: string): string => {
  if (!dateString) return '-';
  const parts = parseDateParts(dateString);
  if (parts) {
    const d = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
    const weekday = UZ_DAYS[d.getDay()];
    return `${parts.day}-${UZ_MONTHS[parts.month - 1]}, ${parts.year} (${weekday})`;
  }
  return String(dateString);
};

// Haftaning kun nomini olish: "Dushanba"
export const getDayWeekdayName = (dateString?: string): string => {
  if (!dateString) return '';
  const parts = parseDateParts(dateString);
  if (parts) {
    const d = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
    return UZ_DAYS[d.getDay()];
  }
  return '';
};

// Bugungi sana (YYYY-MM-DD)
export const getTodayDateString = (): string => {
  const d = new Date();
  return toDateString(d);
};

// Sana satridan faqat YYYY-MM-DD qismini xavfsiz ajratib olish
export const extractDateOnly = (val: any): string => {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim().split('T')[0].split(' ')[0];
  // Standart YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD.MM.YYYY yoki DD/MM/YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }
  return s;
};

// Sana oralig'i tekshiruvi: date target oralig'idami?
export const isDateInRange = (dateInput: any, startInput?: any, endInput?: any): boolean => {
  if (!dateInput) return false;
  const target = extractDateOnly(dateInput);
  if (!target) return false;

  const rawStart = extractDateOnly(startInput);
  const rawEnd = extractDateOnly(endInput);

  if (!rawStart && !rawEnd) return true;

  // Agar ikkala sana ham kiritilgan bo'lsa, start va end ni to'g'ri tartiblaymiz
  let start = rawStart;
  let end = rawEnd;
  if (rawStart && rawEnd && rawStart > rawEnd) {
    start = rawEnd;
    end = rawStart;
  }

  if (start && target < start) return false;
  if (end && target > end) return false;
  return true;
};

// Preset davrlar bo'yicha aniq boshlanish va tugash sanalari
export const getPresetDates = (
  preset: 'today' | 'week' | 'month' | 'custom',
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string } => {
  const todayStr = getTodayDateString();
  if (preset === 'today') {
    return { startDate: todayStr, endDate: todayStr };
  }
  if (preset === 'week') {
    // Bugungi kun bilan birga aynan oxirgi 7 kun (bugundan 6 kun oldin to bugun)
    return { startDate: addDays(todayStr, -6), endDate: todayStr };
  }
  if (preset === 'month') {
    // Bugungi kun bilan birga aynan oxirgi 30 kun (bugundan 29 kun oldin to bugun)
    return { startDate: addDays(todayStr, -29), endDate: todayStr };
  }
  return {
    startDate: customStart ? extractDateOnly(customStart) : addDays(todayStr, -29),
    endDate: customEnd ? extractDateOnly(customEnd) : todayStr,
  };
};

// Sana qo'shish yoki ayirish (aniq vaqt mintaqasi siljishisiz)
export const addDays = (dateStr: string, days: number): string => {
  const clean = extractDateOnly(dateStr);
  const parts = parseDateParts(clean);
  if (parts) {
    const d = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
    d.setDate(d.getDate() + days);
    return toDateString(d);
  }
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateString(d);
};

// addDays uchun sinonim
export const shiftDateString = addDays;

export interface ChartPoint {
  label: string;
  revenue: number;
  payments: number;
}

// Tanlangan muddat bo'yicha grafik nuqtalarini aniq va jami summaga 100% teng bo'lgan taqsimotda hisoblash
export const generateDateRangeChartPoints = (
  startDate: string,
  endDate: string,
  filteredPayments: any[]
): ChartPoint[] => {
  const cleanStart = extractDateOnly(startDate);
  const cleanEnd = extractDateOnly(endDate);

  if (!cleanStart || !cleanEnd) return [];

  let start = cleanStart;
  let end = cleanEnd;
  if (cleanStart > cleanEnd) {
    start = cleanEnd;
    end = cleanStart;
  }

  const p1 = parseDateParts(start);
  const p2 = parseDateParts(end);
  if (!p1 || !p2) return [];

  const d1 = new Date(p1.year, p1.month - 1, p1.day, 12, 0, 0);
  const d2 = new Date(p2.year, p2.month - 1, p2.day, 12, 0, 0);
  const diffDays = Math.max(0, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));

  const MONTH_SHORT = [
    'yan', 'fev', 'mar', 'apr', 'may', 'iyun',
    'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'
  ];

  // 1 kun tanlanganda (masalan Bugun)
  if (diffDays === 0) {
    const dayPays = (filteredPayments || []).filter((p) => {
      const pDate = extractDateOnly(p.date);
      return pDate === start && p.status !== 'Qaytarilgan';
    });
    const label = `${p1.day}-${MONTH_SHORT[p1.month - 1]}`;

    return [
      {
        label,
        revenue: dayPays.reduce((acc, p) => acc + (p.totalAmount || 0), 0),
        payments: dayPays.reduce((acc, p) => acc + (p.paidAmount || 0), 0),
      },
    ];
  }

  // 1 dan 14 kungacha bo'lgan muddatlarda har bir kun alohida
  if (diffDays <= 14) {
    const points: ChartPoint[] = [];
    for (let i = 0; i <= diffDays; i++) {
      const dStr = addDays(start, i);
      const dayPays = (filteredPayments || []).filter((p) => {
        const pDate = extractDateOnly(p.date);
        return pDate === dStr && p.status !== 'Qaytarilgan';
      });
      const parts = parseDateParts(dStr);
      const label = parts ? `${parts.day}-${MONTH_SHORT[parts.month - 1]}` : dStr;

      points.push({
        label,
        revenue: dayPays.reduce((acc, p) => acc + (p.totalAmount || 0), 0),
        payments: dayPays.reduce((acc, p) => acc + (p.paidAmount || 0), 0),
      });
    }
    return points;
  }

  // 14 kundan ko'p bo'lsa (masalan 30 kun), 7 ta uzluksiz, bir-birini qoplamaydigan oraliq
  // Har bir to'lov aniq bitta oraliqqa tushadi, shuning uchun grafik jami summasi ekrandagi jami summaga 100% teng bo'ladi
  const numBins = 7;
  const points: ChartPoint[] = [];

  for (let b = 0; b < numBins; b++) {
    const startOffset = Math.round((b * (diffDays + 1)) / numBins);
    const endOffset = Math.round(((b + 1) * (diffDays + 1)) / numBins) - 1;
    const segStartStr = addDays(start, startOffset);
    const segEndStr = addDays(start, Math.min(diffDays, Math.max(startOffset, endOffset)));

    const binPays = (filteredPayments || []).filter((p) => {
      const pDate = extractDateOnly(p.date);
      return pDate >= segStartStr && pDate <= segEndStr && p.status !== 'Qaytarilgan';
    });

    const sp = parseDateParts(segStartStr);
    const ep = parseDateParts(segEndStr);
    let label = '';
    if (sp && ep) {
      if (sp.day === ep.day && sp.month === ep.month) {
        label = `${sp.day}-${MONTH_SHORT[sp.month - 1]}`;
      } else if (sp.month === ep.month) {
        label = `${sp.day}-${ep.day} ${MONTH_SHORT[ep.month - 1]}`;
      } else {
        label = `${sp.day} ${MONTH_SHORT[sp.month - 1]} - ${ep.day} ${MONTH_SHORT[ep.month - 1]}`;
      }
    } else {
      label = segStartStr;
    }

    points.push({
      label,
      revenue: binPays.reduce((acc, p) => acc + (p.totalAmount || 0), 0),
      payments: binPays.reduce((acc, p) => acc + (p.paidAmount || 0), 0),
    });
  }

  return points;
};

/**
 * O‘zbekiston telefon raqamini avtomatik formatlash:
 * Format: +998 90 123 45 67
 *
 * - Raqam yozilganda bo‘shliqlar o‘z-o‘zidan qo‘shiladi
 * - +998 kodi takrorlanmaydi
 * - Qo‘lda yozish ham, nusxalab joylash ham to‘g‘ri ishlaydi
 * - Faqat O‘zbekiston raqami uchun kerakli 9 ta milliy raqam qabul qilinadi
 */
export const formatUzbekPhoneNumber = (input?: string | null): string => {
  if (!input) return '';
  const trimmed = input.trim();

  // Agar foydalanuvchi faqat '+' yozsa, boshlash uchun '+998 ' ko'rinadi
  if (trimmed === '+') {
    return '+998 ';
  }

  // Agar o'chirish paytida faqat prefiks qolgan bo'lsa, maydonni tozalash imkonini beramiz
  if (trimmed === '+9' || trimmed === '+99' || trimmed === '+998' || trimmed === '+998 ') {
    return '';
  }

  // Barcha no-raqam belgilarini olib tashlaymiz
  let cleaned = input.replace(/\D/g, '');
  if (!cleaned) return '';

  // 1. Agar input +998 yoki + bilan boshlangan bo'lsa,
  // va cleaned 998 bilan boshlansa, birinchi 998 bu mamlakat kodi
  if (trimmed.startsWith('+998') || trimmed.startsWith('+ 998') || trimmed.startsWith('+')) {
    if (cleaned.startsWith('998')) {
      cleaned = cleaned.slice(3);
    }
  } else if (cleaned.length === 10 && cleaned.startsWith('8')) {
    // 8 90 123 45 67 formati (sobiq MDH prefiksi)
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith('998')) {
    // Agar + bo'lmasa, lekin 998 bilan boshlansa:
    // Faqat agar uzunligi > 9 bo'lsa (masalan 998901234567 - 12 ta raqam) yoki aniq 3 ta raqam bo'lsa ('998')
    if (cleaned.length > 9 || cleaned.length === 3) {
      cleaned = cleaned.slice(3);
    }
  }

  // Takroriy 998'larni tozalash (masalan +998 bor joyga yana +998... nusxalab qo'yilsa)
  while (cleaned.length > 9 && cleaned.startsWith('998')) {
    cleaned = cleaned.slice(3);
  }

  // O'zbekiston raqami uchun 9 ta milliy raqam (operator 2 ta + 7 ta raqam)
  const digits = cleaned.slice(0, 9);
  if (!digits.length) return '';

  let res = '+998 ';
  if (digits.length <= 2) {
    res += digits;
  } else if (digits.length <= 5) {
    res += digits.slice(0, 2) + ' ' + digits.slice(2);
  } else if (digits.length <= 7) {
    res += digits.slice(0, 2) + ' ' + digits.slice(2, 5) + ' ' + digits.slice(5);
  } else {
    res += digits.slice(0, 2) + ' ' + digits.slice(2, 5) + ' ' + digits.slice(5, 7) + ' ' + digits.slice(7);
  }
  return res;
};
