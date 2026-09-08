import { ChecklistItemDef, FormMetadata } from '../types';

export const FORM_METADATA: FormMetadata = {
  title: 'แบบตรวจสอบเครื่องมืออุปกรณ์ก่อนการใช้งาน',
  subheader: 'เรียน  หมผ – ธ.    แผนก  หมผ - ธ.    กอง  กคว - ธ.    ฝ่าย  อคม.  รวธ.',
  docNumber: 'FM-004/QP-PB-013',
  revision: 'แก้ไขครั้งที่ 02',
  subdivision: 'รองผู้ว่าการธุรกิจเกี่ยวเนื่อง',
  copyNote: 'ต้นฉบับ : เก็บที่หน่วยงาน',
};

// Checklist items for Full Body Harness (Page 1 of Master PDF)
export const HARNESS_CHECKLIST_ITEMS: ChecklistItemDef[] = [
  {
    id: 1,
    text: 'D-ring และหัวเข็มขัดต้องอยู่ในสภาพดี ไม่บิดเบี้ยว ไม่มีรอยแตกร้าว สนิม และขอบคมหัวเข็มขัด ต้องปรับเลื่อนได้โดยไม่ติดขัด',
  },
  {
    id: 2,
    text: 'สายรัด ต้องอยู่ในสภาพ ดี ไม่มีรอยตัด ฉีกขาด รอยไหม้ เส้นด้ายหลุดลุ่ย หรือสีซีดจาง',
  },
  {
    id: 3,
    text: 'รอยเย็บต้องแน่นและไม่มีรอยตัด',
  },
  {
    id: 4,
    text: 'ป้ายเครื่องหมายต้องอยู่ในสภาพดี ไม่ขาด ตัวหนังสือชัดเจน',
  },
];

// Checklist items for Lanyard (Page 2 of Master PDF)
export const LANYARD_CHECKLIST_ITEMS: ChecklistItemDef[] = [
  {
    id: 1,
    text: 'ตะขอเกี่ยว, Carabiner และ D-ring ต้องอยู่ใน สภาพดี ไม่บิดเบี้ยว ไม่มีรอยแตกร้าว สนิม และขอบคด',
  },
  {
    id: 2,
    text: 'สายรัด Lanyard ต้องอยู่ในสภาพดี ไม่มีรอยตัด ฉีกขาด รอยไหม้ เส้นด้ายหลุดลุ่ย หรือสีซีดจาง',
  },
  {
    id: 3,
    text: 'รอยเย็บ Lanyard ต้องแน่น และไม่มีรอยตัด',
  },
  {
    id: 4,
    text: 'เชือก Lanyard ต้องอยู่ในสภาพดี แน่นเป็นเส้นเดียวกัน ไม่มีรอยตัด รอยไหม้ ไม่พันกันเป็นปม หรือสีซีดจาง',
  },
  {
    id: 5,
    text: 'อุปกรณ์ดูดซับแรงกระชาก ต้องอยู่ในสภาพดี ไม่ยืดออก และฉีดขาด',
  },
  {
    id: 6,
    text: 'ป้ายเครื่องหมาย ต้องอยู่ในสภาพดี ไม่ขาด ตัวหนังสือชัดเจน',
  },
];

export const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

export const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

/**
 * Standardize month string or number to full Thai month name
 */
export function normalizeMonth(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    const idx = Math.floor(val) - 1;
    if (idx >= 0 && idx < 12) return THAI_MONTHS[idx];
  }
  const str = String(val).trim();
  // Check exact Thai month
  const foundExact = THAI_MONTHS.find((m) => str.includes(m));
  if (foundExact) return foundExact;

  // Check short Thai month
  const shortIdx = THAI_MONTHS_SHORT.findIndex((m) => str.includes(m));
  if (shortIdx !== -1) return THAI_MONTHS[shortIdx];

  // Check numeric string e.g. "3", "03"
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return THAI_MONTHS[num - 1];
  }

  // English months
  const engMonths = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ];
  const engIdx = engMonths.findIndex((em) => str.toLowerCase().includes(em));
  if (engIdx !== -1) return THAI_MONTHS[engIdx];

  return str;
}

/**
 * Normalize year to Buddhist Era (พ.ศ.) string e.g. "2569"
 */
export function normalizeYearBE(val: any): string {
  if (val === null || val === undefined || val === '') return '2569';
  const str = String(val).replace(/\D/g, '');
  let num = parseInt(str, 10);
  if (isNaN(num)) return '2569';

  // 2-digit years e.g. 69 -> 2569, 26 -> 2569
  if (num >= 50 && num < 100) {
    num += 2500;
  } else if (num > 0 && num < 50) {
    num += 2500 + 43; // 26 -> 2569
  } else if (num > 1900 && num < 2200) {
    num += 543; // Gregorian e.g. 2026 -> 2569
  }
  return String(num);
}
