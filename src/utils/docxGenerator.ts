import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  ImageRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  VerticalAlign,
  PageOrientation,
  TableLayoutType,
} from 'docx';
import { saveAs } from 'file-saver';
import { EquipmentItem, EquipmentType, InspectionRecord, Inspector } from '../types';
import {
  FORM_METADATA,
  HARNESS_CHECKLIST_ITEMS,
  LANYARD_CHECKLIST_ITEMS,
} from '../constants/masterTemplates';
import {
  aggregateInspectionData,
  buildEquipmentPairReports,
  EquipmentPairPageData,
  MonthlyReportData,
  SingleEquipmentMonthData,
} from './inspectionAggregation';
import { dataUrlToUint8Array, generateDigitalSignaturePng } from './signatureUtils';

export interface GenerateDocxOptions {
  equipmentType?: 'all' | EquipmentType;
  month: string;
  year: string;
  harnessEquipment: EquipmentItem[];
  lanyardEquipment: EquipmentItem[];
  records: InspectionRecord[];
  inspector: Inspector | null;
  inspectors?: Inspector[];
  fileName?: string;
  harnessReportData?: MonthlyReportData;
  lanyardReportData?: MonthlyReportData;
  pairReports?: EquipmentPairPageData[];
  selectedPairIndex?: number; // 0-based or undefined for all
  layoutMode?: 'pair' | 'matrix';
}

const BORDER_SINGLE_BLACK = {
  style: BorderStyle.SINGLE,
  size: 4, // 0.5pt
  color: '000000',
};

const CELL_BORDERS_ALL = {
  top: BORDER_SINGLE_BLACK,
  bottom: BORDER_SINGLE_BLACK,
  left: BORDER_SINGLE_BLACK,
  right: BORDER_SINGLE_BLACK,
};

const CELL_MARGIN_COMPACT = {
  top: 25,
  bottom: 25,
  left: 40,
  right: 40,
};

/**
 * Creates a Word section for a single equipment type (Harness or Lanyard)
 * Designed to fit precisely on a single A4 Landscape page (15600 dxa printable width).
 */
function createEquipmentDocxSection(
  type: EquipmentType,
  month: string,
  year: string,
  equipmentList: EquipmentItem[],
  records: InspectionRecord[],
  inspectors: Inspector[] = [],
  precomputedReportData?: MonthlyReportData
) {
  const isHarness = type === 'harness';
  const checklistItems = isHarness ? HARNESS_CHECKLIST_ITEMS : LANYARD_CHECKLIST_ITEMS;

  const aggregated = precomputedReportData || aggregateInspectionData(
    records,
    equipmentList,
    equipmentList,
    month,
    year,
    type,
    inspectors
  );

  const {
    masterEquipmentList,
    dayResultsMap,
    inspectedDaysSet,
    activeInspectors,
  } = aggregated;

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const targetRowCount = isHarness ? 12 : 10;
  const displayEquipment: EquipmentItem[] = [...masterEquipmentList];
  while (displayEquipment.length < targetRowCount) {
    displayEquipment.push({ name: '', sn: '', egatNo: '', brandModel: '' });
  }

  // 1. Header Title
  const titlePara = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 20, line: 200 },
    children: [
      new TextRun({
        text: FORM_METADATA.title,
        font: 'TH Sarabun New',
        size: 32, // 16pt bold title
        bold: true,
        color: '000000',
      }),
    ],
  });

  // 2. Subheader metadata (เรียน, แผนก, กอง, ฝ่าย)
  const subheaderPara = new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 20, line: 200 },
    children: [
      new TextRun({ text: 'เรียน  หมผ – ธ.            ', font: 'TH Sarabun New', size: 27 }),
      new TextRun({ text: 'แผนก  หมผ - ธ.            ', font: 'TH Sarabun New', size: 27 }),
      new TextRun({ text: 'กอง  กคว - ธ.            ', font: 'TH Sarabun New', size: 27 }),
      new TextRun({ text: 'ฝ่าย  อคม. รวธ.', font: 'TH Sarabun New', size: 27 }),
    ],
  });

  // 3. Top Equipment Table (Total width: 15600 dxa)
  const topTableRows: TableRow[] = displayEquipment.map((eq) => {
    return new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 3700, type: WidthType.DXA },
          borders: CELL_BORDERS_ALL,
          margins: CELL_MARGIN_COMPACT,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0, line: 180 },
              children: [
                new TextRun({ text: 'ชื่อเครื่องมืออุปกรณ์: ', font: 'TH Sarabun New', size: 27 }),
                new TextRun({ text: eq.name || '-', font: 'TH Sarabun New', size: 27, bold: !!eq.name }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 3300, type: WidthType.DXA },
          borders: CELL_BORDERS_ALL,
          margins: CELL_MARGIN_COMPACT,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0, line: 180 },
              children: [
                new TextRun({ text: 'รหัสประจำตัวอุปกรณ์: ', font: 'TH Sarabun New', size: 27 }),
                new TextRun({ text: eq.sn || '-', font: 'TH Sarabun New', size: 27 }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 3500, type: WidthType.DXA },
          borders: CELL_BORDERS_ALL,
          margins: CELL_MARGIN_COMPACT,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0, line: 180 },
              children: [
                new TextRun({ text: 'ทะเบียน กฟผ.: ', font: 'TH Sarabun New', size: 27 }),
                new TextRun({ text: eq.egatNo || '-', font: 'TH Sarabun New', size: 27 }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 5100, type: WidthType.DXA },
          borders: CELL_BORDERS_ALL,
          margins: CELL_MARGIN_COMPACT,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0, line: 180 },
              children: [
                new TextRun({ text: 'ยี่ห้อ/รุ่น: ', font: 'TH Sarabun New', size: 27 }),
                new TextRun({ text: eq.brandModel || '-', font: 'TH Sarabun New', size: 27 }),
              ],
            }),
          ],
        }),
      ],
    });
  });

  const topEquipmentTable = new Table({
    width: { size: 15600, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [3700, 3300, 3500, 5100],
    rows: topTableRows,
  });

  // 4. Checklist Table (with 31 Days Columns)
  // Total table width: 15600 dxa
  const colWSeq = 550;
  const colWText = 4350;
  const colWDay = 300; // 300 dxa * 31 = 9300 dxa
  const colWNote = 1400;
  // 550 + 4350 + 9300 + 1400 = 15600 dxa

  // Header Row 1
  const checklistHeaderRow1 = new TableRow({
    cantSplit: true,
    tableHeader: true,
    children: [
      new TableCell({
        width: { size: colWSeq, type: WidthType.DXA },
        borders: CELL_BORDERS_ALL,
        margins: CELL_MARGIN_COMPACT,
        verticalAlign: VerticalAlign.CENTER,
        rowSpan: 2,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0, line: 180 },
            children: [new TextRun({ text: 'ลำดับ\nที่', font: 'TH Sarabun New', size: 27, bold: true })],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWText, type: WidthType.DXA },
        borders: CELL_BORDERS_ALL,
        margins: CELL_MARGIN_COMPACT,
        verticalAlign: VerticalAlign.CENTER,
        rowSpan: 2,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0, line: 180 },
            children: [new TextRun({ text: 'รายการตรวจสอบ', font: 'TH Sarabun New', size: 27, bold: true })],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWDay * 31, type: WidthType.DXA },
        borders: CELL_BORDERS_ALL,
        margins: CELL_MARGIN_COMPACT,
        columnSpan: 31,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0, line: 180 },
            children: [
              new TextRun({
                text: `เดือน ${month || '............'} พ.ศ. ${year || '........'}`,
                font: 'TH Sarabun New',
                size: 27,
                bold: true,
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWNote, type: WidthType.DXA },
        borders: CELL_BORDERS_ALL,
        margins: CELL_MARGIN_COMPACT,
        verticalAlign: VerticalAlign.CENTER,
        rowSpan: 2,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0, line: 180 },
            children: [new TextRun({ text: 'หมายเหตุ', font: 'TH Sarabun New', size: 27, bold: true })],
          }),
        ],
      }),
    ],
  });

  // Header Row 2: Days 1 to 31
  const checklistHeaderRow2 = new TableRow({
    cantSplit: true,
    tableHeader: true,
    children: days.map((d) => {
      return new TableCell({
        width: { size: colWDay, type: WidthType.DXA },
        borders: CELL_BORDERS_ALL,
        margins: { top: 8, bottom: 8, left: 4, right: 4 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0, line: 160 },
            children: [new TextRun({ text: String(d), font: 'TH Sarabun New', size: 22, bold: true })],
          }),
        ],
      });
    }),
  });

  // Checklist Items Rows
  const checklistItemRows: TableRow[] = checklistItems.map((item) => {
    return new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: colWSeq, type: WidthType.DXA },
          borders: CELL_BORDERS_ALL,
          margins: CELL_MARGIN_COMPACT,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0, line: 180 },
              children: [new TextRun({ text: String(item.id), font: 'TH Sarabun New', size: 27, bold: true })],
            }),
          ],
        }),
        new TableCell({
          width: { size: colWText, type: WidthType.DXA },
          borders: CELL_BORDERS_ALL,
          margins: CELL_MARGIN_COMPACT,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0, line: 180 },
              children: [new TextRun({ text: item.text, font: 'TH Sarabun New', size: 27 })],
            }),
          ],
        }),
        ...days.map((d) => {
          const res = dayResultsMap[d]?.[item.id];
          const hasDayData = inspectedDaysSet.has(d);
          const symbol = hasDayData ? (res || '/') : '';
          return new TableCell({
            width: { size: colWDay, type: WidthType.DXA },
            borders: CELL_BORDERS_ALL,
            margins: { top: 8, bottom: 8, left: 4, right: 4 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 160 },
                children: [new TextRun({ text: symbol, font: 'TH Sarabun New', size: 24, bold: true })],
              }),
            ],
          });
        }),
        new TableCell({
          width: { size: colWNote, type: WidthType.DXA },
          borders: CELL_BORDERS_ALL,
          margins: CELL_MARGIN_COMPACT,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
        }),
      ],
    });
  });

  // Bottom Legend & Signatures Row
  const inspectorNamesStr = activeInspectors.map((i) => i.name).join(', ');

  const legendRow = new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: colWSeq + colWText, type: WidthType.DXA },
        columnSpan: 2,
        borders: CELL_BORDERS_ALL,
        margins: CELL_MARGIN_COMPACT,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            spacing: { before: 0, after: 0, line: 180 },
            children: [
              new TextRun({
                text: '[✓] สภาพปกติ   [✕] สภาพผิดปกติ ยังใช้ได้   [■] สภาพผิดปกติ ต้องแก้ไขห้ามใช้\n',
                font: 'TH Sarabun New',
                size: 24,
              }),
              new TextRun({
                text: 'ลงชื่อ ผู้ตรวจสอบ (รายละเอียดตามแนบ)',
                font: 'TH Sarabun New',
                size: 27,
                bold: true,
              }),
            ],
          }),
        ],
      }),
      ...days.map((d) => {
        const isInspected = inspectedDaysSet.has(d);
        let cellChildren: Paragraph[] = [];
        if (isInspected) {
          const insp = activeInspectors[0];
          let sigDataUrl = insp?.verticalSignatureDataUrl || insp?.signatureDataUrl;
          if (!sigDataUrl) {
            const gen = generateDigitalSignaturePng(insp?.name || 'ผู้ตรวจสอบ');
            sigDataUrl = gen.vertical;
          }
          const sigBytes = sigDataUrl ? dataUrlToUint8Array(sigDataUrl) : null;
          if (sigBytes) {
            cellChildren = [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 100 },
                children: [
                  new ImageRun({
                    data: sigBytes,
                    transformation: {
                      width: 28,
                      height: 48,
                    },
                    type: 'png',
                  }),
                ],
              }),
            ];
          } else {
            cellChildren = [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 160 },
                children: [new TextRun({ text: '✓', font: 'TH Sarabun New', size: 24, bold: true })],
              }),
            ];
          }
        }

        return new TableCell({
          width: { size: colWDay, type: WidthType.DXA },
          borders: CELL_BORDERS_ALL,
          margins: { top: 2, bottom: 2, left: 1, right: 1 },
          verticalAlign: VerticalAlign.CENTER,
          children: cellChildren,
        });
      }),
      new TableCell({
        width: { size: colWNote, type: WidthType.DXA },
        borders: CELL_BORDERS_ALL,
        margins: { top: 2, bottom: 2, left: 4, right: 4 },
        verticalAlign: VerticalAlign.CENTER,
        children: (() => {
          const topInsp = activeInspectors[0];
          let topSigUrl = topInsp?.signatureDataUrl;
          if (!topSigUrl || !topSigUrl.startsWith('data:image/')) {
            topSigUrl = generateDigitalSignaturePng(topInsp?.name || 'ผู้รายงาน').horizontal;
          }
          const topSigBytes = topSigUrl ? dataUrlToUint8Array(topSigUrl) : null;
          const paragraphs: Paragraph[] = [];

          if (topSigBytes) {
            paragraphs.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 80 },
                children: [
                  new ImageRun({
                    data: topSigBytes,
                    transformation: {
                      width: 96,
                      height: 32,
                    },
                    type: 'png',
                  }),
                ],
              })
            );
          }

          paragraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0, line: 140 },
              children: [
                new TextRun({ text: 'ผู้รายงาน', font: 'TH Sarabun New', size: 27, bold: true }),
              ],
            })
          );

          return paragraphs;
        })(),
      }),
    ],
  });

  const mainChecklistTable = new Table({
    width: { size: 15600, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [colWSeq, colWText, ...days.map(() => colWDay), colWNote],
    rows: [checklistHeaderRow1, checklistHeaderRow2, ...checklistItemRows, legendRow],
  });

  // 5. Footer: Copy Note & Revision Box
  const copyNotePara = new Paragraph({
    spacing: { before: 10, after: 10, line: 180 },
    children: [new TextRun({ text: FORM_METADATA.copyNote, font: 'TH Sarabun New', size: 27 })],
  });

  const footerTable = new Table({
    width: { size: 15600, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [5200, 5200, 5200],
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 5200, type: WidthType.DXA },
            borders: CELL_BORDERS_ALL,
            margins: CELL_MARGIN_COMPACT,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 180 },
                children: [new TextRun({ text: FORM_METADATA.subdivision, font: 'TH Sarabun New', size: 27 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 5200, type: WidthType.DXA },
            borders: CELL_BORDERS_ALL,
            margins: CELL_MARGIN_COMPACT,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 180 },
                children: [new TextRun({ text: FORM_METADATA.docNumber, font: 'TH Sarabun New', size: 27, bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 5200, type: WidthType.DXA },
            borders: CELL_BORDERS_ALL,
            margins: CELL_MARGIN_COMPACT,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 180 },
                children: [new TextRun({ text: FORM_METADATA.revision, font: 'TH Sarabun New', size: 27 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return [
    titlePara,
    subheaderPara,
    topEquipmentTable,
    new Paragraph({ spacing: { before: 20, after: 20 }, children: [] }),
    mainChecklistTable,
    copyNotePara,
    footerTable,
  ];
}

/**
 * Creates DOCX elements for a single equipment item (Header box + 31-day checklist table with per-day signatures)
 */
function createSingleEquipmentDocxElements(
  data: SingleEquipmentMonthData,
  month: string,
  year: string
) {
  const isHarness = data.equipmentType === 'harness';
  const checklistItems = isHarness ? HARNESS_CHECKLIST_ITEMS : LANYARD_CHECKLIST_ITEMS;
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const eq = data.equipment;
  const cleanName = (eq.name || '').replace(/[✓√✔]/g, '').trim();
  const isChecked = data.isCheckedInMonth || eq.isCheckedInReport;

  // Single-row equipment box
  const infoTable = new Table({
    width: { size: 15600, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [3900, 3150, 3300, 5250],
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 3900, type: WidthType.DXA },
            borders: CELL_BORDERS_ALL,
            margins: { top: 15, bottom: 15, left: 30, right: 30 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0, line: 180 },
                children: [
                  new TextRun({ text: 'ชื่อเครื่องมืออุปกรณ์: ', font: 'TH Sarabun New', size: 27 }),
                  new TextRun({
                    text: `${cleanName}${isChecked ? ' ✓' : ''}`,
                    font: 'TH Sarabun New',
                    size: 27,
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 3150, type: WidthType.DXA },
            borders: CELL_BORDERS_ALL,
            margins: { top: 15, bottom: 15, left: 30, right: 30 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0, line: 180 },
                children: [
                  new TextRun({ text: 'รหัสประจำตัวอุปกรณ์: ', font: 'TH Sarabun New', size: 27 }),
                  new TextRun({ text: eq.sn || '-', font: 'TH Sarabun New', size: 27 }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 3300, type: WidthType.DXA },
            borders: CELL_BORDERS_ALL,
            margins: { top: 15, bottom: 15, left: 30, right: 30 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0, line: 180 },
                children: [
                  new TextRun({ text: 'ทะเบียน กฟผ.: ', font: 'TH Sarabun New', size: 27 }),
                  new TextRun({ text: eq.egatNo || '-', font: 'TH Sarabun New', size: 27 }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 5250, type: WidthType.DXA },
            borders: CELL_BORDERS_ALL,
            margins: { top: 15, bottom: 15, left: 30, right: 30 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0, line: 180 },
                children: [
                  new TextRun({ text: 'ยี่ห้อ/รุ่น: ', font: 'TH Sarabun New', size: 27 }),
                  new TextRun({ text: eq.brandModel || '-', font: 'TH Sarabun New', size: 27 }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const colWSeq = 540;
  const colWText = 4125;
  const colWDay = 315;
  const colWNote = 1170;

  // Header row 1
  const headerRow1 = new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: colWSeq, type: WidthType.DXA },
        rowSpan: 2,
        borders: CELL_BORDERS_ALL,
        margins: { top: 10, bottom: 10, left: 10, right: 10 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0, line: 180 },
            children: [
              new TextRun({ text: 'ลำดับ\nที่', font: 'TH Sarabun New', size: 27, bold: true }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWText, type: WidthType.DXA },
        rowSpan: 2,
        borders: CELL_BORDERS_ALL,
        margins: { top: 10, bottom: 10, left: 20, right: 20 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0, line: 180 },
            children: [
              new TextRun({ text: 'รายการตรวจสอบ', font: 'TH Sarabun New', size: 27, bold: true }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWDay * 31, type: WidthType.DXA },
        columnSpan: 31,
        borders: CELL_BORDERS_ALL,
        margins: { top: 10, bottom: 10, left: 10, right: 10 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0, line: 180 },
            children: [
              new TextRun({
                text: `เดือน ${month || '............'} พ.ศ. ${year || '........'}`,
                font: 'TH Sarabun New',
                size: 27,
                bold: true,
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWNote, type: WidthType.DXA },
        rowSpan: 2,
        borders: CELL_BORDERS_ALL,
        margins: { top: 10, bottom: 10, left: 10, right: 10 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0, line: 180 },
            children: [
              new TextRun({ text: 'หมายเหตุ', font: 'TH Sarabun New', size: 27, bold: true }),
            ],
          }),
        ],
      }),
    ],
  });

  // Header row 2: Days 1 to 31
  const headerRow2 = new TableRow({
    cantSplit: true,
    children: days.map(
      (d) =>
        new TableCell({
          width: { size: colWDay, type: WidthType.DXA },
          borders: CELL_BORDERS_ALL,
          margins: { top: 6, bottom: 6, left: 3, right: 3 },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0, line: 160 },
              children: [
                new TextRun({ text: `${d}`, font: 'TH Sarabun New', size: 22, bold: true }),
              ],
            }),
          ],
        })
    ),
  });

  // Item rows
  const itemRows = checklistItems.map((item) => {
    return new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: colWSeq, type: WidthType.DXA },
          borders: CELL_BORDERS_ALL,
          margins: { top: 6, bottom: 6, left: 10, right: 10 },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0, line: 180 },
              children: [new TextRun({ text: `${item.id}`, font: 'TH Sarabun New', size: 27, bold: true })],
            }),
          ],
        }),
        new TableCell({
          width: { size: colWText, type: WidthType.DXA },
          borders: CELL_BORDERS_ALL,
          margins: { top: 6, bottom: 6, left: 20, right: 20 },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { before: 0, after: 0, line: 180 },
              children: [
                new TextRun({
                  text: item.text,
                  font: 'TH Sarabun New',
                  size: 27,
                }),
              ],
            }),
          ],
        }),
        ...days.map((d) => {
          const res = data.dayResults[d]?.[item.id];
          const isInspected = data.inspectedDays.includes(d);
          const symbol = isInspected ? (res || '/') : '';

          return new TableCell({
            width: { size: colWDay, type: WidthType.DXA },
            borders: CELL_BORDERS_ALL,
            margins: { top: 6, bottom: 6, left: 3, right: 3 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 160 },
                children: symbol
                  ? [new TextRun({ text: symbol === '✓' ? '✓' : symbol, font: 'TH Sarabun New', size: 24, bold: true })]
                  : [],
              }),
            ],
          });
        }),
        new TableCell({
          width: { size: colWNote, type: WidthType.DXA },
          borders: CELL_BORDERS_ALL,
          margins: { top: 6, bottom: 6, left: 10, right: 10 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [] })],
        }),
      ],
    });
  });

  // Bottom row: Legend + ลงชื่อ ผู้ตรวจสอบ (Per-day signatures)
  const bottomRow = new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: colWSeq + colWText, type: WidthType.DXA },
        columnSpan: 2,
        borders: CELL_BORDERS_ALL,
        margins: { top: 6, bottom: 6, left: 20, right: 20 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 0, after: 0, line: 180 },
            children: [
              new TextRun({ text: '[✓] ปกติ  [✕] ผิดปกติ ใช้ได้  [■] ห้ามใช้   ', font: 'TH Sarabun New', size: 24 }),
              new TextRun({ text: 'ลงชื่อ ผู้ตรวจสอบ (รายละเอียดตามแนบ)', font: 'TH Sarabun New', size: 27, bold: true }),
            ],
          }),
        ],
      }),
      ...days.map((d) => {
        const isInspected = data.inspectedDays.includes(d);
        const dayInsp = data.dayInspectors[d];
        let sigDataUrl = dayInsp?.verticalSignatureDataUrl || dayInsp?.signatureDataUrl;
        if (isInspected && !sigDataUrl) {
          const gen = generateDigitalSignaturePng(dayInsp?.inspectorName || 'ผู้ตรวจสอบ');
          sigDataUrl = gen.vertical;
        }
        const sigBytes = sigDataUrl ? dataUrlToUint8Array(sigDataUrl) : null;

        let cellChildren: Paragraph[] = [];
        if (isInspected) {
          if (sigBytes) {
            cellChildren = [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 100 },
                children: [
                  new ImageRun({
                    data: sigBytes,
                    transformation: {
                      width: 28,
                      height: 48,
                    },
                    type: 'png',
                  }),
                ],
              }),
            ];
          } else {
            cellChildren = [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 160 },
                children: [
                  new TextRun({
                    text: '✓',
                    font: 'TH Sarabun New',
                    size: 24,
                    bold: true,
                  }),
                ],
              }),
            ];
          }
        }

        return new TableCell({
          width: { size: colWDay, type: WidthType.DXA },
          borders: CELL_BORDERS_ALL,
          margins: { top: 2, bottom: 2, left: 1, right: 1 },
          verticalAlign: VerticalAlign.CENTER,
          children: cellChildren,
        });
      }),
      new TableCell({
        width: { size: colWNote, type: WidthType.DXA },
        borders: CELL_BORDERS_ALL,
        margins: { top: 2, bottom: 2, left: 4, right: 4 },
        verticalAlign: VerticalAlign.CENTER,
        children: (() => {
          let reporterSigUrl = data.primaryInspector?.signatureDataUrl;
          if (!reporterSigUrl || !reporterSigUrl.startsWith('data:image/')) {
            reporterSigUrl = generateDigitalSignaturePng(data.primaryInspector?.name || 'ผู้รายงาน').horizontal;
          }
          const reporterSigBytes = reporterSigUrl ? dataUrlToUint8Array(reporterSigUrl) : null;
          const paragraphs: Paragraph[] = [];

          if (reporterSigBytes) {
            paragraphs.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 80 },
                children: [
                  new ImageRun({
                    data: reporterSigBytes,
                    transformation: {
                      width: 92,
                      height: 30,
                    },
                    type: 'png',
                  }),
                ],
              })
            );
          }

          paragraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0, line: 140 },
              children: [
                new TextRun({ text: 'ผู้รายงาน', font: 'TH Sarabun New', size: 27, bold: true }),
              ],
            })
          );

          return paragraphs;
        })(),
      }),
    ],
  });

  const checklistTable = new Table({
    width: { size: 15600, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [colWSeq, colWText, ...days.map(() => colWDay), colWNote],
    rows: [headerRow1, headerRow2, ...itemRows, bottomRow],
  });

  return [
    infoTable,
    new Paragraph({ spacing: { before: 10, after: 10 }, children: [] }),
    checklistTable,
  ];
}

/**
 * Creates a complete A4 Landscape Word page for an individual Equipment Pair (Harness-N & Lanyard-N)
 */
function createEquipmentPairDocxPage(pairData: EquipmentPairPageData) {
  const titlePara = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 15, line: 180 },
    children: [
      new TextRun({
        text: FORM_METADATA.title,
        font: 'TH Sarabun New',
        size: 30, // 15pt title
        bold: true,
        color: '000000',
      }),
    ],
  });

  const subheaderPara = new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 15, line: 180 },
    children: [
      new TextRun({
        text: 'เรียน  หมผ – ธ.    แผนก  หมผ - ธ.    กอง  กคว - ธ.    ฝ่าย  อคม.  รวธ.',
        font: 'TH Sarabun New',
        size: 27,
        bold: true,
        color: '000000',
      }),
    ],
  });

  const harnessElements = createSingleEquipmentDocxElements(
    pairData.harnessData,
    pairData.month,
    pairData.year
  );

  const lanyardElements = createSingleEquipmentDocxElements(
    pairData.lanyardData,
    pairData.month,
    pairData.year
  );

  const copyNotePara = new Paragraph({
    spacing: { before: 8, after: 8, line: 160 },
    children: [new TextRun({ text: FORM_METADATA.copyNote, font: 'TH Sarabun New', size: 27 })],
  });

  const footerTable = new Table({
    width: { size: 15600, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [5200, 5200, 5200],
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 5200, type: WidthType.DXA },
            borders: CELL_BORDERS_ALL,
            margins: CELL_MARGIN_COMPACT,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 180 },
                children: [new TextRun({ text: FORM_METADATA.subdivision, font: 'TH Sarabun New', size: 27 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 5200, type: WidthType.DXA },
            borders: CELL_BORDERS_ALL,
            margins: CELL_MARGIN_COMPACT,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 180 },
                children: [new TextRun({ text: FORM_METADATA.docNumber, font: 'TH Sarabun New', size: 27, bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 5200, type: WidthType.DXA },
            borders: CELL_BORDERS_ALL,
            margins: CELL_MARGIN_COMPACT,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 180 },
                children: [new TextRun({ text: FORM_METADATA.revision, font: 'TH Sarabun New', size: 27 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return [
    titlePara,
    subheaderPara,
    ...harnessElements,
    new Paragraph({ spacing: { before: 15, after: 15 }, children: [] }),
    ...lanyardElements,
    copyNotePara,
    footerTable,
  ];
}

/**
 * Generates and downloads a .docx file matching Master Template
 */
export async function generateDocxReport({
  equipmentType = 'all',
  month,
  year,
  harnessEquipment,
  lanyardEquipment,
  records,
  inspector,
  inspectors = [],
  fileName = 'รายงานตรวจสอบเครื่องมืออุปกรณ์ก่อนการใช้งาน.docx',
  harnessReportData,
  lanyardReportData,
  pairReports,
  selectedPairIndex,
  layoutMode = 'pair',
}: GenerateDocxOptions) {
  const sections = [];
  const allInspectors = inspectors.length > 0 ? inspectors : (inspector ? [inspector] : []);

  // A4 Landscape configuration for docx:
  const pageLandscapeSettings = {
    page: {
      size: {
        orientation: PageOrientation.LANDSCAPE,
        width: 11906, // Portrait width in dxa -> flipped to 16838 dxa in landscape
        height: 16838, // Portrait height in dxa -> flipped to 11906 dxa in landscape
      },
      margin: {
        top: 350, // ~6mm
        bottom: 350, // ~6mm
        left: 567, // 10mm
        right: 567, // 10mm
      },
    },
  };

  if (layoutMode === 'pair') {
    const pairs = pairReports || buildEquipmentPairReports(
      records,
      harnessEquipment,
      lanyardEquipment,
      month,
      year,
      allInspectors
    );

    // If a specific pair index is requested, export that pair; otherwise export all active pairs
    const targetPairs = selectedPairIndex !== undefined && selectedPairIndex >= 0 && selectedPairIndex < pairs.length
      ? [pairs[selectedPairIndex]]
      : pairs.filter((p) => p.hasAnyInspection).length > 0
        ? pairs.filter((p) => p.hasAnyInspection)
        : pairs.slice(0, 1);

    for (const pair of targetPairs) {
      const pageChildren = createEquipmentPairDocxPage(pair);
      sections.push({
        properties: pageLandscapeSettings,
        children: pageChildren,
      });
    }
  } else {
    // Matrix mode
    if (equipmentType === 'all' || equipmentType === 'harness') {
      const harnessChildren = createEquipmentDocxSection(
        'harness',
        month,
        year,
        harnessEquipment,
        records,
        allInspectors,
        harnessReportData
      );
      sections.push({
        properties: pageLandscapeSettings,
        children: harnessChildren,
      });
    }

    if (equipmentType === 'all' || equipmentType === 'lanyard') {
      const lanyardChildren = createEquipmentDocxSection(
        'lanyard',
        month,
        year,
        lanyardEquipment,
        records,
        allInspectors,
        lanyardReportData
      );
      sections.push({
        properties: pageLandscapeSettings,
        children: lanyardChildren,
      });
    }
  }

  const doc = new Document({
    sections,
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
  return blob;
}

