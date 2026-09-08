import { EquipmentItem, InspectionRecord, Inspector, ParsedExcelResult } from '../types';
import { generateDigitalSignaturePng } from './signatureUtils';

function createInspectorItem(
  id: string,
  name: string,
  position: string,
  department: string,
  seed: string
): Inspector {
  const sigs = generateDigitalSignaturePng(name, seed);
  return {
    id,
    name,
    position,
    department,
    signatureDataUrl: sigs.horizontal,
    verticalSignatureDataUrl: sigs.vertical,
  };
}

export const DEFAULT_INSPECTORS: Inspector[] = [
  createInspectorItem('insp-1', 'นายสมศักดิ์ วิริยะกิจ', 'วิศวกรระดับ 6 / ผู้ตรวจสอบความปลอดภัย', 'แผนก หมผ - ธ. กอง กคว - ธ. โรงไฟฟ้าจะนะ', 'seed1'),
  createInspectorItem('insp-2', 'นายนพพร เวชเตง', 'ช่างชำนาญการ / ผู้ตรวจสอบ', 'โรงไฟฟ้าจะนะ', 'seed2'),
  createInspectorItem('insp-3', 'ส.อ.กรกฎ แลบัว', 'ช่างชำนาญการ / ผู้ตรวจสอบ', 'โรงไฟฟ้าจะนะ', 'seed3'),
  createInspectorItem('insp-4', 'นายภานุพงศ์ ยามะสกั', 'พนักงานตรวจสอบอุปกรณ์', 'โรงไฟฟ้าจะนะ', 'seed4'),
  createInspectorItem('insp-5', 'นายชญานนท์ เชื้อคำ', 'พนักงานตรวจสอบอุปกรณ์', 'โรงไฟฟ้าจะนะ', 'seed5'),
  createInspectorItem('insp-6', 'นายนันทวัฒน์ พลเมฆ', 'พนักงานตรวจสอบอุปกรณ์', 'โรงไฟฟ้าจะนะ', 'seed6'),
  createInspectorItem('insp-7', 'นายสุรินทร์ สารอนินทร์', 'พนักงานตรวจสอบอุปกรณ์', 'โรงไฟฟ้าจะนะ', 'seed7'),
  createInspectorItem('insp-8', 'นายทรงศักดิ์ หุ้นศรี', 'พนักงานตรวจสอบอุปกรณ์', 'โรงไฟฟ้าจะนะ', 'seed8'),
  createInspectorItem('insp-9', 'นายอานนท์ ภวรัญพงษ์', 'พนักงานตรวจสอบอุปกรณ์', 'โรงไฟฟ้าจะนะ', 'seed9'),
  createInspectorItem('insp-10', 'นายกิตติคุณ ลิ่วศิริวงศ์เจริญ', 'พนักงานตรวจสอบอุปกรณ์', 'โรงไฟฟ้าจะนะ', 'seed10'),
];

export const SAMPLE_HARNESS_EQUIPMENT: EquipmentItem[] = [
  { id: '1', name: 'Harness-1', sn: '06815309', egatNo: '-', brandModel: 'Karam PN 23', isCheckedInReport: true },
  { id: '2', name: 'Harness-2', sn: '06815306', egatNo: '-', brandModel: 'Karam PN 23', isCheckedInReport: true },
  { id: '3', name: 'Harness-3', sn: '06815305', egatNo: '-', brandModel: 'Karam PN 23', isCheckedInReport: true },
  { id: '4', name: 'Harness-4', sn: '06815304', egatNo: '-', brandModel: 'Karam PN 23', isCheckedInReport: true },
  { id: '5', name: 'Harness-5', sn: '06815303', egatNo: '-', brandModel: 'Karam PN 23', isCheckedInReport: true },
  { id: '6', name: 'Harness-6', sn: '06815302', egatNo: '-', brandModel: 'Karam PN 23', isCheckedInReport: true },
  { id: '7', name: 'Harness-7', sn: '06815301', egatNo: '-', brandModel: 'Karam PN 23', isCheckedInReport: true },
  { id: '8', name: 'Harness-8', sn: '06815300', egatNo: '-', brandModel: 'Karam PN 23', isCheckedInReport: true },
  { id: '9', name: 'Harness-สำรอง 1', sn: '06815310', egatNo: '-', brandModel: 'Karam PN 23', isCheckedInReport: true },
  { id: '10', name: 'Harness-สำรอง 2', sn: '06815311', egatNo: '-', brandModel: 'Karam PN 23', isCheckedInReport: true },
  { id: '11', name: 'Harness-Rescue', sn: '06815312', egatNo: '-', brandModel: 'Karam PN 23', isCheckedInReport: true },
];

export const SAMPLE_LANYARD_EQUIPMENT: EquipmentItem[] = [
  { id: '1', name: 'Lanyard-1', sn: '06815309', egatNo: '-', brandModel: 'Karam PN 300', isCheckedInReport: true },
  { id: '2', name: 'Lanyard-2', sn: '06815306', egatNo: '-', brandModel: 'Karam PN 300', isCheckedInReport: true },
  { id: '3', name: 'Lanyard-3', sn: '06815305', egatNo: '-', brandModel: 'Karam PN 300', isCheckedInReport: true },
  { id: '4', name: 'Lanyard-4', sn: '06815304', egatNo: '-', brandModel: 'Karam PN 300', isCheckedInReport: true },
  { id: '5', name: 'Lanyard-5', sn: '06815303', egatNo: '-', brandModel: 'Karam PN 300', isCheckedInReport: true },
  { id: '6', name: 'Lanyard-6', sn: '06815302', egatNo: '-', brandModel: 'Karam PN 300', isCheckedInReport: true },
  { id: '7', name: 'Lanyard-7', sn: '06815301', egatNo: '-', brandModel: 'Karam PN 300', isCheckedInReport: true },
  { id: '8', name: 'Lanyard-8', sn: '06815300', egatNo: '-', brandModel: 'Karam PN 300', isCheckedInReport: true },
  { id: '9', name: 'Lanyard-สำรอง 1', sn: '06815310', egatNo: '-', brandModel: 'Karam PN 300', isCheckedInReport: true },
  { id: '10', name: 'Lanyard-สำรอง 2', sn: '06815311', egatNo: '-', brandModel: 'Karam PN 300', isCheckedInReport: true },
  { id: '11', name: 'Lanyard-Rescue', sn: '06815312', egatNo: '-', brandModel: 'Karam PN 300', isCheckedInReport: true },
];

export function getSampleParsedData(): ParsedExcelResult {
  // Days inspected matching user's exact file: 4, 5, 6, 9, 10 March 2026 (พ.ศ. 2569)
  const daysData = [
    { day: 4, inspector: 'นายนพพร เวชเตง', status: 'normal' as const },
    { day: 5, inspector: 'นายสุรินทร์ สารอนินทร์', status: 'normal' as const },
    { day: 6, inspector: 'นายอานนท์ ภวรัญพงษ์', status: 'normal' as const },
    { day: 9, inspector: 'นายกิตติคุณ ลิ่วศิริวงศ์เจริญ', status: 'abnormal_unusable' as const },
    { day: 10, inspector: 'นายภานุพงศ์ ยามะสกั', status: 'abnormal_unusable' as const },
  ];

  const records: InspectionRecord[] = [];

  // Harness records
  for (const item of daysData) {
    records.push({
      plant: 'โรงไฟฟ้าจะนะ',
      equipmentType: 'harness',
      month: 'มีนาคม',
      year: '2569',
      day: item.day,
      dateStr: `${item.day} มีนาคม 2569`,
      inspectorName: item.inspector,
      equipmentItems: SAMPLE_HARNESS_EQUIPMENT,
      itemResults: {
        1: item.status === 'abnormal_unusable' ? '■' : '/',
        2: '/',
        3: '/',
        4: '/',
      },
      dayStatus: item.status,
      rawRowNumber: item.day + 1,
    });
  }

  // Lanyard records
  for (const item of daysData) {
    records.push({
      plant: 'โรงไฟฟ้าจะนะ',
      equipmentType: 'lanyard',
      month: 'มีนาคม',
      year: '2569',
      day: item.day,
      dateStr: `${item.day} มีนาคม 2569`,
      inspectorName: item.inspector,
      equipmentItems: SAMPLE_LANYARD_EQUIPMENT,
      itemResults: {
        1: item.status === 'abnormal_unusable' ? '■' : '/',
        2: '/',
        3: '/',
        4: '/',
        5: '/',
        6: '/',
      },
      dayStatus: item.status,
      rawRowNumber: item.day + 20,
    });
  }

  return {
    records,
    harnessEquipmentList: SAMPLE_HARNESS_EQUIPMENT,
    lanyardEquipmentList: SAMPLE_LANYARD_EQUIPMENT,
    availablePlants: ['โรงไฟฟ้าจะนะ'],
    availableMonths: ['มีนาคม'],
    availableYears: ['2569'],
    availableEquipmentTypes: ['harness', 'lanyard'],
    issues: [],
    totalRowsParsed: 45,
    fileName: 'ข้อมูลการตรวจสอบอุปกรณ์_โรงไฟฟ้าจะนะ_มีนาคม_2569.xlsx',
  };
}
