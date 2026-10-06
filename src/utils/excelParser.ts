import * as XLSX from 'xlsx';
import {
  EquipmentItem,
  EquipmentType,
  InspectionRecord,
  InspectionStatusValue,
  ParsedExcelResult,
  ValidationIssue,
} from '../types';
import { normalizeMonth, normalizeYearBE, THAI_MONTHS } from '../constants/masterTemplates';
import {
  SAMPLE_HARNESS_EQUIPMENT,
  SAMPLE_LANYARD_EQUIPMENT,
} from './sampleData';
import {
  parseExcelDate,
  parseInspectionDate,
  ParsedDateInfo,
  ParseDateOptions,
} from './dateUtils';
import {
  deduplicateEquipmentList,
  getEquipmentIdentityKey,
  normalizeEquipmentName,
  normalizeSerialNumber,
  sortEquipmentList,
} from './equipmentUtils';
import { getCanonicalThaiName } from './thaiNameNormalizer';

/**
 * Parse an equipment descriptor string from the Excel column
 * Examples:
 * - "4_Karam รุ่น PN 23 S/N 0035 MFG Date 01/2024"
 * - "R_Petzl รุ่น AVAO BOD Fast S/N C071BA01 MFG Date 05/2023"
 * - "8_สำรอง 1_ Karam รุ่น PN 23 S/N 0051 MFG Date 08/2015"
 * - "10_ Karam รุ่น PN 361N S/N 0008 MFG Date 04/2025"
 * - "R_Petzl รุ่น Absorbica-Y Flex S/N L014BA01 MFG Date 06/2023"
 */
export function parseEquipmentDescriptor(raw: string, type: EquipmentType): EquipmentItem {
  if (!raw || typeof raw !== 'string') {
    return {
      name: type === 'harness' ? 'Harness' : 'Lanyard',
      sn: '-',
      egatNo: '-',
      brandModel: '-',
    };
  }

  const str = raw.trim();

  // Extract S/N
  let sn = '-';
  const snMatch = str.match(/s\/n\s*([a-zA-Z0-9_-]+)/i) || str.match(/sn\s*([a-zA-Z0-9_-]+)/i);
  if (snMatch && snMatch[1]) {
    sn = normalizeSerialNumber(snMatch[1]);
  }

  // Extract EGAT No (ทะเบียน กฟผ.)
  let egatNo = '-';
  const egatMatch = str.match(/ทะเบียน(?:\s*กฟผ\.?)?\s*([0-9-]+)/i) || str.match(/(?:egat|no)\.?\s*([0-9-]{6,})/i);
  if (egatMatch && egatMatch[1]) {
    egatNo = egatMatch[1];
  } else if (str.toLowerCase().includes('petzl') || str.toLowerCase().includes('rescue') || str.startsWith('R_')) {
    egatNo = '1000-111400258714-00';
  }

  // Extract MFG Date
  let mfgDate = '';
  const mfgMatch = str.match(/mfg\s*(?:date)?\s*([0-9\/]+)/i);
  if (mfgMatch && mfgMatch[1]) {
    mfgDate = mfgMatch[1];
  }

  // Extract equipment number or prefix
  let itemPrefix = '';
  const isRescue = str.startsWith('R_') || str.toLowerCase().includes('rescue') || str.toLowerCase().includes('petzl');

  if (isRescue) {
    itemPrefix = type === 'harness' ? 'Harness for Rescue' : 'Lanyard for Rescue';
  } else {
    // Check leading number like "4_", "10_", "8_สำรอง 1_"
    const numMatch = str.match(/^([0-9]+)(?:_|\s+)(.*)/);
    if (numMatch) {
      const num = numMatch[1];
      const rest = numMatch[2];
      if (rest.includes('สำรอง')) {
        itemPrefix = `${type === 'harness' ? 'Harness' : 'Lanyard'}-${num} (สำรอง)`;
      } else {
        itemPrefix = `${type === 'harness' ? 'Harness' : 'Lanyard'}-${num}`;
      }
    } else {
      itemPrefix = type === 'harness' ? 'Harness' : 'Lanyard';
    }
  }

  // Clean equipment name using normalizer
  const cleanName = normalizeEquipmentName(itemPrefix);

  // Extract Brand & Model
  let brandModel = '';
  if (str.toLowerCase().includes('petzl')) {
    if (type === 'harness') {
      brandModel = 'Petzl รุ่น AVAO BOD Fast';
    } else {
      brandModel = 'Petzl รุ่น Absorbica-Y Flex';
    }
  } else if (str.toLowerCase().includes('karam')) {
    if (type === 'harness') {
      brandModel = 'Karam รุ่น PN 23';
    } else {
      brandModel = 'Karam รุ่น PN 361N';
    }
  } else {
    // Fallback: strip sn and mfg date from raw
    brandModel = str.replace(/s\/n\s*[a-zA-Z0-9_-]+/gi, '').replace(/mfg\s*(?:date)?\s*[0-9\/]+/gi, '').trim();
  }

  if (mfgDate) {
    brandModel += ` (MFG Date ${mfgDate})`;
  }

  return {
    name: cleanName,
    sn,
    egatNo,
    brandModel,
    mfgDate,
    isCheckedInReport: false,
  };
}

/**
 * Parse inspection symbol and status from cell value
 * Accurately interprets all Thai/English values entered in Excel
 */
export function parseInspectionResultValue(val: any): {
  symbol: string;
  status: InspectionStatusValue;
} {
  if (val === null || val === undefined || val === '') {
    return { symbol: '', status: null };
  }
  const str = String(val).trim().toLowerCase();

  // 1. Abnormal and unusable (■) - Highest severity
  if (
    str.includes('ไม่ผ่าน') ||
    str.includes('ห้ามใช้') ||
    str.includes('ห้ามใช้งาน') ||
    str.includes('ส่งซ่อม') ||
    str.includes('ชำรุด') ||
    str.includes('แก้ไข') ||
    str === 'fail' ||
    str === '■' ||
    str === 'f' ||
    str === 'no' ||
    str === '0'
  ) {
    return { symbol: '■', status: 'abnormal_unusable' };
  }

  // 2. Abnormal but usable (X / ✕ / ☒) - Medium severity
  if (
    str.includes('ยังใช้ได้') ||
    str.includes('ยังใช้งานได้') ||
    str.includes('ชำรุดเล็กน้อย') ||
    str.includes('พอใช้') ||
    str === 'x' ||
    str === '✕' ||
    str === '☒' ||
    str === '2'
  ) {
    return { symbol: 'X', status: 'abnormal_usable' };
  }

  // 3. Normal pass (/ or ✓) - Normal
  if (
    str.includes('ผ่าน') ||
    str.includes('ปกติ') ||
    str.includes('สมบูรณ์') ||
    str.includes('ปลอดภัย') ||
    str === '/' ||
    str === '√' ||
    str === '✓' ||
    str === 'v' ||
    str === 'pass' ||
    str === 'ok' ||
    str === 'yes' ||
    str === 'y' ||
    str === '1'
  ) {
    return { symbol: '/', status: 'normal' };
  }

  // Fallback string if non-empty
  return { symbol: String(val).trim(), status: 'normal' };
}

/**
 * Backward compatible parser redirecting to dateUtils parseExcelDate
 */
export function parseDateValue(val: any): { day: number | null; month: string; year: string } {
  const parsed = parseExcelDate(val);
  if (parsed.isValid && parsed.day > 0) {
    return {
      day: parsed.day,
      month: parsed.monthNameThai,
      year: parsed.yearBEStr,
    };
  }
  return { day: null, month: '', year: '' };
}

/**
 * Determines whether a sheet or row belongs to Harness or Lanyard
 */
function normalizeEquipmentType(str: string): EquipmentType | null {
  if (!str) return null;
  str = str.toLowerCase();
  if (
    str.includes('harness') ||
    str.includes('ฮาร์เนส') ||
    str.includes('สายรัดตัว') ||
    str.includes('full body')
  ) {
    return 'harness';
  }
  if (
    str.includes('lanyard') ||
    str.includes('แลนยาร์ด') ||
    str.includes('สายช่วยชีวิต') ||
    str.includes('เชือกนิรภัย') ||
    str.includes('ดูดซับ')
  ) {
    return 'lanyard';
  }
  return null;
}

/**
 * Parse an Excel ArrayBuffer into structured inspection records
 */
export function parseInspectionExcel(
  fileBuffer: ArrayBuffer,
  fileName: string
): ParsedExcelResult {
  const issues: ValidationIssue[] = [];
  const records: InspectionRecord[] = [];
  const harnessEqMap = new Map<string, EquipmentItem>();
  const lanyardEqMap = new Map<string, EquipmentItem>();

  const monthsSet = new Set<string>();
  const yearsSet = new Set<string>();

  let workbook: XLSX.WorkBook;
  try {
    // ROOT CAUSE FIX: Read Excel raw values without cellDates: true so serial dates remain raw numbers (e.g. 45949)
    workbook = XLSX.read(fileBuffer, { type: 'array', raw: true, cellDates: false });
  } catch (err: any) {
    issues.push({
      type: 'error',
      message: `ไม่สามารถเปิดไฟล์ Excel ได้: ${err?.message || 'รูปแบบไฟล์ไม่ถูกต้อง'}`,
    });
    return {
      records: [],
      harnessEquipmentList: [],
      lanyardEquipmentList: [],
      availablePlants: [],
      availableMonths: [],
      availableYears: [],
      availableEquipmentTypes: ['harness', 'lanyard'],
      issues,
      totalRowsParsed: 0,
      fileName,
    };
  }

  // Detect workbook date system (1900 vs 1904)
  const is1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
  const dateOptions: ParseDateOptions = { date1904: is1904 };

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    issues.push({
      type: 'error',
      message: 'ไฟล์ Excel ไม่มีแผ่นงาน (Worksheet)',
    });
    return {
      records: [],
      harnessEquipmentList: [],
      lanyardEquipmentList: [],
      availablePlants: [],
      availableMonths: [],
      availableYears: [],
      availableEquipmentTypes: ['harness', 'lanyard'],
      issues,
      totalRowsParsed: 0,
      fileName,
    };
  }

  let totalRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Use raw: true to preserve numeric serial numbers exactly as stored in Excel
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    });

    if (rows.length === 0) continue;
    totalRows += rows.length;

    // Check sheet type
    const isMatrix = checkIsMatrixSheet(rows);
    const isCombined = checkIsCombinedSheet(rows);

    if (isMatrix) {
      parseMatrixSheet(
        sheetName,
        rows,
        records,
        harnessEqMap,
        lanyardEqMap,
        monthsSet,
        yearsSet,
        issues,
        dateOptions
      );
    } else if (isCombined) {
      parseCombinedSheet(
        sheetName,
        rows,
        records,
        harnessEqMap,
        lanyardEqMap,
        monthsSet,
        yearsSet,
        issues,
        dateOptions
      );
    } else {
      parseSingleSheet(
        sheetName,
        rows,
        records,
        harnessEqMap,
        lanyardEqMap,
        monthsSet,
        yearsSet,
        issues,
        dateOptions
      );
    }
  }

  // Sort records chronologically (by dateKey, or year -> month -> day)
  records.sort((a, b) => {
    if (a.dateKey && b.dateKey) {
      return a.dateKey.localeCompare(b.dateKey);
    }
    const yA = parseInt(String(a.year), 10) || 0;
    const yB = parseInt(String(b.year), 10) || 0;
    if (yA !== yB) return yA - yB;
    const mA = THAI_MONTHS.indexOf(a.month);
    const mB = THAI_MONTHS.indexOf(b.month);
    if (mA !== mB) return mA - mB;
    return Number(a.day) - Number(b.day);
  });

  // Convert collected equipment items into deduplicated and ordered arrays
  const { deduplicated: harnessEquipmentList, duplicateCount: harnessDupCount, mergedDetails: harnessMerged } = deduplicateEquipmentList(Array.from(harnessEqMap.values()), 'harness');
  const { deduplicated: lanyardEquipmentList, duplicateCount: lanyardDupCount, mergedDetails: lanyardMerged } = deduplicateEquipmentList(Array.from(lanyardEqMap.values()), 'lanyard');

  if (harnessDupCount > 0) {
    console.log(`[Harness Deduplication] Found and merged ${harnessDupCount} duplicate items:`, harnessMerged);
  }
  if (lanyardDupCount > 0) {
    console.log(`[Lanyard Deduplication] Found and merged ${lanyardDupCount} duplicate items:`, lanyardMerged);
  }

  // Fallbacks if no equipment items were parsed
  const finalHarnessList = harnessEquipmentList.length > 0 ? harnessEquipmentList : SAMPLE_HARNESS_EQUIPMENT;
  const finalLanyardList = lanyardEquipmentList.length > 0 ? lanyardEquipmentList : SAMPLE_LANYARD_EQUIPMENT;

  // Sort available months chronologically according to Thai calendar (มกราคม -> ธันวาคม)
  const availableMonths = Array.from(monthsSet)
    .filter(Boolean)
    .sort((a, b) => {
      const idxA = THAI_MONTHS.indexOf(a);
      const idxB = THAI_MONTHS.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.localeCompare(b);
    });

  // Sort available years in descending order (e.g. 2569, 2568, 2567)
  const availableYears = Array.from(yearsSet)
    .filter(Boolean)
    .sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
      return b.localeCompare(a);
    });

  // If no months or years found, provide standard current defaults
  if (availableMonths.length === 0) availableMonths.push('มีนาคม');
  if (availableYears.length === 0) availableYears.push('2569');

  return {
    records,
    harnessEquipmentList: finalHarnessList,
    lanyardEquipmentList: finalLanyardList,
    availablePlants: [],
    availableMonths,
    availableYears,
    availableEquipmentTypes: ['harness', 'lanyard'],
    issues,
    totalRowsParsed: totalRows,
    fileName,
  };
}

/**
 * Intelligent Header Finder that finds the real column header row and handles multi-tier/merged headers
 */
function findHeaderRows(rows: any[][], dateOptions?: ParseDateOptions): {
  headerRowIdx: number;
  compositeHeader: string[];
  dataStartRowIdx: number;
} {
  let bestRowIdx = -1;
  let maxScore = -1;

  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const row = rows[r] || [];
    let score = 0;
    const rowStr = row.map((c) => String(c || '').toLowerCase()).join(' ');

    if (/date|วัน|ว\/ด\/ป|ว-ด-ป|timestamp|ประทับเวลา/i.test(rowStr) && !/mfg/i.test(rowStr)) score += 10;
    if (/inspector|ผู้ตรวจ|ผู้ตรวจสอบ|ชื่อผู้ตรวจ|ผู้ลงชื่อ|ลงชื่อผู้ตรวจ|ลงชื่อ|ชื่อ-สกุล|ชื่อ\s*สกุล|ชื่อ\s*นามสกุล|พนักงาน|ผู้ปฏิบัติงาน|ผู้บันทึก|inspected|signature|sign/i.test(rowStr)) score += 8;
    if (/1\.1|d-ring/i.test(rowStr)) score += 8;
    if (/2\.1|ตะขอ/i.test(rowStr)) score += 8;
    if (/1\.2|สายรัด/i.test(rowStr)) score += 5;
    if (/2\.2|2\.4|เชือก/i.test(rowStr)) score += 5;
    if (/ผลการตรวจ|ผล.*harness|ผล.*lanyard|status|result|สรุปผล/i.test(rowStr)) score += 6;

    if (score > maxScore && score >= 4) {
      maxScore = score;
      bestRowIdx = r;
    }
  }

  if (bestRowIdx === -1) {
    bestRowIdx = 0;
  }

  // Combine rows around bestRowIdx to create a full composite header
  const compositeHeader: string[] = [];
  const maxCols = Math.max(...rows.slice(0, Math.min(rows.length, 10)).map((r) => r.length), 15);

  const startHeader = Math.max(0, bestRowIdx - 1);
  const endHeader = Math.min(rows.length - 1, bestRowIdx + 1);

  for (let c = 0; c < maxCols; c++) {
    const parts: string[] = [];
    for (let r = startHeader; r <= endHeader; r++) {
      const cellVal = rows[r] && rows[r][c] !== undefined ? String(rows[r][c]).trim() : '';
      if (cellVal && !parts.includes(cellVal)) {
        parts.push(cellVal);
      }
    }
    compositeHeader[c] = parts.join(' ');
  }

  // Determine where data rows actually begin (first row with a valid inspection date)
  let dataStartRowIdx = bestRowIdx + 1;
  for (let r = dataStartRowIdx; r < Math.min(rows.length, bestRowIdx + 6); r++) {
    const row = rows[r] || [];
    const hasDate = row.some((cell) => parseInspectionDate(cell, dateOptions).isValid);
    if (hasDate) {
      dataStartRowIdx = r;
      break;
    }
  }

  return { headerRowIdx: bestRowIdx, compositeHeader, dataStartRowIdx };
}

/**
 * Check if a sheet contains the 2-in-1 Combined Harness & Lanyard layout
 */
function checkIsCombinedSheet(rows: any[][]): boolean {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const rowStr = rows[r].map((c) => String(c || '').toLowerCase()).join(' ');
    if (
      (rowStr.includes('full body harness') || rowStr.includes('harness') || rowStr.includes('สายรัดตัว') || rowStr.includes('1.1')) &&
      (rowStr.includes('lanyard') || rowStr.includes('แลนยาร์ด') || rowStr.includes('เชือกนิรภัย') || rowStr.includes('2.1'))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a sheet is a direct 31-day Matrix template
 */
function checkIsMatrixSheet(rows: any[][]): boolean {
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const row = rows[r] || [];
    let consecutiveDayCount = 0;
    for (let c = 0; c < row.length; c++) {
      const val = parseInt(String(row[c]).trim(), 10);
      if (!isNaN(val) && val >= 1 && val <= 31) {
        consecutiveDayCount++;
      }
    }
    if (consecutiveDayCount >= 15) {
      return true;
    }
  }
  return false;
}

function isNonInspectorValue(str: string): boolean {
  const s = str.trim().toLowerCase();
  if (!s || s === '-' || s === '/' || s === '✓' || s === '✕' || s === '■' || s === 'x' || s === '1' || s === '0' || s === '2') return true;
  if (/^(วันที่|ลำดับ|ผลการตรวจ|หมายเหตุ|ชุดที่|status|date|no\.|no)$/i.test(s)) return true;
  if (/^(harness|lanyard|karam|petzl|d-ring|pn\s*\d+|absorbica|mfg)/i.test(s)) return true;
  return false;
}

function cleanInspectorNameStr(raw: string): string {
  if (!raw) return '';
  const cleaned = raw
    .normalize('NFC')
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/^[\d\.\-\s_]+/, '')
    .trim()
    .replace(/\s+/g, ' ');

  if (!cleaned) return '';
  return getCanonicalThaiName(cleaned);
}

function isLikelyInspectorName(str: string): boolean {
  if (!str) return false;
  const s = str.trim();
  if (isNonInspectorValue(s)) return false;
  if (/^(นาย|นางสาว|นาง|น\.ส\.|นส\.|ด\.ช\.|ด\.ญ\.|คุณ|ดร\.|ส\.อ\.|ส\.ท\.|ส\.ต\.|จ\.ส\.อ\.|จ\.ส\.ท\.|จ\.ส\.ต\.|ร\.ต\.|ร\.ท\.|ร\.อ\.|พ\.ต\.|พ\.ท\.|พ\.อ\.|ด\.ต\.|ว่าที่\s*ร\.ต\.|ว่าที่ร้อยตรี|Mr\.|Mrs\.|Miss)/i.test(s)) {
    return true;
  }
  if (/[\u0E00-\u0E7F]/.test(s) && s.length >= 3) {
    if (/^(ผ่าน|ไม่ผ่าน|ปกติ|ชำรุด|ใช้งาน|แก้ไข|ห้ามใช้|d-ring|karam|petzl|harness|lanyard|pn\s*\d+|absorbica|mfg)/i.test(s)) {
      return false;
    }
    return true;
  }
  return false;
}

function extractInspectorFromRow(row: any[], designatedColIdx: number): string {
  if (designatedColIdx >= 0 && designatedColIdx < row.length) {
    const val = String(row[designatedColIdx] || '').trim();
    if (val && !isNonInspectorValue(val) && isLikelyInspectorName(val)) {
      return cleanInspectorNameStr(val);
    }
  }

  for (let c = 0; c < Math.min(row.length, 6); c++) {
    const val = String(row[c] || '').trim();
    if (!val || val.length < 2) continue;
    if (isLikelyInspectorName(val)) {
      return cleanInspectorNameStr(val);
    }
  }

  if (designatedColIdx >= 0 && designatedColIdx < row.length) {
    const fallbackVal = String(row[designatedColIdx] || '').trim();
    if (fallbackVal && !isNonInspectorValue(fallbackVal)) {
      return cleanInspectorNameStr(fallbackVal);
    }
  }

  return '';
}

/**
 * Parses the standard 2-in-1 Combined Harness and Lanyard sheet format
 */
function parseCombinedSheet(
  sheetName: string,
  rows: any[][],
  records: InspectionRecord[],
  harnessEqMap: Map<string, EquipmentItem>,
  lanyardEqMap: Map<string, EquipmentItem>,
  monthsSet: Set<string>,
  yearsSet: Set<string>,
  issues: ValidationIssue[],
  dateOptions?: ParseDateOptions
) {
  const { compositeHeader, dataStartRowIdx } = findHeaderRows(rows, dateOptions);

  // Detect column indices based on header content
  let colDate = compositeHeader.findIndex((h) => /date|วัน|ว\/ด\/ป|ว-ด-ป|timestamp|ประทับเวลา/i.test(h) && !/mfg/i.test(h));
  let colInspector = compositeHeader.findIndex((h) => /inspector|ผู้ตรวจ|ผู้ตรวจสอบ|ชื่อผู้ตรวจ|ผู้ลงชื่อ|ลงชื่อผู้ตรวจ|ลงชื่อ|ชื่อ-สกุล|ชื่อ\s*สกุล|ชื่อ\s*นามสกุล|พนักงาน|ผู้ปฏิบัติงาน|ผู้บันทึก|inspected|signature|sign/i.test(h));

  // Harness Columns
  let colHarnessEq = compositeHeader.findIndex((h) => /\(1\)|harness|สายรัดตัว/i.test(h) && !/1\.[1-4]|ผล/i.test(h));
  let colH1 = compositeHeader.findIndex((h) => /1\.1|d-ring/i.test(h));
  let colH2 = compositeHeader.findIndex((h) => /1\.2|สายรัด.*harness|harness.*สายรัด/i.test(h) || /1\.2/i.test(h));
  let colH3 = compositeHeader.findIndex((h) => /1\.3|รอยเย็บ.*harness|harness.*รอยเย็บ/i.test(h) || /1\.3/i.test(h));
  let colH4 = compositeHeader.findIndex((h) => /1\.4|ป้าย.*harness|harness.*ป้าย/i.test(h) || /1\.4/i.test(h));
  let colHarnessResult = compositeHeader.findIndex((h) => /ผลการตรวจสอบ.*harness|ผล.*harness|harness.*ผล/i.test(h));

  // Lanyard Columns
  let colLanyardEq = compositeHeader.findIndex((h) => /\(2\)|lanyard|เชือกนิรภัย/i.test(h) && !/2\.[1-6]|ผล/i.test(h));
  let colL1 = compositeHeader.findIndex((h) => /2\.1|ตะขอ/i.test(h));
  let colL2 = compositeHeader.findIndex((h) => /2\.2|สายรัด.*lanyard|lanyard.*สายรัด/i.test(h) || /2\.2/i.test(h));
  let colL3 = compositeHeader.findIndex((h) => /2\.3|รอยเย็บ.*lanyard|lanyard.*รอยเย็บ/i.test(h) || /2\.3/i.test(h));
  let colL4 = compositeHeader.findIndex((h) => /2\.4|เชือก/i.test(h));
  let colL5 = compositeHeader.findIndex((h) => /2\.5|ดูดซับ|absorb/i.test(h));
  let colL6 = compositeHeader.findIndex((h) => /2\.6|ป้าย.*lanyard|lanyard.*ป้าย/i.test(h) || /2\.6/i.test(h));
  let colLanyardResult = compositeHeader.findIndex((h) => /ผลการตรวจสอบ.*lanyard|ผล.*lanyard|lanyard.*ผล/i.test(h));

  // Standard positional fallbacks if header text is non-standard
  if (colDate === -1) colDate = 1;
  if (colInspector === -1) colInspector = 2;
  if (colHarnessEq === -1) colHarnessEq = 3;
  if (colH1 === -1) colH1 = 4;
  if (colH2 === -1) colH2 = 5;
  if (colH3 === -1) colH3 = 6;
  if (colH4 === -1) colH4 = 7;
  if (colHarnessResult === -1) colHarnessResult = 8;
  if (colLanyardEq === -1) colLanyardEq = 9;
  if (colL1 === -1) colL1 = 10;
  if (colL2 === -1) colL2 = 11;
  if (colL3 === -1) colL3 = 12;
  if (colL4 === -1) colL4 = 13;
  if (colL5 === -1) colL5 = 14;
  if (colL6 === -1) colL6 = 15;
  if (colLanyardResult === -1) colLanyardResult = 16;

  for (let r = dataStartRowIdx; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c === '' || c === undefined || c === null)) continue;

    const rowNum = r + 1;
    const rowStr = row.map((c) => String(c || '').toLowerCase()).join(' ');

    // Skip secondary header rows or footer notes that might repeat in the middle of sheet
    if (
      /^(วันที่|date|ลำดับ|no|หมายเหตุ|ผู้ควบคุม|สรุป|ลงชื่อ)/i.test(String(row[0] || '').trim()) ||
      /^(วันที่|date|ลำดับ|no)/i.test(String(row[1] || '').trim()) ||
      (rowStr.includes('full body harness') && rowStr.includes('d-ring'))
    ) {
      continue;
    }

    // 1. Check Date in designated Date column (Column B / colDate)
    let parsedDate: ParsedDateInfo | null = null;
    let dateVal: any = null;

    if (colDate !== -1 && colDate < row.length && row[colDate] !== '') {
      dateVal = row[colDate];
      const res = parseInspectionDate(dateVal, dateOptions);
      if (res.isValid) parsedDate = res;
    }

    // Prioritize Column B (index 1) if colDate was elsewhere and failed
    if (!parsedDate && row[1] !== undefined && row[1] !== '') {
      dateVal = row[1];
      const res = parseInspectionDate(dateVal, dateOptions);
      if (res.isValid) parsedDate = res;
    }

    // Fallback: Check Column A (index 0)
    if (!parsedDate && row[0] !== undefined && row[0] !== '') {
      const res = parseInspectionDate(row[0], dateOptions);
      if (res.isValid) {
        parsedDate = res;
        dateVal = row[0];
      }
    }

    if (!parsedDate || !parsedDate.isValid) {
      const hasAnyData = row.some((c) => String(c || '').trim().length > 0);
      if (hasAnyData && (rowStr.includes('ผ่าน') || rowStr.includes('karam') || rowStr.includes('petzl'))) {
        const errReason = parsedDate?.errorReason || `ค่าในตาราง: "${dateVal || ''}"`;
        issues.push({
          type: 'warning',
          message: `แถวที่ ${rowNum}: ไม่พบวันที่ที่ถูกต้อง (${errReason})`,
          row: rowNum,
          field: 'InspectionDate',
        });
      }
      continue;
    }

    const { day, monthNameThai: month, yearBEStr: year, dateKey, displayDateThai: dateStr, yearCE, yearBE } = parsedDate;

    // Diagnostic logging for source of truth verification
    if (r <= dataStartRowIdx + 10 || rowNum === 2 || rowNum === 11) {
      console.log(`[Diagnostic] Sheet: ${sheetName}, Row: ${rowNum}, Raw: ${dateVal}, Parsed: ${dateKey}, Report Day: ${day}, Month: ${month}, YearBE: ${yearBE}`);
    }

    monthsSet.add(month);
    yearsSet.add(year);
    const groupKey = `${dateKey}:::${month}:::${day}`;

    const inspectorName = extractInspectorFromRow(row, colInspector);

    // --- 1. Full Body Harness Row Processing ---
    const harnessEqRaw = colHarnessEq !== -1 && row[colHarnessEq] ? String(row[colHarnessEq]).trim() : '';
    if (harnessEqRaw) {
      const eqItem = parseEquipmentDescriptor(harnessEqRaw, 'harness');
      const cleanName = normalizeEquipmentName(eqItem.name);
      const normSn = normalizeSerialNumber(eqItem.sn);
      eqItem.name = cleanName;
      eqItem.sn = normSn;
      const eqKey = getEquipmentIdentityKey('harness', cleanName, normSn);

      if (!harnessEqMap.has(eqKey)) {
        harnessEqMap.set(eqKey, { ...eqItem });
      } else {
        const existing = harnessEqMap.get(eqKey)!;
        if (existing.egatNo === '-' && eqItem.egatNo && eqItem.egatNo !== '-') existing.egatNo = eqItem.egatNo;
        if (existing.brandModel === '-' && eqItem.brandModel && eqItem.brandModel !== '-') existing.brandModel = eqItem.brandModel;
        if (!existing.mfgDate && eqItem.mfgDate) existing.mfgDate = eqItem.mfgDate;
      }

      const hResVal = colHarnessResult !== -1 && colHarnessResult < row.length ? row[colHarnessResult] : '';
      const hStatusParsed = parseInspectionResultValue(hResVal);

      const h1Val = colH1 !== -1 && colH1 < row.length ? row[colH1] : '';
      const h2Val = colH2 !== -1 && colH2 < row.length ? row[colH2] : '';
      const h3Val = colH3 !== -1 && colH3 < row.length ? row[colH3] : '';
      const h4Val = colH4 !== -1 && colH4 < row.length ? row[colH4] : '';

      const hItemResults: { [itemId: number]: string } = {};
      const p1 = parseInspectionResultValue(h1Val);
      const p2 = parseInspectionResultValue(h2Val);
      const p3 = parseInspectionResultValue(h3Val);
      const p4 = parseInspectionResultValue(h4Val);

      hItemResults[1] = p1.symbol || '/';
      hItemResults[2] = p2.symbol || '/';
      hItemResults[3] = p3.symbol || '/';
      hItemResults[4] = p4.symbol || '/';

      let rowDayStatus: InspectionStatusValue = 'normal';
      if (hStatusParsed.status === 'abnormal_unusable' || p1.status === 'abnormal_unusable' || p2.status === 'abnormal_unusable' || p3.status === 'abnormal_unusable' || p4.status === 'abnormal_unusable') {
        rowDayStatus = 'abnormal_unusable';
      } else if (hStatusParsed.status === 'abnormal_usable' || p1.status === 'abnormal_usable' || p2.status === 'abnormal_usable' || p3.status === 'abnormal_usable' || p4.status === 'abnormal_usable') {
        rowDayStatus = 'abnormal_usable';
      }

      records.push({
        plant: '',
        equipmentType: 'harness',
        month,
        year,
        day,
        dateKey,
        dateStr,
        inspectionDate: {
          year: yearCE,
          month: parsedDate.month,
          day,
          yearBE,
        },
        rawInspectionDate: dateVal,
        inspectorName,
        equipmentItems: [{ ...eqItem }],
        itemResults: hItemResults,
        dayStatus: rowDayStatus,
        rawRowNumber: rowNum,
      });
    }

    // --- 2. Lanyard Row Processing ---
    const lanyardEqRaw = colLanyardEq !== -1 && row[colLanyardEq] ? String(row[colLanyardEq]).trim() : '';
    if (lanyardEqRaw) {
      const eqItem = parseEquipmentDescriptor(lanyardEqRaw, 'lanyard');
      const cleanName = normalizeEquipmentName(eqItem.name);
      const normSn = normalizeSerialNumber(eqItem.sn);
      eqItem.name = cleanName;
      eqItem.sn = normSn;
      const eqKey = getEquipmentIdentityKey('lanyard', cleanName, normSn);

      if (!lanyardEqMap.has(eqKey)) {
        lanyardEqMap.set(eqKey, { ...eqItem });
      } else {
        const existing = lanyardEqMap.get(eqKey)!;
        if (existing.egatNo === '-' && eqItem.egatNo && eqItem.egatNo !== '-') existing.egatNo = eqItem.egatNo;
        if (existing.brandModel === '-' && eqItem.brandModel && eqItem.brandModel !== '-') existing.brandModel = eqItem.brandModel;
        if (!existing.mfgDate && eqItem.mfgDate) existing.mfgDate = eqItem.mfgDate;
      }

      const lResVal = colLanyardResult !== -1 && colLanyardResult < row.length ? row[colLanyardResult] : '';
      const lStatusParsed = parseInspectionResultValue(lResVal);

      const l1Val = colL1 !== -1 && colL1 < row.length ? row[colL1] : '';
      const l2Val = colL2 !== -1 && colL2 < row.length ? row[colL2] : '';
      const l3Val = colL3 !== -1 && colL3 < row.length ? row[colL3] : '';
      const l4Val = colL4 !== -1 && colL4 < row.length ? row[colL4] : '';
      const l5Val = colL5 !== -1 && colL5 < row.length ? row[colL5] : '';
      const l6Val = colL6 !== -1 && colL6 < row.length ? row[colL6] : '';

      const lItemResults: { [itemId: number]: string } = {};
      const p1 = parseInspectionResultValue(l1Val);
      const p2 = parseInspectionResultValue(l2Val);
      const p3 = parseInspectionResultValue(l3Val);
      const p4 = parseInspectionResultValue(l4Val);
      const p5 = parseInspectionResultValue(l5Val);
      const p6 = parseInspectionResultValue(l6Val);

      lItemResults[1] = p1.symbol || '/';
      lItemResults[2] = p2.symbol || '/';
      lItemResults[3] = p3.symbol || '/';
      lItemResults[4] = p4.symbol || '/';
      lItemResults[5] = p5.symbol || '/';
      lItemResults[6] = p6.symbol || '/';

      let rowDayStatus: InspectionStatusValue = 'normal';
      if (lStatusParsed.status === 'abnormal_unusable' || p1.status === 'abnormal_unusable' || p2.status === 'abnormal_unusable' || p3.status === 'abnormal_unusable' || p4.status === 'abnormal_unusable' || p5.status === 'abnormal_unusable' || p6.status === 'abnormal_unusable') {
        rowDayStatus = 'abnormal_unusable';
      } else if (lStatusParsed.status === 'abnormal_usable' || p1.status === 'abnormal_usable' || p2.status === 'abnormal_usable' || p3.status === 'abnormal_usable' || p4.status === 'abnormal_usable' || p5.status === 'abnormal_usable' || p6.status === 'abnormal_usable') {
        rowDayStatus = 'abnormal_usable';
      }

      records.push({
        plant: '',
        equipmentType: 'lanyard',
        month,
        year,
        day,
        dateKey,
        dateStr,
        inspectionDate: {
          year: yearCE,
          month: parsedDate.month,
          day,
          yearBE,
        },
        rawInspectionDate: dateVal,
        inspectorName,
        equipmentItems: [{ ...eqItem }],
        itemResults: lItemResults,
        dayStatus: rowDayStatus,
        rawRowNumber: rowNum,
      });
    }
  }
}

/**
 * Apply cell result value to day item results
 */
function applyItemResult(
  dayObj: { itemResults: { [item: number]: string }; dayStatus: InspectionStatusValue },
  itemIdx: number,
  val: any
) {
  if (val === undefined || val === null || String(val).trim() === '') return;
  const parsed = parseInspectionResultValue(val);

  if (parsed.status === 'abnormal_unusable') {
    dayObj.itemResults[itemIdx] = '■';
    dayObj.dayStatus = 'abnormal_unusable';
  } else if (parsed.status === 'abnormal_usable') {
    if (dayObj.itemResults[itemIdx] !== '■') {
      dayObj.itemResults[itemIdx] = 'X';
    }
    if (dayObj.dayStatus !== 'abnormal_unusable') {
      dayObj.dayStatus = 'abnormal_usable';
    }
  } else {
    // Normal / Pass
    if (parsed.symbol === '✓') {
      if (dayObj.itemResults[itemIdx] !== '■' && dayObj.itemResults[itemIdx] !== 'X') {
        dayObj.itemResults[itemIdx] = '✓';
      }
    } else {
      if (!dayObj.itemResults[itemIdx] || (dayObj.itemResults[itemIdx] !== '■' && dayObj.itemResults[itemIdx] !== 'X' && dayObj.itemResults[itemIdx] !== '✓')) {
        dayObj.itemResults[itemIdx] = '/';
      }
    }
  }
}

/**
 * Parses single sheet format (one equipment type per sheet or standard tabular log)
 */
function parseSingleSheet(
  sheetName: string,
  rows: any[][],
  records: InspectionRecord[],
  harnessEqMap: Map<string, EquipmentItem>,
  lanyardEqMap: Map<string, EquipmentItem>,
  monthsSet: Set<string>,
  yearsSet: Set<string>,
  _issues: ValidationIssue[],
  dateOptions?: ParseDateOptions
) {
  const eqType = normalizeEquipmentType(sheetName) || 'harness';
  const { compositeHeader, dataStartRowIdx } = findHeaderRows(rows, dateOptions);

  let colDate = compositeHeader.findIndex((h) => /date|วัน|ว\/ด\/ป|ว-ด-ป|timestamp|ประทับเวลา/i.test(h) && !/mfg/i.test(h));
  let colInspector = compositeHeader.findIndex((h) => /inspector|ผู้ตรวจ|ผู้ตรวจสอบ|inspected/i.test(h));
  let colEq = compositeHeader.findIndex((h) => /equipment|อุปกรณ์|item|ชื่อ/i.test(h));
  let colStatus = compositeHeader.findIndex((h) => /status|ผล|สถานะ|สรุปผล/i.test(h));

  // Also detect item columns 1.1..1.4 or 2.1..2.6
  const itemColMap: { [item: number]: number } = {};
  const maxItems = eqType === 'harness' ? 4 : 6;
  for (let i = 1; i <= maxItems; i++) {
    const prefix = eqType === 'harness' ? `1.${i}` : `2.${i}`;
    const idx = compositeHeader.findIndex((h) => h.includes(prefix) || h.includes(`ข้อ ${prefix}`));
    if (idx !== -1) {
      itemColMap[i] = idx;
    }
  }

  if (colDate === -1) colDate = 1;
  if (colInspector === -1) colInspector = 2;
  if (colEq === -1) colEq = 3;

  interface SingleDayGroupData {
    dateKey: string;
    year: string;
    month: string;
    day: number;
    dateStr: string;
    inspectionDate: {
      year: number;
      month: number;
      day: number;
      yearBE: number;
    };
    rawInspectionDate: any;
    inspector: string;
    itemResults: { [item: number]: string };
    dayStatus: InspectionStatusValue;
    rawRowNumber?: number;
  }
  const groupMap = new Map<string, SingleDayGroupData>();

  for (let r = dataStartRowIdx; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => !c)) continue;
    const rowNum = r + 1;

    // Check date
    let parsedDate: ParsedDateInfo | null = null;
    let dateVal: any = null;
    if (colDate !== -1 && colDate < row.length && row[colDate] !== '') {
      dateVal = row[colDate];
      const res = parseInspectionDate(dateVal, dateOptions);
      if (res.isValid) parsedDate = res;
    }
    if (!parsedDate && row[1] !== undefined && row[1] !== '') {
      dateVal = row[1];
      const res = parseInspectionDate(dateVal, dateOptions);
      if (res.isValid) parsedDate = res;
    }
    if (!parsedDate && row[0] !== undefined && row[0] !== '') {
      dateVal = row[0];
      const res = parseInspectionDate(dateVal, dateOptions);
      if (res.isValid) parsedDate = res;
    }

    if (!parsedDate || !parsedDate.isValid) continue;

    const { day, monthNameThai: month, yearBEStr: year, dateKey, displayDateThai: dateStr, yearCE, yearBE } = parsedDate;

    monthsSet.add(month);
    yearsSet.add(year);
    const groupKey = `${dateKey}:::${month}:::${day}`;

    const inspectorName = extractInspectorFromRow(row, colInspector);

    if (colEq !== -1 && row[colEq]) {
      const eqItem = parseEquipmentDescriptor(String(row[colEq]), eqType);
      if (eqType === 'harness') {
        harnessEqMap.set(eqItem.sn + eqItem.name, eqItem);
      } else {
        lanyardEqMap.set(eqItem.sn + eqItem.name, eqItem);
      }
    }

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        dateKey,
        year,
        month,
        day,
        dateStr,
        inspectionDate: {
          year: yearCE,
          month: parsedDate.month,
          day,
          yearBE,
        },
        rawInspectionDate: dateVal,
        itemResults: {},
        dayStatus: 'normal',
        inspector: inspectorName,
        rawRowNumber: rowNum,
      });
    }

    const dayGroup = groupMap.get(groupKey)!;
    if (inspectorName && !dayGroup.inspector) dayGroup.inspector = inspectorName;

    // Parse individual checklist items if columns exist
    for (let i = 1; i <= maxItems; i++) {
      const colIdx = itemColMap[i];
      if (colIdx !== undefined && colIdx < row.length) {
        applyItemResult(dayGroup, i, row[colIdx]);
      }
    }

    if (colStatus !== -1 && row[colStatus]) {
      const parsedStatus = parseInspectionResultValue(row[colStatus]);
      if (parsedStatus.status === 'abnormal_unusable') {
        dayGroup.dayStatus = 'abnormal_unusable';
      } else if (parsedStatus.status === 'abnormal_usable' && dayGroup.dayStatus !== 'abnormal_unusable') {
        dayGroup.dayStatus = 'abnormal_usable';
      }
    }
  }

  for (const data of groupMap.values()) {
    for (let i = 1; i <= maxItems; i++) {
      if (!data.itemResults[i]) data.itemResults[i] = '/';
    }
    records.push({
      plant: '',
      equipmentType: eqType,
      month: data.month,
      year: data.year,
      day: data.day,
      dateKey: data.dateKey,
      dateStr: data.dateStr,
      inspectionDate: data.inspectionDate,
      rawInspectionDate: data.rawInspectionDate,
      inspectorName: data.inspector,
      equipmentItems: Array.from((eqType === 'harness' ? harnessEqMap : lanyardEqMap).values()),
      itemResults: data.itemResults,
      dayStatus: data.dayStatus,
      rawRowNumber: data.rawRowNumber,
    });
  }
}

/**
 * Parses direct 31-Day Matrix Sheets where columns are days 1..31 and rows are checklist items
 */
function parseMatrixSheet(
  sheetName: string,
  rows: any[][],
  records: InspectionRecord[],
  harnessEqMap: Map<string, EquipmentItem>,
  lanyardEqMap: Map<string, EquipmentItem>,
  monthsSet: Set<string>,
  yearsSet: Set<string>,
  _issues: ValidationIssue[],
  _dateOptions?: ParseDateOptions
) {
  // Extract month and year from top rows or sheet name
  let month = '';
  let year = '';

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const rowStr = rows[r].map((c) => String(c || '')).join(' ');
    const mMatch = rowStr.match(/เดือน\s*([^\s\d]+)/);
    if (mMatch && mMatch[1]) {
      month = normalizeMonth(mMatch[1]);
    }
    const yMatch = rowStr.match(/พ\.ศ\.\s*(\d{2,4})/) || rowStr.match(/ปี\s*(\d{2,4})/);
    if (yMatch && yMatch[1]) {
      year = normalizeYearBE(yMatch[1]);
    }
  }

  if (!month) {
    for (const m of THAI_MONTHS) {
      if (sheetName.includes(m)) {
        month = m;
        break;
      }
    }
  }
  if (!month) month = 'มีนาคม';
  if (!year) year = '2569';

  monthsSet.add(month);
  yearsSet.add(year);

  // Find row with numbers 1..31
  let dayRowIdx = -1;
  const dayColMap: { [col: number]: number } = {}; // colIdx -> dayNumber (1..31)

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r] || [];
    let foundDays = 0;
    for (let c = 0; c < row.length; c++) {
      const num = parseInt(String(row[c]).trim(), 10);
      if (!isNaN(num) && num >= 1 && num <= 31) {
        dayColMap[c] = num;
        foundDays++;
      }
    }
    if (foundDays >= 15) {
      dayRowIdx = r;
      break;
    }
  }

  if (dayRowIdx === -1) return;

  const eqType: EquipmentType = sheetName.toLowerCase().includes('lanyard') || sheetName.toLowerCase().includes('แลนยาร์ด') ? 'lanyard' : 'harness';
  const maxItems = eqType === 'harness' ? 4 : 6;

  // Find rows corresponding to items 1.1..1.4 or 2.1..2.6
  const itemRowMap: { [item: number]: number } = {};
  for (let r = dayRowIdx + 1; r < rows.length; r++) {
    const rowStr = String(rows[r][0] || '') + ' ' + String(rows[r][1] || '');
    for (let i = 1; i <= maxItems; i++) {
      const prefix = eqType === 'harness' ? `1.${i}` : `2.${i}`;
      if (rowStr.includes(prefix) || String(rows[r][0]).trim() === String(i)) {
        itemRowMap[i] = r;
      }
    }
  }

  // Construct day records for all columns with day numbers
  for (const [cStr, dayNum] of Object.entries(dayColMap)) {
    const colIdx = parseInt(cStr, 10);
    let hasAnyData = false;
    const itemResults: { [item: number]: string } = {};

    for (let i = 1; i <= maxItems; i++) {
      const rIdx = itemRowMap[i];
      if (rIdx !== undefined && rows[rIdx] && rows[rIdx][colIdx] !== undefined) {
        const val = rows[rIdx][colIdx];
        if (val !== '' && val !== null && val !== undefined) {
          hasAnyData = true;
          const parsed = parseInspectionResultValue(val);
          itemResults[i] = parsed.symbol || '/';
        }
      }
    }

    if (hasAnyData) {
      for (let i = 1; i <= maxItems; i++) {
        if (!itemResults[i]) itemResults[i] = '/';
      }
      records.push({
        plant: '',
        equipmentType: eqType,
        month,
        year,
        day: dayNum,
        dateStr: `${dayNum} ${month} ${year}`,
        inspectorName: '',
        equipmentItems: Array.from((eqType === 'harness' ? harnessEqMap : lanyardEqMap).values()),
        itemResults,
        dayStatus: Object.values(itemResults).includes('■') ? 'abnormal_unusable' : Object.values(itemResults).includes('X') ? 'abnormal_usable' : 'normal',
      });
    }
  }
}

/**
 * Generates and downloads a sample Excel template matching the exact format
 */
export function generateExcelTemplate() {
  const headers = [
    'PowerPlant',
    'InspectionDate',
    'InspectedBy',
    '(1)Full Body Harness',
    '1.1 Harness_D-ring และหัวเข็มขัด: ต้องอยู่ในสภาพดีไม่บิดเบี้ยว ไม่มีรอยแตกร้าว สนิม และขอบคมหัวเข็มขัด ต้องปรับเลื่อนได้โดยไม่ติดขัด',
    '1.2 Harness_สายรัด : ต้องอยู่ในสภาพ ดีไม่มีรอยตัด ฉีกขาด รอยไหม้เส้นด้ายหลุดลุ่ย หรือสีซีดจาง',
    '1.3 Harness_รอยเย็บ: ต้องแน่นและไม่มีรอยตัด',
    '1.4 Harness_ป้ายเครื่องหมาย: ต้องอยู่ในสภาพดีไม่ขาด ตัวหนังสือชัดเจน',
    'ผลการตรวจสอบ Full Body Harness',
    '(2)Lanyard',
    '2.1 Lanyard_ตะขอเกี่ยว, Carabiner และ D-ring : ต้องอยู่ใน สภาพดีไม่บิดเบี้ยว ไม่มีรอยแตกรา้ว สนิม และขอบคด',
    '2.2 Lanyard_สายรัด : ต้องอยู่ในสภาพดีไม่มีรอยตัด ฉีกขาด รอยไหม้เส้นด้ายหลุดลุ่ย หรือสีซีดจาง',
    '2.3 Lanyard_รอยเย็บ: ต้องแน่นและไม่มีรอยตัด',
    '2.4 Lanyard_เชือก: ต้องอยู่ในสภาพดีแน่นเป็นเส้นเดียวกัน ไม่มีรอยตัด รอยไหม้ ไม่พันกันเป็นปม หรือสีซีดจาง',
    '2.5 Lanyard_อุปกรณ์ดูดซับแรงกระชาก: ต้องอยู่ในสภาพดีไม่ยืดออก และฉีดขาด',
    '2.6 Lanyard_ป้ายเครื่องหมาย: ต้องอยู่ในสภาพดีไม่ขาด ตัวหนังสือชัดเจน',
    'ผลการตรวจสอบ_Lanyard',
  ];

  const sampleRows = [
    [
      'โรงไฟฟ้า',
      '04/03/2569',
      'นายนพพร เวชเตง',
      '4_Karam รุ่น PN 23 S/N 0035 MFG Date 01/2024',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน สามารถนำไปใช้งานได้อย่างปลอดภัย',
      '4_Karam รุ่น PN 361N S/N 0096 MFG Date 01/2024',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน สามารถนำไปใช้งานได้อย่างปลอดภัย',
    ],
    [
      'โรงไฟฟ้า',
      '05/03/2569',
      'นายสุรินทร์ สารอนินทร์',
      '1_Karam รุ่น PN 23 S/N 0061 MFG Date 08/2023',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน สามารถนำไปใช้งานได้อย่างปลอดภัย',
      '1_Karam รุ่น PN 361N S/N 0029 MFG Date 08/2023',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน สามารถนำไปใช้งานได้อย่างปลอดภัย',
    ],
    [
      'โรงไฟฟ้า',
      '06/03/2569',
      'นายอานนท์ ภวรัญพงษ์',
      '5_Karam รุ่น PN 23 S/N 0036 MFG Date 01/2024',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน สามารถนำไปใช้งานได้อย่างปลอดภัย',
      '5_Karam รุ่น PN 361N S/N 0092 MFG Date 01/2024',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน สามารถนำไปใช้งานได้อย่างปลอดภัย',
    ],
    [
      'โรงไฟฟ้า',
      '09/03/2569',
      'นายกิตติคุณ ลิ่วศิริวงศ์เจริญ',
      '2_Karam รุ่น PN 23 S/N 0068 MFG Date 08/2023',
      'ไม่ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ไม่ผ่าน/ ส่งซ่อมหรือแก้ไขให้อยู่ในสภาพดีก่อนนำเข้าใช้งาน',
      '2_Karam รุ่น PN 361N S/N 0055 MFG Date 11/2023',
      'ไม่ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ไม่ผ่าน/ ส่งซ่อมหรือแก้ไขให้อยู่ในสภาพดีก่อนนำเข้าใช้งาน',
    ],
    [
      'โรงไฟฟ้า',
      '10/03/2569',
      'นายภานุพงศ์ ยามะสกั',
      '10_Karam รุ่น PN 23 S/N 0022 MFG Date 04/2025',
      'ไม่ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ไม่ผ่าน/ ส่งซ่อมหรือแก้ไขให้อยู่ในสภาพดีก่อนนำเข้าใช้งาน',
      '10_ Karam รุ่น PN 361N S/N 0008 MFG Date 04/2025',
      'ไม่ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ผ่าน',
      'ไม่ผ่าน/ ส่งซ่อมหรือแก้ไขให้อยู่ในสภาพดีก่อนนำเข้าใช้งาน',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inspection_Log');

  XLSX.writeFile(wb, 'แบบฟอร์มตรวจสอบ_Harness_และ_Lanyard_Template.xlsx');
}
