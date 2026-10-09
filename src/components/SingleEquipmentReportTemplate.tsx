import React from 'react';
import {
  EquipmentPairPageData,
  SingleEquipmentMonthData,
} from '../utils/inspectionAggregation';
import {
  FORM_METADATA,
  HARNESS_CHECKLIST_ITEMS,
  LANYARD_CHECKLIST_ITEMS,
} from '../constants/masterTemplates';
import { generateDigitalSignaturePng } from '../utils/signatureUtils';

interface SingleEquipmentReportTemplateProps {
  pageData: EquipmentPairPageData;
  idPrefix?: string;
  onDaySignatureClick?: (equipmentType: 'harness' | 'lanyard', day: number, inspectorName?: string) => void;
}

/**
 * 100% Canvas & PDF-safe Vector Checkmark component
 */
const CheckmarkSvg: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
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
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 100% Canvas & PDF-safe Vector Cross component
 */
const CrossSvg: React.FC<{ size?: number; className?: string }> = ({ size = 13, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block shrink-0 ${className}`}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <line x1="2.5" y1="2.5" x2="9.5" y2="9.5" stroke="#000000" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="9.5" y1="2.5" x2="2.5" y2="9.5" stroke="#000000" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

/**
 * Sub-component for rendering a single equipment's header box and 31-day checklist table
 * Built as an EXACT 1:1 digital twin of the Microsoft Word template (FM-004/QP-PB-013)
 * Full 13.5pt (18px) TH Sarabun New font for maximum clarity and exact document fidelity
 */
const EquipmentSection: React.FC<{
  data: SingleEquipmentMonthData;
  month: string;
  year: string;
  onDaySignatureClick?: (equipmentType: 'harness' | 'lanyard', day: number, inspectorName?: string) => void;
}> = ({ data, month, year, onDaySignatureClick }) => {
  const isHarness = data.equipmentType === 'harness';
  const checklistItems = isHarness ? HARNESS_CHECKLIST_ITEMS : LANYARD_CHECKLIST_ITEMS;
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const eq = data.equipment;
  const hasData = !!eq.name;
  const cleanName = (eq.name || '').replace(/[✓√✔]/g, '').trim();
  const isChecked = data.isCheckedInMonth || eq.isCheckedInReport;

  return (
    <div style={{ width: '1078px', boxSizing: 'border-box' }}>
      {/* 1. Single-line Equipment Info Table (4 Bordered Cells, exactly matching Word layout with 13.5pt font) */}
      <table
        style={{
          width: '1078px',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          border: '1px solid #000000',
          marginBottom: '4px',
          backgroundColor: '#ffffff',
          color: '#000000',
          fontFamily: "'TH Sarabun New', 'THSarabunNew', 'TH Sarabun PSK', 'Sarabun', Tahoma, sans-serif",
        }}
      >
        <colgroup>
          <col style={{ width: '270px' }} />
          <col style={{ width: '218px' }} />
          <col style={{ width: '228px' }} />
          <col style={{ width: '362px' }} />
        </colgroup>
        <tbody>
          <tr style={{ height: '34px' }}>
            {/* Col 1: ชื่อเครื่องมืออุปกรณ์ */}
            <td
              style={{
                border: '1px solid #000000',
                padding: '3px 8px',
                verticalAlign: 'middle',
                textAlign: 'left',
                fontSize: '18px', // Exact 13.5pt in Word
                fontWeight: 'normal',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                lineHeight: 1.25,
              }}
            >
              <span>ชื่อเครื่องมืออุปกรณ์:&nbsp;</span>
              {hasData ? (
                <span>
                  {cleanName}
                  {isChecked && ' ✓'}
                </span>
              ) : (
                <span>-</span>
              )}
            </td>

            {/* Col 2: รหัสประจำตัวอุปกรณ์ */}
            <td
              style={{
                border: '1px solid #000000',
                padding: '3px 8px',
                verticalAlign: 'middle',
                textAlign: 'left',
                fontSize: '18px', // Exact 13.5pt in Word
                fontWeight: 'normal',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                lineHeight: 1.25,
              }}
            >
              <span>รหัสประจำตัวอุปกรณ์:&nbsp;</span>
              <span>{hasData ? eq.sn || '-' : '-'}</span>
            </td>

            {/* Col 3: ทะเบียน กฟผ. */}
            <td
              style={{
                border: '1px solid #000000',
                padding: '3px 8px',
                verticalAlign: 'middle',
                textAlign: 'left',
                fontSize: '18px', // Exact 13.5pt in Word
                fontWeight: 'normal',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                lineHeight: 1.25,
              }}
            >
              <span>ทะเบียน กฟผ.:&nbsp;</span>
              <span>{hasData ? eq.egatNo || '-' : '-'}</span>
            </td>

            {/* Col 4: ยี่ห้อ/รุ่น */}
            <td
              style={{
                border: '1px solid #000000',
                padding: '3px 8px',
                verticalAlign: 'middle',
                textAlign: 'left',
                fontSize: '18px', // Exact 13.5pt in Word
                fontWeight: 'normal',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                lineHeight: 1.25,
              }}
            >
              <span>ยี่ห้อ/รุ่น:&nbsp;</span>
              <span>{hasData ? eq.brandModel || '-' : '-'}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 2. Checklist Table (Days 1..31) - Fully bordered matching Word */}
      <table
        style={{
          width: '1078px',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          border: '1px solid #000000',
          backgroundColor: '#ffffff',
          color: '#000000',
          boxSizing: 'border-box',
          fontFamily: "'TH Sarabun New', 'THSarabunNew', 'TH Sarabun PSK', 'Sarabun', Tahoma, sans-serif",
        }}
      >
        <colgroup>
          <col style={{ width: '38px' }} />
          <col style={{ width: '285px' }} />
          {days.map((d) => (
            <col key={d} style={{ width: '21.77px' }} />
          ))}
          <col style={{ width: '80px' }} />
        </colgroup>

        <thead>
          {/* Header Row 1 */}
          <tr style={{ height: '28px' }}>
            <th
              rowSpan={2}
              style={{
                width: '38px',
                border: '1px solid #000000',
                textAlign: 'center',
                verticalAlign: 'middle',
                fontSize: '18px', // 13.5pt
                fontWeight: 'normal',
                padding: '2px',
                lineHeight: 1.15,
                backgroundColor: '#ffffff',
              }}
            >
              ลำดับ<br />ที่
            </th>
            <th
              rowSpan={2}
              style={{
                width: '285px',
                border: '1px solid #000000',
                textAlign: 'center',
                verticalAlign: 'middle',
                fontSize: '18px', // 13.5pt
                fontWeight: 'normal',
                padding: '2px 8px',
                lineHeight: 1.15,
                backgroundColor: '#ffffff',
              }}
            >
              รายการตรวจสอบ
            </th>
            <th
              colSpan={31}
              style={{
                width: '675px',
                border: '1px solid #000000',
                textAlign: 'center',
                verticalAlign: 'middle',
                fontSize: '18px', // 13.5pt
                fontWeight: 'normal',
                padding: '2px 0',
                lineHeight: 1.15,
                backgroundColor: '#ffffff',
              }}
            >
              เดือน {month || '............'} พ.ศ. {year || '........'}
            </th>
            <th
              rowSpan={2}
              style={{
                width: '80px',
                border: '1px solid #000000',
                textAlign: 'center',
                verticalAlign: 'middle',
                fontSize: '18px', // 13.5pt
                fontWeight: 'normal',
                padding: '2px',
                lineHeight: 1.15,
                backgroundColor: '#ffffff',
              }}
            >
              หมายเหตุ
            </th>
          </tr>

          {/* Header Row 2: Days 1 to 31 */}
          <tr style={{ height: '22px' }}>
            {days.map((d) => (
              <th
                key={d}
                style={{
                  width: '21.77px',
                  height: '22px',
                  border: '1px solid #000000',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  fontSize: '15px', // 11pt
                  fontWeight: 'normal',
                  padding: 0,
                  backgroundColor: '#ffffff',
                  lineHeight: 1,
                }}
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {/* Checklist Item Rows */}
          {checklistItems.map((item) => (
            <tr key={item.id} style={{ height: isHarness ? '28px' : '25px' }}>
              {/* ลำดับที่ */}
              <td
                style={{
                  width: '38px',
                  height: isHarness ? '28px' : '25px',
                  border: '1px solid #000000',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  fontSize: '18px', // 13.5pt
                  fontWeight: 'normal',
                  padding: '1px',
                }}
              >
                {item.id}
              </td>

              {/* รายการตรวจสอบ */}
              <td
                style={{
                  width: '285px',
                  height: isHarness ? '28px' : '25px',
                  border: '1px solid #000000',
                  textAlign: 'left',
                  verticalAlign: 'middle',
                  fontSize: isHarness ? '17px' : '16.5px', // 13pt
                  lineHeight: isHarness ? '1.25' : '1.2',
                  padding: '1px 8px',
                  fontWeight: 'normal',
                }}
              >
                {item.text}
              </td>

              {/* 31 Day Check Cells (shows '/' like in Word) */}
              {days.map((d) => {
                const res = data.dayResults[d]?.[item.id];
                const isInspectedDay = data.inspectedDays.includes(d);
                const symbol = isInspectedDay ? (res || '/') : '';

                return (
                  <td
                    key={d}
                    style={{
                      width: '21.77px',
                      height: isHarness ? '28px' : '25px',
                      border: '1px solid #000000',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      padding: 0,
                    }}
                  >
                    {(symbol === '/' || symbol === '√') && (
                      <span
                        style={{
                          fontSize: '18px', // 13.5pt
                          fontWeight: 'normal',
                          lineHeight: '1',
                          display: 'inline-block',
                          verticalAlign: 'middle',
                        }}
                      >
                        /
                      </span>
                    )}
                    {symbol === '✓' && <CheckmarkSvg size={13} />}
                    {symbol === 'X' && <CrossSvg size={12} />}
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
                          fontSize: '15px',
                          fontWeight: 'normal',
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
                  width: '80px',
                  height: isHarness ? '28px' : '25px',
                  border: '1px solid #000000',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  padding: '1px',
                }}
              ></td>
            </tr>
          ))}

          {/* Bottom Row: Status Legend + ลงชื่อ ผู้ตรวจสอบ (Per-Day Signatures) */}
          <tr style={{ height: '48px' }}>
            {/* Left: Legend & Label (spans columns 1 and 2, exactly matching Word layout) */}
            <td
              colSpan={2}
              style={{
                width: '323px',
                maxWidth: '323px',
                height: '48px',
                border: '1px solid #000000',
                verticalAlign: 'middle',
                padding: '3px 8px',
                overflow: 'hidden',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  gap: '3px',
                  overflow: 'hidden',
                }}
              >
                {/* Row 1: Status Legend (Left aligned matching Word) */}
                <div
                  style={{
                    textAlign: 'left',
                    fontSize: '16px', // 12pt matching Word
                    color: '#000000',
                    lineHeight: 1.25,
                    whiteSpace: 'nowrap',
                    width: '100%',
                  }}
                >
                  <span>[✓] ปกติ&nbsp;&nbsp;&nbsp;[✕] ผิดปกติ ใช้ได้&nbsp;&nbsp;&nbsp;[■] ห้ามใช้</span>
                </div>

                {/* Row 2: ลงชื่อ ผู้ตรวจสอบ (Right aligned matching Word) */}
                <div
                  style={{
                    textAlign: 'right',
                    fontSize: '17px', // 13pt matching Word
                    color: '#000000',
                    lineHeight: 1.25,
                    whiteSpace: 'nowrap',
                    width: '100%',
                  }}
                >
                  <span style={{ fontWeight: 'normal' }}>ลงชื่อ ผู้ตรวจสอบ</span>
                </div>
              </div>
            </td>

            {/* 31 Individual Day Signature Cells (Whoever inspected on THAT day signs here!) */}
            {days.map((d) => {
              const isInspected = data.inspectedDays.includes(d);
              const dayInsp = data.dayInspectors[d];
              let signatureSrc = dayInsp?.verticalSignatureDataUrl;
              if (isInspected && (!signatureSrc || !signatureSrc.startsWith('data:image/'))) {
                const gen = generateDigitalSignaturePng(dayInsp?.inspectorName || 'ผู้ตรวจสอบ');
                signatureSrc = gen.vertical;
              }

              return (
                <td
                  key={d}
                  onClick={() => {
                    if (onDaySignatureClick && isInspected) {
                      onDaySignatureClick(data.equipmentType, d, dayInsp?.inspectorName);
                    }
                  }}
                  title={isInspected ? `ผู้ตรวจวันที่ ${d}: ${dayInsp?.inspectorName || 'ผู้ตรวจสอบ'}` : undefined}
                  style={{
                    width: '21.77px',
                    height: '48px',
                    border: '1px solid #000000',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    padding: 0,
                    cursor: isInspected ? 'pointer' : 'default',
                    backgroundColor: '#ffffff',
                    overflow: 'hidden',
                  }}
                >
                  {isInspected && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden',
                      }}
                    >
                      {signatureSrc ? (
                        <img
                          src={signatureSrc}
                          alt={dayInsp?.inspectorName || 'ลายเซ็น'}
                          loading="eager"
                          decoding="sync"
                          referrerPolicy="no-referrer"
                          style={{
                            maxWidth: '19px',
                            maxHeight: '44px',
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain',
                            display: 'block',
                            margin: 'auto',
                            backgroundColor: 'transparent',
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '14px',
                            height: '14px',
                            border: '1px solid #000000',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          <CheckmarkSvg size={10} />
                        </span>
                      )}
                    </div>
                  )}
                </td>
              );
            })}

            {/* Right Box: ผู้รายงาน (Signature of the top inspector + label) */}
            <td
              style={{
                width: '80px',
                height: '48px',
                border: '1px solid #000000',
                textAlign: 'center',
                verticalAlign: 'middle',
                padding: '2px 4px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  gap: '1px',
                }}
              >
                {(() => {
                  let reporterSig = data.primaryInspector?.signatureDataUrl;
                  if (!reporterSig || !reporterSig.startsWith('data:image/')) {
                    reporterSig = generateDigitalSignaturePng(data.primaryInspector?.name || 'ผู้รายงาน').horizontal;
                  }
                  return reporterSig ? (
                    <img
                      src={reporterSig}
                      alt={data.primaryInspector?.name || 'ผู้รายงาน'}
                      loading="eager"
                      decoding="sync"
                      referrerPolicy="no-referrer"
                      style={{
                        maxHeight: '26px',
                        maxWidth: '76px',
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block',
                        margin: 'auto',
                        backgroundColor: 'transparent',
                      }}
                    />
                  ) : null;
                })()}
                <span
                  style={{
                    fontSize: '18px', // Exact 13.5pt in Word
                    fontWeight: 'normal',
                    lineHeight: '1',
                    whiteSpace: 'nowrap',
                    color: '#000000',
                    textAlign: 'center',
                  }}
                >
                  ผู้รายงาน
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export const SingleEquipmentReportTemplate: React.FC<SingleEquipmentReportTemplateProps> = ({
  pageData,
  idPrefix = 'single-report-page',
  onDaySignatureClick,
}) => {
  const pageId = `${idPrefix}-set-${pageData.pairNumber}`;

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
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <h1
          style={{
            fontSize: '20px', // Exact 15pt bold in Word
            fontWeight: 'bold',
            color: '#000000',
            margin: 0,
            padding: 0,
            lineHeight: 1.25,
          }}
        >
          {FORM_METADATA.title}
        </h1>
      </div>

      {/* 2. Subheader Metadata */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          fontSize: '18px', // Exact 13.5pt bold in Word
          fontWeight: 'bold',
          color: '#000000',
          padding: '0 2px',
          marginBottom: '6px',
          gap: '38px',
          lineHeight: 1.25,
        }}
      >
        <span>เรียน&nbsp;&nbsp;หมผ – ธ.</span>
        <span>แผนก&nbsp;&nbsp;หมผ - ธ.</span>
        <span>กอง&nbsp;&nbsp;กคว - ธ.</span>
        <span>ฝ่าย&nbsp;&nbsp;อคม.&nbsp;&nbsp;รวธ.</span>
      </div>

      {/* 3. Section 1: Full Body Harness */}
      <EquipmentSection
        data={pageData.harnessData}
        month={pageData.month}
        year={pageData.year}
        onDaySignatureClick={onDaySignatureClick}
      />

      {/* Clean vertical separator between Harness & Lanyard */}
      <div style={{ height: '10px' }} />

      {/* 4. Section 2: Lanyard */}
      <EquipmentSection
        data={pageData.lanyardData}
        month={pageData.month}
        year={pageData.year}
        onDaySignatureClick={onDaySignatureClick}
      />

      {/* 5. Footer: Copy Note & Document Revision Bar */}
      <div
        style={{
          fontSize: '18px', // Exact 13.5pt in Word
          color: '#000000',
          margin: '6px 0 3px 2px',
          lineHeight: 1.2,
        }}
      >
        {FORM_METADATA.copyNote}
      </div>

      {/* Revision Table matching Word's 3-column bordered table */}
      <table
        style={{
          width: '1078px',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          border: '1px solid #000000',
          backgroundColor: '#ffffff',
          color: '#000000',
          textAlign: 'center',
          fontSize: '18px', // Exact 13.5pt in Word
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
