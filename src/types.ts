export type EquipmentType = 'harness' | 'lanyard';

export interface EquipmentItem {
  id?: string;
  name: string; // e.g. "Harness-1 √"
  sn: string; // e.g. "s/n 0061"
  egatNo: string; // e.g. "-" or "1000-111400258714-00"
  brandModel: string; // e.g. "Karam รุ่น PN 23"
  mfgDate?: string; // e.g. "01/2024"
  isCheckedInReport?: boolean; // if checkmark √ is attached to name
}

export type InspectionStatusValue = 'normal' | 'abnormal_usable' | 'abnormal_unusable' | null;

export interface DailyChecklistResult {
  [day: number]: string | null; // e.g. "/" or empty
}

export interface ChecklistItemDef {
  id: number;
  text: string;
}

export interface InspectionRecord {
  plant: string; // โรงไฟฟ้า
  equipmentType: EquipmentType; // harness / lanyard
  month: string; // e.g. "ตุลาคม", "มีนาคม"
  year: number | string; // e.g. 2568, 2569 or 2025, 2026
  day: number; // 1 - 31 (Pure calendar day)
  dateKey?: string; // e.g. "2025-10-19" (YYYY-MM-DD in CE)
  dateStr?: string; // e.g. "19 ตุลาคม 2568"
  inspectionDate?: {
    year: number; // 2025 (CE)
    month: number; // 10 (1-12)
    day: number; // 19 (1-31)
    yearBE: number; // 2568 (BE)
  };
  rawInspectionDate?: any;
  inspectorName?: string;
  equipmentItems: EquipmentItem[];
  // Mapping item index (1..4 or 1..6) to result
  itemResults: { [itemId: number]: string };
  dayStatus: InspectionStatusValue;
  notes?: string;
  rawRowNumber?: number;
}

export interface Inspector {
  id: string;
  name: string;
  position?: string;
  signatureDataUrl?: string; // Base64 PNG (horizontal)
  verticalSignatureDataUrl?: string; // Base64 PNG (rotated 90 degrees up for checklist columns)
  department?: string;
}

export interface FilterState {
  plant: string;
  month: string;
  year: string;
  equipmentType: 'all' | 'harness' | 'lanyard';
  selectedInspectorId: string;
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  row?: number;
  field?: string;
}

export interface ParsedExcelResult {
  records: InspectionRecord[];
  harnessEquipmentList: EquipmentItem[];
  lanyardEquipmentList: EquipmentItem[];
  availablePlants: string[];
  availableMonths: string[];
  availableYears: string[];
  availableEquipmentTypes: EquipmentType[];
  issues: ValidationIssue[];
  totalRowsParsed: number;
  fileName: string;
}

export interface FormMetadata {
  docNumber: string; // "FM-004/QP-PB-013"
  revision: string; // "แก้ไขครั้งที่ 02"
  title: string; // "แบบตรวจสอบเครื่องมืออุปกรณ์ก่อนการใช้งาน"
  subheader: string; // "เรียน หมผ – ธ.  แผนก หมผ - ธ.  กอง กคว - ธ.  ฝ่าย อคม. รวธ."
  subdivision: string; // "รองผู้ว่าการธุรกิจเกี่ยวเนื่อง"
  copyNote: string; // "ต้นฉบับ : เก็บที่หน่วยงาน"
}
