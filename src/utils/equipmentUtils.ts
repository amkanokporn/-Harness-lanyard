import { EquipmentItem, EquipmentType, InspectionRecord } from '../types';
import { normalizeMonth, normalizeYearBE } from '../constants/masterTemplates';

/**
 * Normalizes equipment name by:
 * - Trimming leading/trailing whitespace
 * - Collapsing multiple consecutive spaces into a single space
 * - Stripping any existing checkmark symbols (✓, √, ✔, etc.)
 * - Preserving '(สำรอง)' distinctions (e.g. "Harness-8 (สำรอง)" !== "Harness-8")
 * - Ensuring standard naming conventions (e.g. "Harness-2", "Lanyard-2", "Harness for Rescue")
 */
export function normalizeEquipmentName(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  let name = raw.trim();

  // Strip checkmarks, check characters, and brackets containing checkmarks
  name = name
    .replace(/[✓√✔]/g, '')
    .replace(/\[\s*[✓√✔]?\s*\]/g, '')
    .replace(/\(\s*[✓√✔]?\s*\)/g, '')
    .trim();

  // Collapse multiple whitespace
  name = name.replace(/\s+/g, ' ');

  // Standardize common patterns
  name = name
    .replace(/^harness\s*[-_]?\s*(\d+)/i, 'Harness-$1')
    .replace(/^lanyard\s*[-_]?\s*(\d+)/i, 'Lanyard-$1')
    .replace(/^harness\s+for\s+rescue/i, 'Harness for Rescue')
    .replace(/^lanyard\s+for\s+rescue/i, 'Lanyard for Rescue');

  return name;
}

/**
 * Normalizes Serial Number (S/N)
 */
export function normalizeSerialNumber(raw: string): string {
  if (!raw || typeof raw !== 'string') return '-';
  const str = raw.trim();
  if (str === '' || str === '-' || str === 'ไม่มี' || str === 'N/A' || str === 'n/a') {
    return '-';
  }

  // Extract S/N digits or code
  const match = str.match(/s\/n\s*([a-zA-Z0-9_-]+)/i) || str.match(/sn\s*([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    return `s/n ${match[1]}`;
  }

  if (/^[a-zA-Z0-9_-]+$/.test(str)) {
    return `s/n ${str}`;
  }

  return str;
}

/**
 * Generates a unique, normalized comparison identity key for equipment
 * Equipment with the same name AND same serial number are considered the EXACT same equipment.
 * If serial number differs (e.g. s/n 0068 vs s/n 0070), they are treated as distinct equipment.
 * Harness-8 (สำรอง) and Harness-8 have different normalized names, so their keys will differ.
 */
export function getEquipmentIdentityKey(
  type: EquipmentType,
  name: string,
  sn?: string
): string {
  const normName = normalizeEquipmentName(name).toLowerCase();
  const normSn = normalizeSerialNumber(sn || '').toLowerCase();

  const snPart = normSn && normSn !== '-' ? `|sn:${normSn}` : '';
  return `${type.toLowerCase()}|${normName}${snPart}`;
}

/**
 * Sorts equipment list so that numbers 1, 2, 3... appear in numerical order with (สำรอง) and Rescue in logical order
 */
export function sortEquipmentList(list: EquipmentItem[], _type: EquipmentType): EquipmentItem[] {
  return [...list].sort((a, b) => {
    const aName = normalizeEquipmentName(a.name);
    const bName = normalizeEquipmentName(b.name);

    const aIsRescue = aName.toLowerCase().includes('rescue') || (a.brandModel && a.brandModel.toLowerCase().includes('petzl'));
    const bIsRescue = bName.toLowerCase().includes('rescue') || (b.brandModel && b.brandModel.toLowerCase().includes('petzl'));
    if (aIsRescue && !bIsRescue) return 1;
    if (!aIsRescue && bIsRescue) return -1;

    // Extract leading number like 1, 2, 3...
    const aNumMatch = aName.match(/\d+/);
    const bNumMatch = bName.match(/\d+/);
    const aNum = aNumMatch ? parseInt(aNumMatch[0], 10) : 999;
    const bNum = bNumMatch ? parseInt(bNumMatch[0], 10) : 999;

    if (aNum !== bNum) {
      return aNum - bNum;
    }

    // If numbers are equal, check if one is "(สำรอง)"
    const aIsSpare = aName.includes('สำรอง');
    const bIsSpare = bName.includes('สำรอง');
    if (!aIsSpare && bIsSpare) return -1;
    if (aIsSpare && !bIsSpare) return 1;

    return aName.localeCompare(bName, 'th');
  });
}

/**
 * Deduplicates and merges equipment items
 * Ensures no duplicate equipment appears while preserving all details and avoiding duplicates like "Harness-2" + "Harness-2"
 */
export function deduplicateEquipmentList(
  items: EquipmentItem[],
  type: EquipmentType
): { deduplicated: EquipmentItem[]; duplicateCount: number; mergedDetails: string[] } {
  const map = new Map<string, EquipmentItem>();
  const mergedDetails: string[] = [];
  let duplicateCount = 0;

  for (const item of items) {
    const cleanName = normalizeEquipmentName(item.name);
    if (!cleanName) continue;

    const normSn = normalizeSerialNumber(item.sn);
    const key = getEquipmentIdentityKey(type, cleanName, normSn);

    if (!map.has(key)) {
      map.set(key, {
        id: item.id || key,
        name: cleanName,
        sn: normSn,
        egatNo: item.egatNo || '-',
        brandModel: item.brandModel || '-',
        mfgDate: item.mfgDate || '',
        isCheckedInReport: false,
      });
    } else {
      duplicateCount++;
      const existing = map.get(key)!;
      mergedDetails.push(
        `รวมอุปกรณ์ซ้ำ: "${cleanName}" (${normSn}) -> รวมเข้ากับรายการเดิม`
      );

      // Merge better attributes if existing has placeholder '-'
      if (existing.egatNo === '-' && item.egatNo && item.egatNo !== '-') {
        existing.egatNo = item.egatNo;
      }
      if (existing.brandModel === '-' && item.brandModel && item.brandModel !== '-') {
        existing.brandModel = item.brandModel;
      }
      if (!existing.mfgDate && item.mfgDate) {
        existing.mfgDate = item.mfgDate;
      }
    }
  }

  const deduplicated = sortEquipmentList(Array.from(map.values()), type);
  return { deduplicated, duplicateCount, mergedDetails };
}

/**
 * Prepares the Equipment List for Report generation (Word DOCX or PDF Preview)
 *
 * Rules:
 * 1. Deduplicates equipment list strictly by Name + Serial Number.
 * 2. Checks if each equipment has ANY inspection records in the selected month & year (using normalized date).
 * 3. If has inspection in selected month/year -> attaches ' ✓' to the name (and isCheckedInReport = true).
 * 4. If NO inspection in selected month/year -> displays clean name without '✓' (and isCheckedInReport = false).
 * 5. Does NOT add any extra columns or change document structure.
 */
export function buildEquipmentListForReport(
  masterEquipmentList: EquipmentItem[],
  records: InspectionRecord[],
  selectedMonth: string,
  selectedYear: string,
  type: EquipmentType
): EquipmentItem[] {
  const normMonth = normalizeMonth(selectedMonth);
  const normYear = normalizeYearBE(selectedYear);

  // 1. First ensure master list is deduplicated and cleaned
  const { deduplicated } = deduplicateEquipmentList(masterEquipmentList, type);

  // 2. Filter records for this equipment type, month, and year
  const relevantRecords = records.filter((r) => {
    if (r.equipmentType !== type) return false;
    const rMonth = normalizeMonth(r.month);
    const rYear = normalizeYearBE(r.year);
    const monthMatches = !normMonth || rMonth === normMonth;
    const yearMatches = !normYear || String(rYear) === String(normYear);
    return monthMatches && yearMatches;
  });

  // 3. Build a set of inspected equipment keys in this month/year
  const inspectedKeys = new Set<string>();
  const inspectedNames = new Set<string>();

  for (const rec of relevantRecords) {
    if (rec.equipmentItems && rec.equipmentItems.length > 0) {
      for (const eq of rec.equipmentItems) {
        const cleanName = normalizeEquipmentName(eq.name);
        const normSn = normalizeSerialNumber(eq.sn);
        inspectedKeys.add(getEquipmentIdentityKey(type, cleanName, normSn));
        inspectedNames.add(cleanName.toLowerCase());
      }
    } else {
      // If record is for the sheet without explicit equipmentItems per row,
      // all equipment in this sheet for this month are considered inspected if there are day records
      // Or check if rec has day > 0
    }
  }

  // 4. Map each equipment item to report display format
  return deduplicated.map((eq) => {
    const cleanName = normalizeEquipmentName(eq.name);
    const normSn = normalizeSerialNumber(eq.sn);
    const key = getEquipmentIdentityKey(type, cleanName, normSn);

    // Has inspection if key is in inspectedKeys or if name matches (or fallback if records exist)
    let isChecked = false;

    if (inspectedKeys.has(key) || inspectedNames.has(cleanName.toLowerCase())) {
      isChecked = true;
    } else if (relevantRecords.length > 0 && inspectedKeys.size === 0) {
      // If sheet records exist but didn't have equipmentItems attached per row,
      // check if this equipment is part of the records
      isChecked = true;
    }

    return {
      ...eq,
      name: isChecked ? `${cleanName} ✓` : cleanName,
      isCheckedInReport: isChecked,
    };
  });
}
