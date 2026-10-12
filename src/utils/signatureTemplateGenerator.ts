import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Inspector } from '../types';
import { cleanInspectorFullName } from './signatureUtils';

/**
 * Generates and downloads a beautifully formatted Excel template
 * for inspector signatures: "แบบฟอร์มรายชื่อและแม่แบบลายเซ็นผู้ตรวจสอบ.xlsx"
 */
export function generateSignatureExcelTemplate(
  inspectors: Inspector[],
  fileName: string = 'แบบฟอร์มรายชื่อและแม่แบบลายเซ็นผู้ตรวจสอบ.xlsx'
) {
  const wb = XLSX.utils.book_new();

  // 1. Data rows for Sheet 1: แบบฟอร์มรายชื่อและลายเซ็น
  const headerRow = [
    'ลำดับ (No.)',
    'ชื่อ-นามสกุลผู้ตรวจสอบ (Inspector Name)',
    'รหัสพนักงาน (ID)',
    'ตำแหน่ง (Position)',
    'สังกัด / หน่วยงาน (Department)',
    'สถานะลายเซ็นในระบบปัจจุบัน (Status)',
    'ชื่อไฟล์รูปภาพลายเซ็นแนะนำ (Suggested File Name)',
    'หมายเหตุการใช้งาน (Notes)',
  ];

  const dataRows = (inspectors && inspectors.length > 0 ? inspectors : [
    {
      id: 'insp-1',
      name: 'นายชญานนท์ เชื้อคำ',
      position: 'พนักงานตรวจสอบอุปกรณ์',
      department: 'โรงไฟฟ้าจะนะ',
    },
    {
      id: 'insp-2',
      name: 'นายนพพร เวชเตง',
      position: 'ช่างชำนาญการ / ผู้ตรวจสอบ',
      department: 'โรงไฟฟ้าจะนะ',
    },
    {
      id: 'insp-3',
      name: 'ส.อ.กรกฎ แลบัว',
      position: 'ช่างชำนาญการ / ผู้ตรวจสอบ',
      department: 'โรงไฟฟ้าจะนะ',
    },
    {
      id: 'insp-4',
      name: 'นายสมศักดิ์ วิริยะกิจ',
      position: 'วิศวกรระดับ 6 / ผู้ตรวจสอบความปลอดภัย',
      department: 'แผนก หมผ - ธ. กอง กคว - ธ. โรงไฟฟ้าจะนะ',
    },
  ]).map((insp, index) => {
    const clean = cleanInspectorFullName(insp.name);
    const hasRealSig = Boolean(insp.isCustomSignature);
    const suggestedFileName = `${insp.name.replace(/\s+/g, '_')}.png`;

    return [
      index + 1,
      insp.name,
      insp.id || `EMP-${String(index + 1).padStart(4, '0')}`,
      insp.position || 'พนักงานตรวจสอบอุปกรณ์',
      insp.department || 'โรงไฟฟ้าจะนะ',
      hasRealSig ? '✓ มีลายเซ็นจริงในระบบแล้ว' : 'ใช้ลายเซ็นดิจิทัลคอมพิวเตอร์',
      suggestedFileName,
      hasRealSig
        ? 'บันทึกลายเซ็นจริงถาวรแล้ว (สามารถอัปโหลดไฟล์ใหม่ทับได้)'
        : 'เตรียมไฟล์ภาพลายเซ็นชื่อนี้มาอัปโหลดในระบบ',
    ];
  });

  const wsData = [
    ['กฟผ. - ระบบออกรายงานการตรวจสอบเครื่องมืออุปกรณ์ความปลอดภัย (FM-004)'],
    ['แบบฟอร์มลงทะเบียนรายชื่อและแม่แบบไฟล์ลายเซ็นผู้ตรวจสอบ'],
    ['วันที่สร้างไฟล์:', new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })],
    [], // empty line
    headerRow,
    ...dataRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths for readable viewing in Microsoft Excel
  ws['!cols'] = [
    { wch: 12 }, // ลำดับ
    { wch: 30 }, // ชื่อ-นามสกุล
    { wch: 18 }, // รหัสพนักงาน
    { wch: 32 }, // ตำแหน่ง
    { wch: 28 }, // สังกัด
    { wch: 26 }, // สถานะ
    { wch: 32 }, // ชื่อไฟล์แนะนำ
    { wch: 45 }, // หมายเหตุ
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'รายชื่อผู้ตรวจและลายเซ็น');

  // 2. Instructions Sheet: คำแนะนำการใช้งาน
  const instructionsData = [
    ['คำแนะนำขั้นตอนการเตรียมและอัปโหลดลายเซ็นจริงเข้าสู่ระบบ กฟผ.'],
    [],
    ['ขั้นตอนที่ 1: การเตรียมไฟล์ภาพลายเซ็นจริง'],
    ['1.1', 'ให้ผู้ตรวจสอบเซ็นชื่อลงบนกระดาษขาวธรรมดา ด้วยปากกาลูกลื่นหรือปากกาหมึกซึมสีน้ำเงินหรือดำ'],
    ['1.2', 'ถ่ายภาพหรือสแกนลายเซ็นให้ชัดเจน บันทึกเป็นไฟล์ .png หรือ .jpg หรือ .jpeg'],
    ['1.3', 'ระบบมีโปรแกรมตรวจจับและลบพื้นหลังกระดาษสีขาวให้เป็น .PNG โปร่งใสอัตโนมัติ ไม่จำเป็นต้องตัดพื้นหลังเอง'],
    [],
    ['ขั้นตอนที่ 2: การตั้งชื่อไฟล์รูปภาพให้ระบบผูกชื่ออัตโนมัติ'],
    ['2.1', 'ตั้งชื่อไฟล์ภาพลายเซ็นให้ตรงกับชื่อผู้ตรวจ เช่น "นายชญานนท์ เชื้อคำ.png" หรือ "ชญานนท์.png"'],
    ['2.2', 'หรือสามารถตั้งตามรหัสพนักงาน เช่น "insp-1.png" ก็ได้'],
    [],
    ['ขั้นตอนที่ 3: การนำไฟล์เข้าสู่ระบบ'],
    ['3.1', 'เปิดหน้าเว็บระบบรายงาน แล้วกดปุ่ม "จัดการลายเซ็น" หรือ "อัปโหลดลายเซ็นจริง"'],
    ['3.2', 'สามารถลากไฟล์รูปภาพลายเซ็นหลายๆ คนเข้ามาปล่อยพร้อมกันได้ทันที (Batch Upload)'],
    ['3.3', 'ระบบจะทำการจับคู่รูปภาพกับชื่อผู้ตรวจ หมุนภาพ 90 องศาสำหรับแนวตั้ง และบันทึกลงฐานข้อมูลให้อัตโนมัติ'],
    [],
    ['ขั้นตอนที่ 4: ความคงอยู่ของลายเซ็น (ความปลอดภัย)'],
    ['4.1', 'ลายเซ็นจริงที่อัปโหลดจะถูกเก็บรักษาไว้อย่างถาวร ไม่สูญหายเมื่อเปิดเว็บเข้ามาใหม่ หรืออัปโหลดไฟล์ Excel ตรวจสอบชุดใหม่'],
    ['4.2', 'ลายเซ็นจะคงอยู่ตลอดไปจนกว่าผู้ใช้จะทำการอัปโหลดไฟล์ใหม่มาทับลงไป'],
    ['4.3', 'ผู้ใช้สามารถกดปุ่ม "สำรองข้อมูลลายเซ็น (Backup)" เพื่อเก็บไฟล์สำรองไว้ในเครื่องได้ตลอดเวลา'],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions['!cols'] = [{ wch: 14 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'คำแนะนำการใช้งาน');

  // Generate Excel ArrayBuffer and trigger save
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });
  saveAs(blob, fileName);
}

/**
 * Parses an uploaded Excel template back to extract inspector names and data
 */
export function parseSignatureExcelTemplate(buffer: ArrayBuffer): Partial<Inspector>[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];

  const ws = wb.Sheets[firstSheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const result: Partial<Inspector>[] = [];
  let headerRowIndex = -1;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r] || [];
    const rowStr = row.join(' ').toLowerCase();
    if (rowStr.includes('ชื่อ') && (rowStr.includes('ผู้ตรวจ') || rowStr.includes('inspector'))) {
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex === -1) headerRowIndex = 4; // fallback

  const headers = (rows[headerRowIndex] || []).map((h) => String(h || '').trim());
  let colName = headers.findIndex((h) => /ชื่อ/i.test(h));
  let colId = headers.findIndex((h) => /รหัส|id/i.test(h));
  let colPos = headers.findIndex((h) => /ตำแหน่ง|position/i.test(h));
  let colDept = headers.findIndex((h) => /สังกัด|หน่วยงาน|department/i.test(h));

  if (colName === -1) colName = 1;
  if (colId === -1) colId = 2;
  if (colPos === -1) colPos = 3;
  if (colDept === -1) colDept = 4;

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawName = String(row[colName] || '').trim();
    if (!rawName || rawName.includes('ลำดับ') || rawName.includes('ชื่อ-สกุล')) continue;

    const rawId = colId !== -1 ? String(row[colId] || '').trim() : '';
    const rawPos = colPos !== -1 ? String(row[colPos] || '').trim() : '';
    const rawDept = colDept !== -1 ? String(row[colDept] || '').trim() : '';

    result.push({
      name: rawName,
      id: rawId || undefined,
      position: rawPos || undefined,
      department: rawDept || undefined,
    });
  }

  return result;
}
