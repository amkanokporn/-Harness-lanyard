import React from 'react';
import { EquipmentItem, EquipmentType, InspectionRecord, Inspector } from '../types';
import {
  FORM_METADATA,
  HARNESS_CHECKLIST_ITEMS,
  LANYARD_CHECKLIST_ITEMS,
  normalizeMonth,
} from '../constants/masterTemplates';
import {
  aggregateInspectionData,
  MonthlyReportData,
  normalizeInspectorName,
} from '../utils/inspectionAggregation';
import { ensureInspectorSignatures, generateDigitalSignaturePng } from '../utils/signatureUtils';

interface PdfReportTemplateProps {
  equipmentType: EquipmentType;
  plant?: string;
  month: string;
  year: string;
  equipmentList: EquipmentItem[];
  records: InspectionRecord[];
  inspector: Inspector | null;
  inspectors?: Inspector[];
  idPrefix?: string;
  reportData?: MonthlyReportData;
}

/**
 * 100% Canvas & PDF-safe Vector Checkmark component
 * Eliminates all unicode font-fallback and clipping bugs in html2canvas
 */
const CheckmarkSvg: React.FC<{ size?: number; className?: string }> = ({ size = 12, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block shrink-0 ${className}`}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <polyline
      points="2 6.2 4.8 9.2 10 2.8"
      stroke="#000000"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 100% Canvas & PDF-safe Vector Cross component
 */
const CrossSvg: React.FC<{ size?: number; className?: string }> = ({ size = 11, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block shrink-0 ${className}`}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <line x1="2.5" y1="2.5" x2="9.5" y2="9.5" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="9.5" y1="2.5" x2="2.5" y2="9.5" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const PdfReportTemplate: React.FC<PdfReportTemplateProps> = ({
  equipmentType,
  month,
  year,
  equipmentList,
  records,
  inspector,
  inspectors = [],
  idPrefix = 'report-page',
  reportData,
}) => {
  const isHarness = equipmentType === 'harness';
  const checklistItems = isHarness ? HARNESS_CHECKLIST_ITEMS : LANYARD_CHECKLIST_ITEMS;

  // Build or use provided aggregated data
  const registeredInspectors = inspectors.length > 0
    ? inspectors
    : (inspector ? [inspector] : []);

  const aggregated = reportData || aggregateInspectionData(
    records,
    equipmentList,
    equipmentList,
    month,
    year,
    equipmentType,
    registeredInspectors
  );

  const {
    masterEquipmentList,
    dayResultsMap,
    inspectedDaysSet,
    activeInspectors,
  } = aggregated;

  const normMonth = normalizeMonth(month) || month;

  // Days array 1 to 31 (always fixed 31 columns for exact tabular alignment with standard template)
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // Pad equipment list to exact target row count (12 for harness, 10 for lanyard)
  const targetRowCount = isHarness ? 12 : 10;
  const displayEquipment: EquipmentItem[] = [...masterEquipmentList];
  while (displayEquipment.length < targetRowCount) {
    displayEquipment.push({
      name: '',
      sn: '',
      egatNo: '',
      brandModel: '',
    });
  }

  // Active inspectors for signature area (fallback to selected inspector if none from data)
  const effectiveInspectors = activeInspectors.length > 0
    ? activeInspectors
    : (inspector ? [{
        name: inspector.name,
        inspectorId: inspector.id,
        position: inspector.position || 'ผู้ตรวจสอบ',
        signatureDataUrl: inspector.signatureDataUrl,
        inspectionCount: records.length,
        inspectedDays: [],
      }] : []);

  const pageId = `${idPrefix}-${equipmentType}`;

  return (
    <div
      id={pageId}
      className="bg-white text-black select-none shadow-md print:shadow-none mx-auto"
      style={{
        width: '1122px',
        height: '793px',
        minHeight: '793px',
        maxHeight: '793px',
        padding: '16px 22px 12px 22px',
        boxSizing: 'border-box',
        fontFamily: "'TH Sarabun New', 'THSarabunNew', 'TH Sarabun PSK', 'Sarabun', Tahoma, sans-serif",
        color: '#000000',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        lineHeight: 1.25,
      }}
    >
      {/* 1. Header Title */}
      <div className="text-center mb-1">
        <h1 className="text-[20px] font-bold tracking-tight text-black leading-snug">
          {FORM_METADATA.title}
        </h1>
      </div>

      {/* 2. Subheader Metadata */}
      <div className="flex items-center justify-start text-[18px] font-bold text-black px-1 mb-2 gap-9 leading-normal">
        <span>เรียน&nbsp;&nbsp;หมผ – ธ.</span>
        <span>แผนก&nbsp;&nbsp;หมผ - ธ.</span>
        <span>กอง&nbsp;&nbsp;กคว - ธ.</span>
        <span>ฝ่าย&nbsp;&nbsp;อคม.&nbsp;&nbsp;รวธ.</span>
      </div>

      {/* 3. Top Equipment Table Box (12 Rows for Harness / 10 Rows for Lanyard) */}
      <div
        className="border border-black mb-1.5 p-1 text-black bg-white"
        style={{ width: '1078px', boxSizing: 'border-box' }}
      >
        <table
          className="border-collapse text-[10.5px] leading-normal"
          style={{ width: '100%', tableLayout: 'fixed', overflow: 'visible' }}
        >
          <colgroup>
            <col style={{ width: '260px' }} />
            <col style={{ width: '220px' }} />
            <col style={{ width: '230px' }} />
            <col style={{ width: '330px' }} />
          </colgroup>
          <tbody>
            {displayEquipment.map((eq, idx) => {
              const hasData = !!eq.name;
              // Clean name without unicode checkmarks for clean rendering
              const cleanName = (eq.name || '').replace(/[✓√✔]/g, '').trim();
              const isChecked = eq.isCheckedInReport || (eq.name && eq.name.includes('✓'));

              return (
                <tr
                  key={idx}
                  style={{ height: isHarness ? '18px' : '20px' }}
                >
                  {/* Col 1: ชื่อเครื่องมืออุปกรณ์ */}
                  <td
                    className="text-left py-[1px] px-1.5 text-black align-middle"
                    style={{ border: '1px solid #000000', whiteSpace: 'nowrap', overflow: 'visible' }}
                  >
                    <span className="font-normal text-slate-800">ชื่อเครื่องมืออุปกรณ์&nbsp;</span>
                    {hasData ? (
                      <span className="font-normal text-black inline-flex items-center">
                        {cleanName}
                        {isChecked && <CheckmarkSvg size={11} className="ml-1.5" />}
                      </span>
                    ) : (
                      <span className="font-normal text-slate-400">-</span>
                    )}
                  </td>

                  {/* Col 2: รหัสประจำตัวอุปกรณ์ */}
                  <td
                    className="text-left py-[1px] px-1.5 text-black align-middle"
                    style={{ border: '1px solid #000000', whiteSpace: 'nowrap', overflow: 'visible' }}
                  >
                    <span className="font-normal text-slate-800">รหัสประจำตัวอุปกรณ์&nbsp;</span>
                    <span className="font-normal text-black">
                      {hasData ? eq.sn || '-' : '-'}
                    </span>
                  </td>

                  {/* Col 3: ทะเบียน กฟผ. */}
                  <td
                    className="text-left py-[1px] px-1.5 text-black align-middle"
                    style={{ border: '1px solid #000000', whiteSpace: 'nowrap', overflow: 'visible' }}
                  >
                    <span className="font-normal text-slate-800">ทะเบียน กฟผ.&nbsp;</span>
                    <span className="font-normal text-black">
                      {hasData ? eq.egatNo || '-' : '-'}
                    </span>
                  </td>

                  {/* Col 4: ยี่ห้อ/รุ่น */}
                  <td
                    className="text-left py-[1px] px-1.5 text-black align-middle"
                    style={{ border: '1px solid #000000', whiteSpace: 'nowrap', overflow: 'visible' }}
                  >
                    <span className="font-normal text-slate-800">ยี่ห้อ/รุ่น&nbsp;</span>
                    <span className="font-normal text-black">
                      {hasData ? eq.brandModel || '-' : '-'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. Inspection Checklist Table (Days 1..31) */}
      <table
        className="border-collapse border border-black text-[10.5px] text-center mb-1.5 bg-white"
        style={{ width: '1040px', tableLayout: 'fixed', boxSizing: 'border-box' }}
      >
        <colgroup>
          <col style={{ width: '36px' }} />
          <col style={{ width: '275px' }} />
          {days.map((d) => (
            <col key={d} style={{ width: '21px' }} />
          ))}
          <col style={{ width: '78px' }} />
        </colgroup>

        <thead>
          {/* Header Row 1 */}
          <tr className="border-b border-black">
            <th
              rowSpan={2}
              style={{
                width: '36px',
                textAlign: 'center',
                verticalAlign: 'middle',
                borderRight: '1px solid #000',
                fontSize: '11px',
                fontWeight: 'bold',
                padding: '2px',
                lineHeight: 1.25,
              }}
            >
              ลำดับ<br />ที่
            </th>
            <th
              rowSpan={2}
              style={{
                width: '275px',
                textAlign: 'center',
                verticalAlign: 'middle',
                borderRight: '1px solid #000',
                fontSize: '11.5px',
                fontWeight: 'bold',
                padding: '4px 6px',
                lineHeight: 1.25,
              }}
            >
              รายการตรวจสอบ
            </th>
            <th
              colSpan={31}
              style={{
                textAlign: 'center',
                verticalAlign: 'middle',
                borderRight: '1px solid #000',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '3px 0',
                lineHeight: 1.25,
              }}
            >
              เดือน {month || '............'} พ.ศ. {year || '........'}
            </th>
            <th
              rowSpan={2}
              style={{
                width: '78px',
                textAlign: 'center',
                verticalAlign: 'middle',
                fontSize: '11px',
                fontWeight: 'bold',
                padding: '2px',
                lineHeight: 1.25,
              }}
            >
              หมายเหตุ
            </th>
          </tr>
          {/* Header Row 2: Days 1 to 31 */}
          <tr className="border-b border-black">
            {days.map((d) => (
              <th
                key={d}
                style={{
                  width: '21px',
                  height: '18px',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  borderRight: '1px solid #000',
                  fontSize: '10.5px',
                  fontWeight: 'bold',
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {/* Checklist Items Rows */}
          {checklistItems.map((item) => (
            <tr key={item.id} className="border-b border-black">
              {/* ลำดับที่ */}
              <td
                style={{
                  width: '36px',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  border: '1px solid #000000',
                  fontSize: '11px',
                  fontWeight: 'normal',
                  padding: '2px',
                }}
              >
                {item.id}
              </td>
              {/* ข้อความรายการตรวจสอบ */}
              <td
                style={{
                  width: '275px',
                  textAlign: 'left',
                  verticalAlign: 'middle',
                  border: '1px solid #000000',
                  fontSize: '10.5px',
                  lineHeight: '1.35',
                  padding: '3px 6px',
                }}
              >
                {item.text}
              </td>

              {/* 31 Day Cells - 100% Native Centering Without Flex Drift */}
              {days.map((d) => {
                const res = dayResultsMap[d]?.[item.id];
                const hasDayData = inspectedDaysSet.has(d);
                // Display slash '/' or symbol ONLY if day was inspected in the data table
                const symbol = hasDayData ? (res || '/') : '';

                return (
                  <td
                    key={d}
                    style={{
                      width: '21px',
                      height: isHarness ? '32px' : '26px',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      border: '1px solid #000000',
                      padding: 0,
                    }}
                  >
                    {(symbol === '/' || symbol === '√') && (
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          lineHeight: '1',
                          display: 'inline-block',
                          verticalAlign: 'middle',
                        }}
                      >
                        /
                      </span>
                    )}
                    {symbol === '✓' && (
                      <CheckmarkSvg size={11} />
                    )}
                    {symbol === 'X' && (
                      <CrossSvg size={10} />
                    )}
                    {symbol === '■' && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: '9px',
                          height: '9px',
                          backgroundColor: '#000000',
                          verticalAlign: 'middle',
                        }}
                      ></span>
                    )}
                    {symbol && !['/', '√', '✓', 'X', '■'].includes(symbol) && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          lineHeight: '1',
                          display: 'inline-block',
                          verticalAlign: 'middle',
                        }}
                      >
                        {symbol}
                      </span>
                    )}
                  </td>
                );
              })}

              {/* หมายเหตุ */}
              <td
                style={{
                  width: '78px',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  padding: '2px',
                }}
              ></td>
            </tr>
          ))}

          {/* Status Legend & Signatures Row */}
          <tr className="border-b border-black">
            {/* Legend Box + ลงชื่อ ผู้ตรวจสอบ */}
            <td
              colSpan={2}
              style={{
                width: '311px',
                verticalAlign: 'middle',
                border: '1px solid #000000',
                padding: '3px 8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                {/* Left: Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '13px',
                        height: '13px',
                        border: '1px solid #000000',
                        backgroundColor: '#ffffff',
                        verticalAlign: 'middle',
                      }}
                    >
                      <CheckmarkSvg size={9} />
                    </span>
                    <span style={{ fontSize: '9.5px', lineHeight: 1.25 }}>สภาพปกติ</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '13px',
                        height: '13px',
                        border: '1px solid #000000',
                        backgroundColor: '#ffffff',
                        verticalAlign: 'middle',
                      }}
                    >
                      <CrossSvg size={8} />
                    </span>
                    <span style={{ fontSize: '9.5px', lineHeight: 1.25 }}>
                      สภาพผิดปกติ ยังใช้งานได้
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '13px',
                        height: '13px',
                        backgroundColor: '#000000',
                        verticalAlign: 'middle',
                      }}
                    ></span>
                    <span style={{ fontSize: '9.5px', lineHeight: 1.25 }}>
                      สภาพผิดปกติ ต้องแก้ไขห้ามใช้งาน
                    </span>
                  </div>
                </div>

                {/* Right inside column 2: ลงชื่อ ผู้ตรวจสอบ label */}
                <div style={{ textAlign: 'right', paddingRight: '4px' }}>
                  <div style={{ fontWeight: 'normal', fontSize: '11px', lineHeight: 1.25 }}>
                    ลงชื่อ ผู้ตรวจสอบ
                  </div>
                </div>
              </div>
            </td>

            {/* 31 Individual Day Signature Cells (Per-day signatures or vector checkmark) */}
            {days.map((d) => {
              const isInspected = inspectedDaysSet.has(d);
              // Find matching record inspector for this day if any
              const dayRec = records.find(
                (r) =>
                  r.equipmentType === equipmentType &&
                  Number(r.day) === d &&
                  (normalizeMonth(r.month) === normMonth || !normMonth)
              );
              const matchedInsp = dayRec
                ? effectiveInspectors.find(
                    (i) =>
                      normalizeInspectorName(i.name).toLowerCase() ===
                      normalizeInspectorName(dayRec.inspectorName).toLowerCase()
                  ) || effectiveInspectors[0]
                : effectiveInspectors[0];

              let sigSrc = matchedInsp?.verticalSignatureDataUrl;
              if (isInspected && (!sigSrc || !sigSrc.startsWith('data:image/'))) {
                const gen = generateDigitalSignaturePng(matchedInsp?.name || dayRec?.inspectorName || 'ผู้ตรวจสอบ');
                sigSrc = gen.vertical;
              }

              return (
                <td
                  key={d}
                  style={{
                    width: '21px',
                    height: '44px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    border: '1px solid #000000',
                    padding: '1px 0',
                  }}
                >
                  {isInspected ? (
                    sigSrc ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          height: '100%',
                        }}
                      >
                        <img
                          src={sigSrc}
                          alt="ลายเซ็น"
                          loading="eager"
                          decoding="sync"
                          referrerPolicy="no-referrer"
                          style={{
                            maxWidth: '19px',
                            maxHeight: '34px',
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain',
                            display: 'block',
                            margin: '0 auto',
                            backgroundColor: 'transparent',
                          }}
                        />
                      </div>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '13px',
                          height: '13px',
                          border: '1px solid #000000',
                          backgroundColor: '#ffffff',
                          verticalAlign: 'middle',
                        }}
                      >
                        <CheckmarkSvg size={9} />
                      </span>
                    )
                  ) : null}
                </td>
              );
            })}

            {/* Right Box: ผู้รายงาน (Signature box supporting multiple inspectors) */}
            <td
              style={{
                width: '78px',
                height: '44px',
                border: '1px solid #000000',
                textAlign: 'center',
                verticalAlign: 'middle',
                padding: '2px 3px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: '1px',
                }}
              >
                {effectiveInspectors.length > 0 ? (
                  effectiveInspectors.slice(0, 2).map((insp, iIdx) => {
                    let inspSig = insp.signatureDataUrl;
                    if (!inspSig || !inspSig.startsWith('data:image/')) {
                      inspSig = generateDigitalSignaturePng(insp.name || 'ผู้รายงาน').horizontal;
                    }
                    return (
                      <div
                        key={iIdx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          maxHeight: effectiveInspectors.length > 1 ? '18px' : '26px',
                        }}
                      >
                        {inspSig ? (
                          <img
                            src={inspSig}
                            alt={`Signature ${insp.name}`}
                            loading="eager"
                            decoding="sync"
                            referrerPolicy="no-referrer"
                            style={{
                              maxHeight: effectiveInspectors.length > 1 ? '16px' : '24px',
                              maxWidth: '72px',
                              width: 'auto',
                              height: 'auto',
                              objectFit: 'contain',
                              display: 'block',
                              margin: '0 auto',
                              backgroundColor: 'transparent',
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: '8.5px', color: '#1e293b', whiteSpace: 'nowrap' }}>
                            {insp.name}
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ height: '24px' }}></div>
                )}
                <span style={{ fontSize: '9.5px', fontWeight: 'bold', lineHeight: 1.1 }}>
                  ผู้รายงาน
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 5. Footer: Copy Note & Document Revision Bar */}
      <div
        style={{
          fontSize: '18px',
          color: '#000000',
          margin: '6px 0 3px 2px',
          lineHeight: 1.2,
        }}
      >
        {FORM_METADATA.copyNote}
      </div>

      <table
        style={{
          width: '1078px',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          border: '1px solid #000000',
          backgroundColor: '#ffffff',
          color: '#000000',
          textAlign: 'center',
          fontSize: '18px',
          fontFamily: "'TH Sarabun New', 'THSarabunNew', 'TH Sarabun PSK', 'Sarabun', Tahoma, sans-serif",
          lineHeight: 1.35,
        }}
      >
        <tbody>
          <tr style={{ height: '32px' }}>
            <td
              style={{
                width: '33.33%',
                border: '1px solid #000000',
                padding: '3px 6px',
                verticalAlign: 'middle',
                textAlign: 'center',
                fontWeight: 'normal',
              }}
            >
              {FORM_METADATA.subdivision}
            </td>
            <td
              style={{
                width: '33.33%',
                border: '1px solid #000000',
                padding: '3px 6px',
                verticalAlign: 'middle',
                textAlign: 'center',
                fontWeight: 'normal',
              }}
            >
              {FORM_METADATA.docNumber}
            </td>
            <td
              style={{
                width: '33.34%',
                border: '1px solid #000000',
                padding: '3px 6px',
                verticalAlign: 'middle',
                textAlign: 'center',
                fontWeight: 'normal',
              }}
            >
              {FORM_METADATA.revision}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
