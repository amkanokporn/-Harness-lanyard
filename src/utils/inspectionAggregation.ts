import {
  EquipmentItem,
  EquipmentType,
  InspectionRecord,
  InspectionStatusValue,
  Inspector,
} from '../types';
import { normalizeMonth, normalizeYearBE, THAI_MONTHS } from '../constants/masterTemplates';
import {
  deduplicateEquipmentList,
  getEquipmentIdentityKey,
  normalizeEquipmentName,
  normalizeSerialNumber,
} from './equipmentUtils';
import { ensureInspectorSignatures, generateDigitalSignaturePng } from './signatureUtils';

export interface EquipmentInspectionEntry {
  day: number;
  dateKey: string;
  dateStr?: string;
  inspectorName: string;
  dayStatus: InspectionStatusValue;
  itemResults: { [itemId: number]: string };
}

export interface AggregatedEquipmentUsage {
  equipmentKey: string;
  equipment: EquipmentItem;
  equipmentType: EquipmentType;
  inspectionCount: number;
  inspectionDays: number[];
  inspectors: string[];
  inspections: EquipmentInspectionEntry[];
  hasInspectionInMonth: boolean;
}

export interface InspectorSignatureInfo {
  name: string;
  inspectorId?: string;
  position?: string;
  signatureDataUrl?: string;
  verticalSignatureDataUrl?: string;
  inspectionCount: number;
  inspectedDays: number[];
}

export interface SingleEquipmentMonthData {
  equipment: EquipmentItem;
  equipmentType: EquipmentType;
  isCheckedInMonth: boolean;
  dayResults: { [day: number]: { [itemId: number]: string } };
  dayInspectors: {
    [day: number]: {
      inspectorName: string;
      inspectorObj: Inspector | null;
      signatureDataUrl?: string;
      verticalSignatureDataUrl?: string;
      dayStatus?: InspectionStatusValue;
    };
  };
  inspectedDays: number[];
  inspectionCount: number;
  primaryInspector?: {
    name: string;
    inspectorObj: Inspector | null;
    signatureDataUrl?: string;
    inspectionDaysCount: number;
  } | null;
}

export interface EquipmentPairPageData {
  pairNumber: number; // Sequential page number in sorted order (1, 2, ...)
  setLabel?: string; // Original set identifier ("1", "2", "8_spare", "10", "Rescue")
  pairLabel: string; // "ชุดที่ 1 (Harness-1 / Lanyard-1)"
  harnessData: SingleEquipmentMonthData;
  lanyardData: SingleEquipmentMonthData;
  month: string;
  year: string;
  hasAnyInspection: boolean;
  totalInspectionDays?: number;
  totalInspectionCount?: number;
}

export interface MonthlyReportData {
  month: string;
  year: string;
  daysInMonth: number;
  daysArray: number[];
  equipmentType: EquipmentType;
  masterEquipmentList: EquipmentItem[];
  equipmentUsages: AggregatedEquipmentUsage[];
  // Day-level combined results for the monthly checklist table (1..31)
  dayResultsMap: { [day: number]: { [itemId: number]: string } };
  dayStatusMap: { [day: number]: InspectionStatusValue };
  inspectedDaysSet: Set<number>;
  // Inspectors active in this month
  activeInspectors: InspectorSignatureInfo[];
  totalInspectionsInMonth: number;
}

/**
 * Normalizes inspector name to ensure consistent matching:
 * - Trims leading and trailing whitespace
 * - Collapses multiple spaces into a single space
 * - Strips redundant title prefixes if needed, but keeps standard Thai names intact
 * - Unicode normalization
 */
export function normalizeInspectorName(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ');
}

const THAI_NAME_PREFIX_REGEX = /^(นาย|นางสาว|นาง|น\.ส\.|นส\.|ด\.ช\.|ด\.ญ\.|คุณ|ดร\.|อาจารย์|อ\.|ผศ\.|รศ\.|ศ\.|นพ\.|พญ\.|นายแพทย์|แพทย์หญิง|ส\.อ\.|ส\.ท\.|ส\.ต\.|จ\.ส\.อ\.|จ\.ส\.ท\.|จ\.ส\.ต\.|ร\.ต\.|ร\.ท\.|ร\.อ\.|พ\.ต\.|พ\.ท\.|พ\.อ\.|พ\.ต\.ต\.|พ\.ต\.ท\.|พ\.ต\.อ\.|ด\.ต\.|ส\.ต\.ต\.|ส\.ต\.ท\.|ส\.ต\.อ\.|ว่าที่\s*ร\.ต\.|ว่าที่ร้อยตรี|Mr\.|Mrs\.|Miss|Ms\.|Dr\.)\s*/i;

/**
 * Matches an inspector name from Excel against the system Inspector list
 * Accurately handles titles, full names, first names, and avoids false-positive substring matches.
 */
export function matchInspectorSignature(
  excelInspectorName: string,
  inspectorsList: Inspector[]
): Inspector | null {
  const normExcel = normalizeInspectorName(excelInspectorName);
  if (!normExcel) return null;

  // 1. Exact match after normalization
  const exact = inspectorsList.find(
    (i) => normalizeInspectorName(i.name).toLowerCase() === normExcel.toLowerCase()
  );
  if (exact) return ensureInspectorSignatures(exact);

  // 2. Normalize and strip prefixes
  let strippedExcel = normExcel.replace(THAI_NAME_PREFIX_REGEX, '').trim();
  while (THAI_NAME_PREFIX_REGEX.test(strippedExcel)) {
    strippedExcel = strippedExcel.replace(THAI_NAME_PREFIX_REGEX, '').trim();
  }

  const candidates = inspectorsList.map((insp) => {
    let strippedI = normalizeInspectorName(insp.name).replace(THAI_NAME_PREFIX_REGEX, '').trim();
    while (THAI_NAME_PREFIX_REGEX.test(strippedI)) {
      strippedI = strippedI.replace(THAI_NAME_PREFIX_REGEX, '').trim();
    }
    return {
      inspector: insp,
      normName: normalizeInspectorName(insp.name),
      strippedName: strippedI,
      firstToken: strippedI.split(/\s+/)[0] || '',
    };
  });

  // 3. Exact match on stripped full name (e.g. "ชญานนท์ เชื้อคำ" vs "ชญานนท์ เชื้อคำ")
  const strippedExact = candidates.find(
    (c) => c.strippedName.toLowerCase() === strippedExcel.toLowerCase()
  );
  if (strippedExact) return ensureInspectorSignatures(strippedExact.inspector);

  // 4. Exact match on first-name token (e.g. "ชญานนท์" matches "ชญานนท์ เชื้อคำ")
  const excelTokens = strippedExcel.split(/\s+/).filter(Boolean);
  const excelFirstToken = excelTokens[0] || '';

  if (excelFirstToken && excelFirstToken.length >= 3) {
    // 4a. Exact first name token match
    const tokenExact = candidates.find(
      (c) => c.firstToken.toLowerCase() === excelFirstToken.toLowerCase()
    );
    if (tokenExact) return ensureInspectorSignatures(tokenExact.inspector);

    // 4b. Prefix root match with at least 4 common characters and identical first character
    // e.g. "ชญานน" vs "ชญานนท์" (both start with "ชญา")
    const prefixMatch = candidates.find((c) => {
      if (c.firstToken.charAt(0) !== excelFirstToken.charAt(0)) return false;
      if (
        (c.firstToken.startsWith(excelFirstToken) || excelFirstToken.startsWith(c.firstToken)) &&
        excelFirstToken.slice(0, 3) === c.firstToken.slice(0, 3)
      ) {
        return true;
      }
      return false;
    });
    if (prefixMatch) return ensureInspectorSignatures(prefixMatch.inspector);
  }

  return null;
}

/**
 * Primary Data Aggregation Layer
 *
 * Takes raw InspectionRecord[] from Excel, filters by selected month & year,
 * deduplicates equipment items, aggregates inspection histories, counts inspections per equipment,
 * maps active inspectors with signatures, and produces pristine structures for PDF & Word.
 */
export function aggregateInspectionData(
  records: InspectionRecord[],
  masterHarnessList: EquipmentItem[],
  masterLanyardList: EquipmentItem[],
  selectedMonth: string,
  selectedYear: string,
  type: EquipmentType,
  registeredInspectors: Inspector[] = []
): MonthlyReportData {
  const normMonth = normalizeMonth(selectedMonth) || selectedMonth;
  const normYear = normalizeYearBE(selectedYear) || selectedYear;

  // Determine days in this specific month
  const monthIdx = THAI_MONTHS.indexOf(normMonth);
  let daysInMonth = 31;
  if (monthIdx !== -1) {
    const monthNumber = monthIdx + 1;
    const yearNum = parseInt(normYear, 10);
    const yearCE = yearNum > 2400 ? yearNum - 543 : yearNum || 2026;
    daysInMonth = new Date(yearCE, monthNumber, 0).getDate();
  }
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // 1. Filter records strictly for this equipmentType, month, and year
  const relevantRecords = records.filter((r) => {
    if (r.equipmentType !== type) return false;
    const rMonth = normalizeMonth(r.month);
    const rYear = normalizeYearBE(r.year);
    const monthMatches = !normMonth || rMonth === normMonth;
    const yearMatches = !normYear || String(rYear) === String(normYear);
    return monthMatches && yearMatches;
  });

  // 2. Base Master Equipment List (Deduplicated)
  const baseMaster = type === 'harness' ? masterHarnessList : masterLanyardList;
  const { deduplicated: deduplicatedMaster } = deduplicateEquipmentList(baseMaster, type);

  // 3. Aggregate inspections by Equipment Identity
  const usageMap = new Map<string, AggregatedEquipmentUsage>();

  // Initialize usage map with all master items
  for (const eq of deduplicatedMaster) {
    const cleanName = normalizeEquipmentName(eq.name);
    const normSn = normalizeSerialNumber(eq.sn);
    const key = getEquipmentIdentityKey(type, cleanName, normSn);

    usageMap.set(key, {
      equipmentKey: key,
      equipment: { ...eq, name: cleanName, sn: normSn },
      equipmentType: type,
      inspectionCount: 0,
      inspectionDays: [],
      inspectors: [],
      inspections: [],
      hasInspectionInMonth: false,
    });
  }

  // Combine day-level checklist results
  const dayResultsMap: { [day: number]: { [itemId: number]: string } } = {};
  const dayStatusMap: { [day: number]: InspectionStatusValue } = {};
  const inspectedDaysSet = new Set<number>();
  const inspectorStatsMap = new Map<string, { count: number; days: Set<number> }>();

  for (const rec of relevantRecords) {
    const day = Number(rec.day);
    if (day < 1 || day > daysInMonth) continue;

    inspectedDaysSet.add(day);

    // Inspector stats
    const inspectorName = normalizeInspectorName(rec.inspectorName);
    if (inspectorName) {
      if (!inspectorStatsMap.has(inspectorName)) {
        inspectorStatsMap.set(inspectorName, { count: 0, days: new Set() });
      }
      const st = inspectorStatsMap.get(inspectorName)!;
      st.count++;
      st.days.add(day);
    }

    // Day checklist results
    if (!dayResultsMap[day]) {
      dayResultsMap[day] = {};
    }
    for (const [itemIdStr, res] of Object.entries(rec.itemResults || {})) {
      const itemId = parseInt(itemIdStr, 10);
      if (!isNaN(itemId)) {
        // Higher severity overrides (■ > X > /)
        const currentRes = dayResultsMap[day][itemId];
        if (!currentRes || res === '■' || (res === 'X' && currentRes === '/')) {
          dayResultsMap[day][itemId] = res;
        }
      }
    }

    // Day status
    if (rec.dayStatus === 'abnormal_unusable') {
      dayStatusMap[day] = 'abnormal_unusable';
    } else if (rec.dayStatus === 'abnormal_usable' && dayStatusMap[day] !== 'abnormal_unusable') {
      dayStatusMap[day] = 'abnormal_usable';
    } else if (!dayStatusMap[day]) {
      dayStatusMap[day] = rec.dayStatus || 'normal';
    }

    // Map to specific equipment
    const recordEqItems = rec.equipmentItems && rec.equipmentItems.length > 0
      ? rec.equipmentItems
      : [];

    for (const eqItem of recordEqItems) {
      const cleanName = normalizeEquipmentName(eqItem.name);
      const normSn = normalizeSerialNumber(eqItem.sn);
      const eqKey = getEquipmentIdentityKey(type, cleanName, normSn);

      let usage = usageMap.get(eqKey);
      if (!usage) {
        usage = {
          equipmentKey: eqKey,
          equipment: {
            name: cleanName,
            sn: normSn,
            egatNo: eqItem.egatNo || '-',
            brandModel: eqItem.brandModel || '-',
            mfgDate: eqItem.mfgDate || '',
          },
          equipmentType: type,
          inspectionCount: 0,
          inspectionDays: [],
          inspectors: [],
          inspections: [],
          hasInspectionInMonth: false,
        };
        usageMap.set(eqKey, usage);
      }

      usage.hasInspectionInMonth = true;
      if (!usage.inspectionDays.includes(day)) {
        usage.inspectionDays.push(day);
        usage.inspectionCount++;
      }
      if (inspectorName && !usage.inspectors.includes(inspectorName)) {
        usage.inspectors.push(inspectorName);
      }

      usage.inspections.push({
        day,
        dateKey: rec.dateKey || `${rec.year}-${rec.month}-${day}`,
        dateStr: rec.dateStr,
        inspectorName,
        dayStatus: rec.dayStatus,
        itemResults: { ...(rec.itemResults || {}) },
      });
    }
  }

  // 4. Build Active Inspectors with Signatures
  const activeInspectors: InspectorSignatureInfo[] = [];
  for (const [inspName, stats] of inspectorStatsMap.entries()) {
    const matched = matchInspectorSignature(inspName, registeredInspectors);
    let sigDataUrl = matched?.signatureDataUrl;
    let vertSigDataUrl = matched?.verticalSignatureDataUrl;
    if (!sigDataUrl || !vertSigDataUrl) {
      const gen = generateDigitalSignaturePng(inspName || 'ผู้ตรวจสอบ');
      if (!sigDataUrl) sigDataUrl = gen.horizontal;
      if (!vertSigDataUrl) vertSigDataUrl = gen.vertical;
    }

    activeInspectors.push({
      name: inspName,
      inspectorId: matched?.id,
      position: matched?.position || 'ผู้ตรวจสอบความปลอดภัย',
      signatureDataUrl: sigDataUrl,
      verticalSignatureDataUrl: vertSigDataUrl,
      inspectionCount: stats.count,
      inspectedDays: Array.from(stats.days).sort((a, b) => a - b),
    });
  }

  // Sort inspectors by inspection count descending (most frequent inspector first)
  activeInspectors.sort((a, b) => b.inspectionCount - a.inspectionCount);

  // 5. Final Master Equipment List with accurate checkmarks and sorted by usage descending
  const allUsages = Array.from(usageMap.values());
  const formattedMasterEquipment = deduplicatedMaster.map((masterEq) => {
    const cleanName = normalizeEquipmentName(masterEq.name);
    const normSn = normalizeSerialNumber(masterEq.sn);
    const key = getEquipmentIdentityKey(type, cleanName, normSn);
    const usage = usageMap.get(key);

    const isChecked = Boolean(usage && usage.hasInspectionInMonth && usage.inspectionCount > 0);
    const daysCount = usage?.inspectionDays.length || 0;
    const inspectCount = usage?.inspectionCount || 0;

    return {
      ...masterEq,
      name: isChecked ? `${cleanName} ✓` : cleanName,
      isCheckedInReport: isChecked,
      _daysCount: daysCount,
      _inspectCount: inspectCount,
    };
  });

  // Sort by inspection usage descending: most inspected days first, then most total count
  formattedMasterEquipment.sort((a, b) => {
    const daysDiff = (b._daysCount || 0) - (a._daysCount || 0);
    if (daysDiff !== 0) return daysDiff;
    const countDiff = (b._inspectCount || 0) - (a._inspectCount || 0);
    if (countDiff !== 0) return countDiff;
    return 0;
  });

  // Diagnostic table output for verification
  if (relevantRecords.length > 0) {
    const debugRows = allUsages
      .filter((u) => u.hasInspectionInMonth)
      .map((u) => ({
        Equipment: u.equipment.name,
        'Serial Number': u.equipment.sn,
        'Inspection Count': u.inspectionCount,
        'Inspection Days': u.inspectionDays.sort((a, b) => a - b).join(', '),
        Inspectors: u.inspectors.join(', ') || '-',
      }));

    if (debugRows.length > 0) {
      console.log(`\n================== [Inspection Aggregation: ${type.toUpperCase()} - ${normMonth} ${normYear}] ==================`);
      console.table(debugRows);
      console.log(`Active Inspectors in month (${activeInspectors.length}):`, activeInspectors.map((i) => `${i.name} (${i.inspectionCount} ครั้ง)`).join(' | '));
      console.log('========================================================================================\n');
    }
  }

  return {
    month: normMonth,
    year: normYear,
    daysInMonth,
    daysArray,
    equipmentType: type,
    masterEquipmentList: formattedMasterEquipment,
    equipmentUsages: allUsages,
    dayResultsMap,
    dayStatusMap,
    inspectedDaysSet,
    activeInspectors,
    totalInspectionsInMonth: relevantRecords.length,
  };
}

/**
 * Builds inspection history and day-by-day signatures for a single specific equipment item
 */
export function buildSingleEquipmentData(
  equipment: EquipmentItem,
  type: EquipmentType,
  records: InspectionRecord[],
  selectedMonth: string,
  selectedYear: string,
  registeredInspectors: Inspector[] = []
): SingleEquipmentMonthData {
  const normMonth = normalizeMonth(selectedMonth) || selectedMonth;
  const normYear = normalizeYearBE(selectedYear) || selectedYear;

  const cleanTargetName = normalizeEquipmentName(equipment.name).toLowerCase();
  const normTargetSn = normalizeSerialNumber(equipment.sn).toLowerCase();
  const targetPairKey = getEquipmentPairKey(equipment).key;

  const dayResults: { [day: number]: { [itemId: number]: string } } = {};
  const dayInspectors: {
    [day: number]: {
      inspectorName: string;
      inspectorObj: Inspector | null;
      signatureDataUrl?: string;
      verticalSignatureDataUrl?: string;
      dayStatus?: InspectionStatusValue;
    };
  } = {};
  const inspectedDays: number[] = [];

  // Filter records matching this specific equipment in this month/year
  const relevantRecords = records.filter((r) => {
    if (r.equipmentType !== type) return false;
    const rMonth = normalizeMonth(r.month);
    const rYear = normalizeYearBE(r.year);
    if (normMonth && rMonth !== normMonth) return false;
    if (normYear && String(rYear) !== String(normYear)) return false;

    // Check if equipment items in record match this equipment
    const eqItems = r.equipmentItems || [];
    if (eqItems.length === 0) return true; // If generic row

    return eqItems.some((eq) => {
      const eqName = normalizeEquipmentName(eq.name).toLowerCase();
      const eqSn = normalizeSerialNumber(eq.sn).toLowerCase();

      // 1. Exact name match
      if (eqName && cleanTargetName && eqName === cleanTargetName) {
        return true;
      }
      // 2. Serial number match
      if (eqSn && normTargetSn && eqSn !== '-' && normTargetSn !== '-' && eqSn === normTargetSn) {
        return true;
      }
      // 3. Equipment Pair key match (e.g. "1" === "1", "10" === "10", "rescue" === "rescue")
      const itemPairKey = getEquipmentPairKey(eq).key;
      if (itemPairKey && targetPairKey && itemPairKey === targetPairKey) {
        return true;
      }
      return false;
    });
  });

  for (const rec of relevantRecords) {
    const day = Number(rec.day);
    if (isNaN(day) || day < 1 || day > 31) continue;

    if (!inspectedDays.includes(day)) {
      inspectedDays.push(day);
    }

    // Set day results
    if (!dayResults[day]) {
      dayResults[day] = {};
    }
    for (const [itemIdStr, res] of Object.entries(rec.itemResults || {})) {
      const itemId = parseInt(itemIdStr, 10);
      if (!isNaN(itemId)) {
        dayResults[day][itemId] = res;
      }
    }

    // Map inspector for this specific day
    const inspectorName = normalizeInspectorName(rec.inspectorName);
    const matchedInspector = matchInspectorSignature(inspectorName, registeredInspectors);
    const displayName = inspectorName || matchedInspector?.name || 'ผู้ตรวจสอบ';

    let sigDataUrl = matchedInspector?.signatureDataUrl;
    let vertSigDataUrl = matchedInspector?.verticalSignatureDataUrl || matchedInspector?.signatureDataUrl;

    // Guaranteed fallback: If signature does not exist, generate digital signature on the fly
    if (!sigDataUrl || !vertSigDataUrl) {
      const generated = generateDigitalSignaturePng(displayName);
      if (!sigDataUrl) sigDataUrl = generated.horizontal;
      if (!vertSigDataUrl) vertSigDataUrl = generated.vertical;
    }

    dayInspectors[day] = {
      inspectorName: displayName,
      inspectorObj: matchedInspector,
      signatureDataUrl: sigDataUrl,
      verticalSignatureDataUrl: vertSigDataUrl,
      dayStatus: rec.dayStatus,
    };
  }

  inspectedDays.sort((a, b) => a - b);
  const isCheckedInMonth = inspectedDays.length > 0;

  // Calculate inspector frequency for this specific equipment in this month
  const inspectorFrequencyMap = new Map<
    string,
    {
      count: number;
      inspectorObj: Inspector | null;
      signatureDataUrl?: string;
      name: string;
    }
  >();

  for (const day of inspectedDays) {
    const insp = dayInspectors[day];
    if (insp && insp.inspectorName) {
      const key = insp.inspectorName;
      if (!inspectorFrequencyMap.has(key)) {
        inspectorFrequencyMap.set(key, {
          count: 0,
          inspectorObj: insp.inspectorObj,
          signatureDataUrl: insp.signatureDataUrl,
          name: insp.inspectorName,
        });
      }
      inspectorFrequencyMap.get(key)!.count++;
    }
  }

  let primaryInspector: SingleEquipmentMonthData['primaryInspector'] = null;
  if (inspectorFrequencyMap.size > 0) {
    const sortedInspectors = Array.from(inspectorFrequencyMap.values()).sort(
      (a, b) => b.count - a.count
    );
    const top = sortedInspectors[0];
    let topSig = top.signatureDataUrl;
    if (!topSig) {
      const gen = generateDigitalSignaturePng(top.name);
      topSig = gen.horizontal;
    }
    primaryInspector = {
      name: top.name,
      inspectorObj: top.inspectorObj,
      signatureDataUrl: topSig,
      inspectionDaysCount: top.count,
    };
  } else if (registeredInspectors.length > 0) {
    const defaultInsp = registeredInspectors[0];
    let sig = defaultInsp.signatureDataUrl;
    if (!sig) {
      const gen = generateDigitalSignaturePng(defaultInsp.name);
      sig = gen.horizontal;
    }
    primaryInspector = {
      name: defaultInsp.name,
      inspectorObj: defaultInsp,
      signatureDataUrl: sig,
      inspectionDaysCount: 0,
    };
  }

  return {
    equipment: {
      ...equipment,
      name: normalizeEquipmentName(equipment.name),
      sn: normalizeSerialNumber(equipment.sn),
      isCheckedInReport: isCheckedInMonth,
    },
    equipmentType: type,
    isCheckedInMonth,
    dayResults,
    dayInspectors,
    inspectedDays,
    inspectionCount: inspectedDays.length,
    primaryInspector,
  };
}

/**
 * Extracts all unique inspector names from real inspection records and combines with existing signatures
 */
export function extractUniqueInspectorsFromRecords(
  records: InspectionRecord[],
  existingInspectors: Inspector[] = []
): Inspector[] {
  const inspectorMap = new Map<string, Inspector>();

  // Index existing inspectors by normalized name and ensure valid signatures
  for (const insp of existingInspectors) {
    const key = normalizeInspectorName(insp.name).toLowerCase();
    if (key) {
      inspectorMap.set(key, ensureInspectorSignatures(insp));
    }
  }

  // Extract from records
  for (const rec of records) {
    const rawName = rec.inspectorName;
    const cleanName = normalizeInspectorName(rawName);
    if (!cleanName) continue;

    const key = cleanName.toLowerCase();
    if (!inspectorMap.has(key)) {
      // Find partial or title match
      const matched = matchInspectorSignature(cleanName, existingInspectors);
      if (matched) {
        inspectorMap.set(key, ensureInspectorSignatures({
          ...matched,
          name: cleanName,
        }));
      } else {
        const sigs = generateDigitalSignaturePng(cleanName);
        inspectorMap.set(key, ensureInspectorSignatures({
          id: `insp-auto-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: cleanName,
          position: 'ผู้ตรวจสอบความปลอดภัย',
          department: 'แผนก หมผ - ธ. กอง กคว - ธ.',
          signatureDataUrl: sigs.horizontal,
          verticalSignatureDataUrl: sigs.vertical,
        }));
      }
    }
  }

  return Array.from(inspectorMap.values())
    .map(ensureInspectorSignatures)
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

/**
 * Extracts numeric or token identifier from equipment name
 * e.g. "Harness-4" -> "4", "4_Karam..." -> "4", "8_สำรอง 1_" -> "8_spare", "Rescue" -> "rescue"
 */
function getEquipmentPairKey(item: EquipmentItem): { key: string; sortOrder: number; displayLabel: string } {
  const name = (item.name || '').toLowerCase();
  const raw = ((item as any).raw || item.brandModel || '').toLowerCase();
  const combined = `${name} ${raw}`;

  if (combined.includes('rescue') || combined.includes('petzl') || combined.startsWith('r_')) {
    return { key: 'rescue', sortOrder: 900, displayLabel: 'Rescue' };
  }

  const numMatch = name.match(/(\d+)/) || raw.match(/^(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (combined.includes('สำรอง')) {
      return { key: `${num}_spare`, sortOrder: num * 10 + 5, displayLabel: `${num} (สำรอง)` };
    }
    return { key: `${num}`, sortOrder: num * 10, displayLabel: `${num}` };
  }

  return { key: normalizeEquipmentName(item.name), sortOrder: 999, displayLabel: item.name };
}

/**
 * Builds paired equipment reports (Page 1: Harness-1 & Lanyard-1, Page 2: Harness-2 & Lanyard-2, etc.)
 * Dynamically expands to encompass ALL equipment numbers and records present in the real data!
 */
export function buildEquipmentPairReports(
  records: InspectionRecord[],
  masterHarnessList: EquipmentItem[],
  masterLanyardList: EquipmentItem[],
  selectedMonth: string,
  selectedYear: string,
  registeredInspectors: Inspector[] = []
): EquipmentPairPageData[] {
  const normMonth = normalizeMonth(selectedMonth) || selectedMonth;
  const normYear = normalizeYearBE(selectedYear) || selectedYear;

  // 1. Gather all Harness items from master list + records
  const allHarnessRaw: EquipmentItem[] = [...masterHarnessList];
  for (const rec of records) {
    if (rec.equipmentType === 'harness' && rec.equipmentItems) {
      allHarnessRaw.push(...rec.equipmentItems);
    }
  }
  const { deduplicated: harnesses } = deduplicateEquipmentList(allHarnessRaw, 'harness');

  // 2. Gather all Lanyard items from master list + records
  const allLanyardRaw: EquipmentItem[] = [...masterLanyardList];
  for (const rec of records) {
    if (rec.equipmentType === 'lanyard' && rec.equipmentItems) {
      allLanyardRaw.push(...rec.equipmentItems);
    }
  }
  const { deduplicated: lanyards } = deduplicateEquipmentList(allLanyardRaw, 'lanyard');

  // 3. Group by equipment pair key (e.g. "1", "2", "3", "4", "5", "8_spare", "10", "12", "rescue", ...)
  interface PairGroup {
    key: string;
    sortOrder: number;
    displayLabel: string;
    harness?: EquipmentItem;
    lanyard?: EquipmentItem;
  }
  const pairGroups = new Map<string, PairGroup>();

  // Map harnesses
  for (const h of harnesses) {
    const { key, sortOrder, displayLabel } = getEquipmentPairKey(h);
    if (!pairGroups.has(key)) {
      pairGroups.set(key, { key, sortOrder, displayLabel, harness: h });
    } else {
      pairGroups.get(key)!.harness = h;
    }
  }

  // Map lanyards
  for (const l of lanyards) {
    const { key, sortOrder, displayLabel } = getEquipmentPairKey(l);
    if (!pairGroups.has(key)) {
      pairGroups.set(key, { key, sortOrder, displayLabel, lanyard: l });
    } else {
      pairGroups.get(key)!.lanyard = l;
    }
  }

  // Ensure standard sets 1..10 exist if list is empty
  if (pairGroups.size === 0) {
    for (let i = 1; i <= 10; i++) {
      pairGroups.set(`${i}`, {
        key: `${i}`,
        sortOrder: i * 10,
        displayLabel: `${i}`,
      });
    }
  }

  // 4. Build single equipment data for each pair
  const rawPairs: (EquipmentPairPageData & { sortOrder: number })[] = [];

  for (const group of pairGroups.values()) {
    const label = group.displayLabel;

    const harnessEq: EquipmentItem = group.harness || {
      name: `Harness-${label}`,
      sn: '-',
      egatNo: '-',
      brandModel: '-',
    };

    const lanyardEq: EquipmentItem = group.lanyard || {
      name: `Lanyard-${label}`,
      sn: '-',
      egatNo: '-',
      brandModel: '-',
    };

    const harnessData = buildSingleEquipmentData(
      harnessEq,
      'harness',
      records,
      normMonth,
      normYear,
      registeredInspectors
    );

    const lanyardData = buildSingleEquipmentData(
      lanyardEq,
      'lanyard',
      records,
      normMonth,
      normYear,
      registeredInspectors
    );

    const hasAnyInspection = harnessData.isCheckedInMonth || lanyardData.isCheckedInMonth;
    const uniqueInspectedDays = new Set([
      ...harnessData.inspectedDays,
      ...lanyardData.inspectedDays,
    ]).size;
    const totalInspectionCount = harnessData.inspectionCount + lanyardData.inspectionCount;

    rawPairs.push({
      pairNumber: 0, // Assigned sequentially after sorting
      setLabel: label,
      pairLabel: `ชุดที่ ${label} (${harnessEq.name} / ${lanyardEq.name})`,
      harnessData,
      lanyardData,
      month: normMonth,
      year: normYear,
      hasAnyInspection,
      totalInspectionDays: uniqueInspectedDays,
      totalInspectionCount,
      sortOrder: group.sortOrder,
    });
  }

  // 5. Sort pair groups:
  // - Primary: totalInspectionDays DESC (most inspected days first)
  // - Secondary: totalInspectionCount DESC (most total check count first)
  // - Tertiary: sortOrder ASC (natural sequential order: 1, 2, 3... 10, 11, 12, Rescue)
  rawPairs.sort((a, b) => {
    const daysDiff = (b.totalInspectionDays || 0) - (a.totalInspectionDays || 0);
    if (daysDiff !== 0) return daysDiff;

    const countDiff = (b.totalInspectionCount || 0) - (a.totalInspectionCount || 0);
    if (countDiff !== 0) return countDiff;

    return a.sortOrder - b.sortOrder;
  });

  // 6. Assign final sequential pair numbers (1, 2, 3...)
  const pairs: EquipmentPairPageData[] = rawPairs.map((p, idx) => ({
    ...p,
    pairNumber: idx + 1,
  }));

  return pairs;
}


