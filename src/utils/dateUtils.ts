import * as XLSX from 'xlsx';
import { THAI_MONTHS, THAI_MONTHS_SHORT } from '../constants/masterTemplates';

export interface ParsedDateInfo {
  isValid: boolean;
  errorReason?: string;
  dateKey: string; // e.g. "2025-10-19" (YYYY-MM-DD in CE)
  day: number; // 1..31
  month: number; // 1..12
  monthNameThai: string; // e.g. "ตุลาคม"
  yearCE: number; // e.g. 2025
  yearBE: number; // e.g. 2568
  yearBEStr: string; // e.g. "2568"
  displayDateThai: string; // e.g. "19 ตุลาคม 2568"
  originalValue?: any;
  detectedFormat?: string;
}

export interface ParseDateOptions {
  date1904?: boolean; // Whether the Excel workbook uses 1904 date system (Mac Excel default)
}

/**
 * Check if a Christian Era (CE) year is a leap year
 */
export function isLeapYearCE(yearCE: number): boolean {
  return (yearCE % 4 === 0 && yearCE % 100 !== 0) || yearCE % 400 === 0;
}

/**
 * Get maximum number of days in a given month of a given CE year
 */
export function getDaysInMonthCE(yearCE: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  const daysMap = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2) {
    return isLeapYearCE(yearCE) ? 29 : 28;
  }
  return daysMap[month];
}

/**
 * Create a canonical, timezone-free Date Key e.g. "2025-10-19"
 */
export function createDateKey(yearCE: number, month: number, day: number): string {
  const y = String(yearCE).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Validates whether a calendar date is logically and astronomically valid
 */
export function validateCalendarDate(
  yearCE: number,
  month: number,
  day: number
): { isValid: boolean; errorReason?: string } {
  if (isNaN(yearCE) || yearCE < 1900 || yearCE > 2200) {
    return {
      isValid: false,
      errorReason: `ปี ค.ศ. ${yearCE} ไม่อยู่ในช่วงที่รองรับ (1900-2200)`,
    };
  }

  if (isNaN(month) || month < 1 || month > 12) {
    return {
      isValid: false,
      errorReason: `เดือนที่ ${month} ไม่ถูกต้อง (ต้องเป็น 1-12)`,
    };
  }

  const maxDays = getDaysInMonthCE(yearCE, month);
  if (isNaN(day) || day < 1 || day > maxDays) {
    const monthName = THAI_MONTHS[month - 1] || `เดือน ${month}`;
    const yearBE = yearCE + 543;
    if (month === 2 && day === 29 && !isLeapYearCE(yearCE)) {
      return {
        isValid: false,
        errorReason: `ปี พ.ศ. ${yearBE} (ค.ศ. ${yearCE}) เดือน${monthName} มี 28 วัน (ไม่ใช่อธิกสุรทิน)`,
      };
    }
    return {
      isValid: false,
      errorReason: `วันที่ ${day} เกินจำนวนวันสูงสุดในเดือน${monthName} ปี พ.ศ. ${yearBE} (มี ${maxDays} วัน)`,
    };
  }

  return { isValid: true };
}

/**
 * Convert Thai digits (๐-๙) to Arabic digits (0-9)
 */
export function convertThaiDigitsToArabic(str: string): string {
  const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  return str.replace(/[๐-๙]/g, (ch) => String(thaiDigits.indexOf(ch)));
}

/**
 * Central Date Parser: parseInspectionDate
 * 
 * STRICT ROOT-CAUSE FIX FOR EXCEL SERIAL DATES:
 * - When given a number (Excel Serial Date code, e.g. 45949 = 2025-10-19):
 *   Uses XLSX.SSF.parse_date_code(val, { date1904 }) directly without passing through
 *   JavaScript Date objects or any timezone/UTC methods.
 * - Extracts parsed.y, parsed.m, parsed.d as pure calendar integers.
 * - No toISOString(), no getDate(), no getUTCDate(), no timezone drift!
 */
export function parseInspectionDate(val: any, options?: ParseDateOptions): ParsedDateInfo {
  const is1904 = options?.date1904 ?? false;

  const invalidResult = (reason: string, origVal?: any): ParsedDateInfo => ({
    isValid: false,
    errorReason: reason,
    dateKey: '',
    day: 0,
    month: 0,
    monthNameThai: '',
    yearCE: 0,
    yearBE: 0,
    yearBEStr: '',
    displayDateThai: '',
    originalValue: origVal !== undefined ? origVal : val,
    detectedFormat: 'invalid',
  });

  if (val === null || val === undefined || val === '') {
    return invalidResult('ค่าว่าง (ไม่มีข้อมูลวันที่)');
  }

  let rawYear: number | null = null;
  let rawMonth: number | null = null;
  let rawDay: number | null = null;
  let detectedFormat = 'unknown';

  // 1. Priority #1: Number (Excel Serial Date code e.g. 45949 -> 2025-10-19)
  if (typeof val === 'number') {
    if (val >= 1) {
      try {
        const parsed = XLSX.SSF.parse_date_code(val, { date1904: is1904 });
        if (parsed && typeof parsed.y === 'number' && typeof parsed.m === 'number' && typeof parsed.d === 'number') {
          rawYear = parsed.y;
          rawMonth = parsed.m;
          rawDay = parsed.d;
          detectedFormat = `Excel_Serial_${val}`;
        }
      } catch (e) {
        return invalidResult(`ไม่สามารถแปลง Excel Serial Date: ${val}`, val);
      }
    } else {
      return invalidResult(`ตัวเลข ${val} ไม่ใช่รหัสวันที่ของ Excel (Serial Date ต้อง >= 1)`, val);
    }
  }
  // 2. JavaScript Date object (Defensive fallback if supplied from external code)
  else if (val instanceof Date) {
    if (isNaN(val.getTime())) {
      return invalidResult('Invalid Date object', val);
    }
    // Extract UTC date components safely
    rawDay = val.getUTCDate();
    rawMonth = val.getUTCMonth() + 1;
    rawYear = val.getUTCFullYear();
    detectedFormat = 'JS_Date_UTC';
  }
  // 3. String representation
  else {
    let str = String(val).replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim();
    if (!str) {
      return invalidResult('ข้อความว่างเปล่า', val);
    }

    // Convert Thai digits (๐-๙) to Arabic digits
    str = convertThaiDigitsToArabic(str);

    // Skip known header strings
    if (/^(date|inspectiondate|วันที่|ลำดับ|no|รายการ|item|inspection|ผู้ตรวจ|ผู้ตรวจสอบ|inspected|powerplant|โรงไฟฟ้า)$/i.test(str)) {
      return invalidResult(`คำว่า "${str}" เป็นชื่อหัวตาราง ไม่ใช่วันที่`, val);
    }

    // Strip leading "วันที่" or "Date:" e.g. "วันที่ 19/10/2568"
    str = str.replace(/^(?:วันที่|date)\s*:?\s*/i, '').trim();

    // Check if the string itself is a numeric Excel Serial code e.g. "45949" or "45950.0"
    const numVal = parseFloat(str);
    if (!isNaN(numVal) && numVal >= 1 && (String(numVal) === str || String(Math.floor(numVal)) === str)) {
      try {
        const parsed = XLSX.SSF.parse_date_code(numVal, { date1904: is1904 });
        if (parsed && typeof parsed.y === 'number' && typeof parsed.m === 'number' && typeof parsed.d === 'number') {
          rawYear = parsed.y;
          rawMonth = parsed.m;
          rawDay = parsed.d;
          detectedFormat = `Excel_Serial_String_${numVal}`;
        }
      } catch (e) {}
    }

    // If not numeric serial, strip time part if present (e.g. "2025-10-19 00:00:00" or "19/10/2568 00:00")
    if (rawDay === null) {
      if (str.includes('T')) {
        str = str.split('T')[0].trim();
      } else if (/\s+\d{1,2}:\d{1,2}/.test(str)) {
        str = str.replace(/\s+\d{1,2}:\d{1,2}(?::\d{1,2})?.*$/, '').trim();
      }

      // Pattern 3a: ISO / Year-first e.g. "2025-10-19", "2568-10-19", "2025/10/19", "2026.03.04"
      const isoMatch = str.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$/);
      if (isoMatch) {
        rawYear = parseInt(isoMatch[1], 10);
        rawMonth = parseInt(isoMatch[2], 10);
        rawDay = parseInt(isoMatch[3], 10);
        detectedFormat = 'YYYY-MM-DD';
      }

      // Pattern 3b: Standard Day-first e.g. "19/10/2025", "19/10/2568", "04/03/2569", "4/3/2569", "19-10-2025"
      if (rawDay === null) {
        const dateMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
        if (dateMatch) {
          const p1 = parseInt(dateMatch[1], 10);
          const p2 = parseInt(dateMatch[2], 10);
          const p3 = parseInt(dateMatch[3], 10);

          rawDay = p1;
          rawMonth = p2;
          rawYear = p3;
          detectedFormat = 'DD/MM/YYYY';
        }
      }

      // Pattern 3c: Thai month name e.g. "19 ตุลาคม 2568", "04 มีนาคม 2569", "4 มี.ค. 69", "19 ต.ค. 2568"
      if (rawDay === null) {
        const thaiMatch = str.match(/^(\d{1,2})[\s\-\/\.]+([^\s\d\/\-\.]+)(?:[\s\-\/\.]+(\d{2,4}))?$/);
        if (thaiMatch) {
          const d = parseInt(thaiMatch[1], 10);
          const mStr = thaiMatch[2];
          const yStr = thaiMatch[3] || '2568';

          let mIdx = THAI_MONTHS.findIndex((tm) => tm === mStr || mStr.includes(tm));
          if (mIdx === -1) {
            mIdx = THAI_MONTHS_SHORT.findIndex((tm) => tm === mStr || mStr.includes(tm));
          }

          if (mIdx !== -1) {
            rawDay = d;
            rawMonth = mIdx + 1;
            rawYear = parseInt(yStr, 10);
            detectedFormat = 'Thai_Text_Date';
          }
        }
      }
    }
  }

  if (rawDay === null || rawMonth === null || rawYear === null) {
    return invalidResult(`ไม่สามารถแปลงรูปแบบวันที่ได้: "${val}"`, val);
  }

  // --- Year Normalization (Buddhist Era vs Christian Era) ---
  let yearCE = rawYear;
  let yearBE = rawYear;

  // 2-digit years
  if (rawYear >= 50 && rawYear < 100) {
    // e.g. 68 -> 2568 BE -> 2025 CE, 69 -> 2569 BE -> 2026 CE
    yearBE = 2500 + rawYear;
    yearCE = yearBE - 543;
  } else if (rawYear > 0 && rawYear < 50) {
    // e.g. 25 -> 2025 CE -> 2568 BE, 26 -> 2026 CE -> 2569 BE
    yearCE = 2000 + rawYear;
    yearBE = yearCE + 543;
  } else if (rawYear >= 2400) {
    // Buddhist Era e.g. 2568, 2569
    yearBE = rawYear;
    yearCE = rawYear - 543;
  } else if (rawYear >= 1900 && rawYear < 2400) {
    // Christian Era e.g. 2025, 2026
    yearCE = rawYear;
    yearBE = rawYear + 543;
  }

  // --- Validate the Calendar Date ---
  const validation = validateCalendarDate(yearCE, rawMonth, rawDay);
  if (!validation.isValid) {
    return {
      isValid: false,
      errorReason: validation.errorReason,
      dateKey: '',
      day: rawDay,
      month: rawMonth,
      monthNameThai: THAI_MONTHS[rawMonth - 1] || '',
      yearCE,
      yearBE,
      yearBEStr: String(yearBE),
      displayDateThai: `${rawDay} ${THAI_MONTHS[rawMonth - 1] || ''} ${yearBE}`,
      originalValue: val,
      detectedFormat,
    };
  }

  const monthNameThai = THAI_MONTHS[rawMonth - 1];
  const dateKey = createDateKey(yearCE, rawMonth, rawDay);
  const displayDateThai = `${rawDay} ${monthNameThai} ${yearBE}`;

  return {
    isValid: true,
    dateKey,
    day: rawDay,
    month: rawMonth,
    monthNameThai,
    yearCE,
    yearBE,
    yearBEStr: String(yearBE),
    displayDateThai,
    originalValue: val,
    detectedFormat,
  };
}

/**
 * Backward-compatible alias for parseInspectionDate
 */
export function parseExcelDate(val: any, options?: ParseDateOptions): ParsedDateInfo {
  return parseInspectionDate(val, options);
}

/**
 * Diagnostic & Automated Test Suite verifying all prompt test cases from actual Excel files
 */
export function runDateTests(): {
  allPassed: boolean;
  results: { test: string; passed: boolean; details: string }[];
} {
  const testCases: {
    input: any;
    expectedDay: number;
    expectedMonth: number;
    expectedYearBE: number;
    expectedYearCE: number;
    expectedDateKey: string;
    shouldBeValid: boolean;
    description: string;
  }[] = [
    // Real Excel serial codes from safety checklist(1).xlsx
    { input: 45949, expectedDay: 19, expectedMonth: 10, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-10-19', shouldBeValid: true, description: 'Row 2: Excel Serial 45949 -> 2025-10-19' },
    { input: 45950, expectedDay: 20, expectedMonth: 10, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-10-20', shouldBeValid: true, description: 'Row 11: Excel Serial 45950 -> 2025-10-20' },
    { input: 45951, expectedDay: 21, expectedMonth: 10, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-10-21', shouldBeValid: true, description: 'Excel Serial 45951 -> 2025-10-21' },
    { input: 45952, expectedDay: 22, expectedMonth: 10, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-10-22', shouldBeValid: true, description: 'Excel Serial 45952 -> 2025-10-22' },
    { input: 45957, expectedDay: 27, expectedMonth: 10, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-10-27', shouldBeValid: true, description: 'Excel Serial 45957 -> 2025-10-27' },
    { input: 45958, expectedDay: 28, expectedMonth: 10, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-10-28', shouldBeValid: true, description: 'Excel Serial 45958 -> 2025-10-28' },
    { input: 45959, expectedDay: 29, expectedMonth: 10, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-10-29', shouldBeValid: true, description: 'Excel Serial 45959 -> 2025-10-29' },
    
    // November 2025 serials
    { input: 45974, expectedDay: 13, expectedMonth: 11, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-11-13', shouldBeValid: true, description: 'Excel Serial 45974 -> 2025-11-13' },
    { input: 45975, expectedDay: 14, expectedMonth: 11, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-11-14', shouldBeValid: true, description: 'Excel Serial 45975 -> 2025-11-14' },
    { input: 45988, expectedDay: 27, expectedMonth: 11, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-11-27', shouldBeValid: true, description: 'Excel Serial 45988 -> 2025-11-27' },
    { input: 45989, expectedDay: 28, expectedMonth: 11, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-11-28', shouldBeValid: true, description: 'Excel Serial 45989 -> 2025-11-28' },

    // December 2025 serials
    { input: 45992, expectedDay: 1, expectedMonth: 12, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-12-01', shouldBeValid: true, description: 'Excel Serial 45992 -> 2025-12-01' },
    { input: 45993, expectedDay: 2, expectedMonth: 12, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-12-02', shouldBeValid: true, description: 'Excel Serial 45993 -> 2025-12-02' },

    // January 2026 serials
    { input: 46027, expectedDay: 5, expectedMonth: 1, expectedYearBE: 2569, expectedYearCE: 2026, expectedDateKey: '2026-01-05', shouldBeValid: true, description: 'Excel Serial 46027 -> 2026-01-05' },
    { input: 46028, expectedDay: 6, expectedMonth: 1, expectedYearBE: 2569, expectedYearCE: 2026, expectedDateKey: '2026-01-06', shouldBeValid: true, description: 'Excel Serial 46028 -> 2026-01-06' },
    { input: 46030, expectedDay: 8, expectedMonth: 1, expectedYearBE: 2569, expectedYearCE: 2026, expectedDateKey: '2026-01-08', shouldBeValid: true, description: 'Excel Serial 46030 -> 2026-01-08' },
    { input: 46031, expectedDay: 9, expectedMonth: 1, expectedYearBE: 2569, expectedYearCE: 2026, expectedDateKey: '2026-01-09', shouldBeValid: true, description: 'Excel Serial 46031 -> 2026-01-09' },

    // March 2026 serials
    { input: 46085, expectedDay: 4, expectedMonth: 3, expectedYearBE: 2569, expectedYearCE: 2026, expectedDateKey: '2026-03-04', shouldBeValid: true, description: 'Excel Serial 46085 -> 2026-03-04' },
    { input: 46086, expectedDay: 5, expectedMonth: 3, expectedYearBE: 2569, expectedYearCE: 2026, expectedDateKey: '2026-03-05', shouldBeValid: true, description: 'Excel Serial 46086 -> 2026-03-05' },
    { input: 46087, expectedDay: 6, expectedMonth: 3, expectedYearBE: 2569, expectedYearCE: 2026, expectedDateKey: '2026-03-06', shouldBeValid: true, description: 'Excel Serial 46087 -> 2026-03-06' },
    { input: 46090, expectedDay: 9, expectedMonth: 3, expectedYearBE: 2569, expectedYearCE: 2026, expectedDateKey: '2026-03-09', shouldBeValid: true, description: 'Excel Serial 46090 -> 2026-03-09' },
    { input: 46091, expectedDay: 10, expectedMonth: 3, expectedYearBE: 2569, expectedYearCE: 2026, expectedDateKey: '2026-03-10', shouldBeValid: true, description: 'Excel Serial 46091 -> 2026-03-10' },

    // String format tests
    { input: '19/10/2025', expectedDay: 19, expectedMonth: 10, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-10-19', shouldBeValid: true, description: 'String 19/10/2025' },
    { input: '19/10/2568', expectedDay: 19, expectedMonth: 10, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-10-19', shouldBeValid: true, description: 'String 19/10/2568' },
    { input: '2025-10-19', expectedDay: 19, expectedMonth: 10, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-10-19', shouldBeValid: true, description: 'String 2025-10-19' },
    { input: '19-10-2025', expectedDay: 19, expectedMonth: 10, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-10-19', shouldBeValid: true, description: 'String 19-10-2025' },
    { input: '19 ตุลาคม 2568', expectedDay: 19, expectedMonth: 10, expectedYearBE: 2568, expectedYearCE: 2025, expectedDateKey: '2025-10-19', shouldBeValid: true, description: 'String 19 ตุลาคม 2568' },
    { input: '04/03/2569', expectedDay: 4, expectedMonth: 3, expectedYearBE: 2569, expectedYearCE: 2026, expectedDateKey: '2026-03-04', shouldBeValid: true, description: 'String 04/03/2569' },
    { input: '4/3/2569', expectedDay: 4, expectedMonth: 3, expectedYearBE: 2569, expectedYearCE: 2026, expectedDateKey: '2026-03-04', shouldBeValid: true, description: 'String 4/3/2569' },
    { input: '04/03/2569 00:00:00', expectedDay: 4, expectedMonth: 3, expectedYearBE: 2569, expectedYearCE: 2026, expectedDateKey: '2026-03-04', shouldBeValid: true, description: 'String with timestamp' },
    
    // Invalid dates
    { input: '29/02/2569', expectedDay: 29, expectedMonth: 2, expectedYearBE: 2569, expectedYearCE: 2026, expectedDateKey: '', shouldBeValid: false, description: 'Invalid: 29 Feb 2026 (non-leap)' },
    { input: '31/02/2569', expectedDay: 31, expectedMonth: 2, expectedYearBE: 2569, expectedYearCE: 2026, expectedDateKey: '', shouldBeValid: false, description: 'Invalid: 31 Feb' },
  ];

  const results = testCases.map((tc) => {
    const res = parseInspectionDate(tc.input);
    let passed = false;
    let details = '';

    if (!tc.shouldBeValid) {
      passed = !res.isValid;
      details = passed
        ? `Passed: Correctly detected as invalid (${res.errorReason})`
        : `Failed: Expected invalid, but parsed as valid (${res.dateKey})`;
    } else {
      passed =
        res.isValid &&
        res.day === tc.expectedDay &&
        res.month === tc.expectedMonth &&
        res.yearBE === tc.expectedYearBE &&
        res.yearCE === tc.expectedYearCE &&
        res.dateKey === tc.expectedDateKey;

      details = passed
        ? `Passed: ${tc.description} -> DateKey: ${res.dateKey}, Day: ${res.day}, Month: ${res.monthNameThai}, YearBE: ${res.yearBE}`
        : `Failed: Got Day=${res.day}, Month=${res.month}, YearBE=${res.yearBE}, DateKey=${res.dateKey}; Expected Day=${tc.expectedDay}, Month=${tc.expectedMonth}, YearBE=${tc.expectedYearBE}, DateKey=${tc.expectedDateKey}`;
    }

    return {
      test: tc.description,
      passed,
      details,
    };
  });

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results };
}
