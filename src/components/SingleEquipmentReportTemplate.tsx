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

/**
 * Sub-component for rendering a single equipment's header box and 31-day checklist table
 * Built as an EXACT digital twin of the Microsoft Word template (FM-004/QP-PB-013)
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
    <div style={{ width: '1040px', boxSizing: 'border-box' }}>
      {/* 1. Single-line Equipment Info Table (4 Bordered Cells, exactly matching Word layout) */}
      <table
        style={{
          width: '1040px',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          border: '1px solid #000000',
          marginBottom: '3px',
          backgroundColor: '#ffffff',
          color: '#000000',
        }}
      >
        <colgroup>
          <col style={{ width: '260px' }} />
          <col style={{ width: '210px' }} />
          <col style={{ width: '220px' }} />
          <col style={{ width: '350px' }} />
        </colgroup>
        <tbody>
          <tr style={{ height: '22px' }}>
            {/* Col 1: ชื่อเครื่องมืออุปกรณ์ */}
            <td
              style={{
                border: '1px solid #000000',
                padding: '2px 6px',
                verticalAlign: 'middle',
                textAlign: 'left',
                fontSize: '12.5px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span>ชื่อเครื่องมืออุปกรณ์:&nbsp;</span>
              {hasData ? (
                <span style={{ fontWeight: 'bold' }}>
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
                padding: '2px 6px',
                verticalAlign: 'middle',
                textAlign: 'left',
                fontSize: '12.5px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span>รหัสประจำตัวอุปกรณ์:&nbsp;</span>
              <span>{hasData ? eq.sn || '-' : '-'}</span>
            </td>

            {/* Col 3: ทะเบียน กฟผ. */}
            <td
              style={{
                border: '1px solid #000000',
                padding: '2px 6px',
                verticalAlign: 'middle',
                textAlign: 'left',
                fontSize: '12.5px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span>ทะเบียน กฟผ.:&nbsp;</span>
              <span>{hasData ? eq.egatNo || '-' : '-'}</span>
            </td>

            {/* Col 4: ยี่ห้อ/รุ่น */}
            <td
              style={{
                border: '1px solid #000000',
                padding: '2px 6px',
                verticalAlign: 'middle',
                textAlign: 'left',
                fontSize: '12.5px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span>ยี่ห้อ/รุ่น:&nbsp;</span>
              <span>{hasData ? eq.brandModel || '-' : '-'}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 2. Checklist Table (Days 1..31) - Every cell explicitly bordered 1px solid black */}
      <table
        style={{
          width: '1040px',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          border: '1px solid #000000',
          backgroundColor: '#ffffff',
          color: '#000000',
          boxSizing: 'border-box',
        }}
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
          <tr>
            <th
              rowSpan={2}
              style={{
                width: '36px',
                border: '1px solid #000000',
                textAlign: 'center',
                verticalAlign: 'middle',
                fontSize: '13px',
                fontWeight: 'bold',
                padding: '1px',
                lineHeight: 1.15,
                backgroundColor: '#ffffff',
              }}
            >
              ลำดับ<br />ที่
            </th>
            <th
              rowSpan={2}
              style={{
                width: '275px',
                border: '1px solid #000000',
                textAlign: 'center',
                verticalAlign: 'middle',
                fontSize: '13px',
                fontWeight: 'bold',
                padding: '2px 6px',
                lineHeight: 1.15,
                backgroundColor: '#ffffff',
              }}
            >
              รายการตรวจสอบ
            </th>
            <th
              colSpan={31}
              style={{
                width: '651px',
                border: '1px solid #000000',
                textAlign: 'center',
                verticalAlign: 'middle',
                fontSize: '13.5px',
                fontWeight: 'bold',
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
                width: '78px',
                border: '1px solid #000000',
                textAlign: 'center',
                verticalAlign: 'middle',
                fontSize: '13px',
                fontWeight: 'bold',
                padding: '1px',
                lineHeight: 1.15,
                backgroundColor: '#ffffff',
              }}
            >
              หมายเหตุ
            </th>
          </tr>

          {/* Header Row 2: Days 1 to 31 */}
          <tr>
            {days.map((d) => (
              <th
                key={d}
                style={{
                  width: '21px',
                  height: '18px',
                  border: '1px solid #000000',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  padding: 0,
                  backgroundColor: '#ffffff',
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
            <tr key={item.id}>
              {/* ลำดับที่ */}
              <td
                style={{
                  width: '36px',
                  height: isHarness ? '21px' : '19px',
                  border: '1px solid #000000',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  padding: '1px',
                }}
              >
                {item.id}
              </td>

              {/* รายการตรวจสอบ */}
              <td
                style={{
                  width: '275px',
                  height: isHarness ? '21px' : '19px',
                  border: '1px solid #000000',
                  textAlign: 'left',
                  verticalAlign: 'middle',
                  fontSize: isHarness ? '11px' : '10.5px',
                  lineHeight: '1.2',
                  padding: '1px 6px',
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
                      width: '21px',
                      height: isHarness ? '21px' : '19px',
                      border: '1px solid #000000',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      padding: 0,
                    }}
                  >
                    {(symbol === '/' || symbol === '√') && (
                      <span
                        style={{
                          fontSize: '13.5px',
                          fontWeight: 'bold',
                          lineHeight: '1',
                          display: 'inline-block',
                          verticalAlign: 'middle',
                        }}
                      >
                        /
                      </span>
                    )}
                    {symbol === '✓' && <CheckmarkSvg size={10} />}
                    {symbol === 'X' && <CrossSvg size={9} />}
                    {symbol === '■' && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          backgroundColor: '#000000',
                          verticalAlign: 'middle',
                        }}
                      ></span>
                    )}
                    {symbol && !['/', '√', '✓', 'X', '■'].includes(symbol) && (
                      <span
                        style={{
                          fontSize: '10px',
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
                  height: isHarness ? '21px' : '19px',
                  border: '1px solid #000000',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  padding: '1px',
                }}
              ></td>
            </tr>
          ))}

          {/* Bottom Row: Status Legend + ลงชื่อ ผู้ตรวจสอบ (Per-Day Signatures) */}
          <tr style={{ height: '42px' }}>
            {/* Left: Legend & Label (spans columns 1 and 2) */}
            <td
              colSpan={2}
              style={{
                width: '311px',
                height: '42px',
                border: '1px solid #000000',
                verticalAlign: 'middle',
                padding: '2px 8px',
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
                {/* Standard Legend matching Word */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#000000', whiteSpace: 'nowrap' }}>
                    [✓] ปกติ&nbsp;&nbsp;[✕] ผิดปกติ ใช้ได้&nbsp;&nbsp;[■] ห้ามใช้
                  </span>
                </div>

                {/* ลงชื่อ ผู้ตรวจสอบ label */}
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '12.5px', color: '#000000' }}>
                    ลงชื่อ ผู้ตรวจสอบ
                  </span>
                  <span style={{ fontSize: '10px', color: '#475569', marginLeft: '4px' }}>
                    (รายละเอียดตามแนบ)
                  </span>
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
                    width: '21px',
                    height: '42px',
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
                            maxWidth: '18px',
                            maxHeight: '38px',
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
                            width: '12px',
                            height: '12px',
                            border: '1px solid #000000',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          <CheckmarkSvg size={8} />
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
                width: '78px',
                height: '42px',
                border: '1px solid #000000',
                textAlign: 'center',
                verticalAlign: 'middle',
                padding: '1px 2px',
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
                        maxHeight: '22px',
                        maxWidth: '72px',
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
                    fontSize: '11px',
                    fontWeight: 'bold',
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
        width: '1080px',
        height: '764px',
        minHeight: '764px',
        maxHeight: '764px',
        padding: '10px 20px 8px 20px',
        boxSizing: 'border-box',
        fontFamily: "'TH Sarabun New', 'THSarabunNew', 'TH Sarabun PSK', 'Sarabun', Tahoma, sans-serif",
        color: '#000000',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        lineHeight: 1.2,
      }}
    >
      {/* 1. Header Title */}
      <div style={{ textAlign: 'center', marginBottom: '2px' }}>
        <h1
          style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#000000',
            margin: 0,
            padding: 0,
            lineHeight: 1.2,
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
          fontSize: '13.5px',
          fontWeight: 'bold',
          color: '#000000',
          padding: '0 2px',
          marginBottom: '3px',
          gap: '32px',
          lineHeight: 1.2,
        }}
      >
        <span>เรียน&nbsp;&nbsp;หมผ – ธ.</span>
        <span>แผนก&nbsp;&nbsp;หมผ - ธ.</span>
        <span>กอง&nbsp;&nbsp;กคว - ธ.</span>
        <span>ฝ่าย&nbsp;&nbsp;อคม. รวธ.</span>
      </div>

      {/* 3. Section 1: Full Body Harness */}
      <EquipmentSection
        data={pageData.harnessData}
        month={pageData.month}
        year={pageData.year}
        onDaySignatureClick={onDaySignatureClick}
      />

      {/* Clean vertical separator between Harness & Lanyard */}
      <div style={{ height: '6px' }} />

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
          fontSize: '11px',
          color: '#000000',
          margin: '2px 0 2px 2px',
          lineHeight: 1.2,
        }}
      >
        {FORM_METADATA.copyNote}
      </div>

      {/* Revision Table matching Word's 3-column bordered table */}
      <table
        style={{
          width: '1040px',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          border: '1px solid #000000',
          backgroundColor: '#ffffff',
          color: '#000000',
          textAlign: 'center',
          fontSize: '11px',
        }}
      >
        <tbody>
          <tr style={{ height: '20px' }}>
            <td
              style={{
                width: '33.33%',
                border: '1px solid #000000',
                padding: '2px',
                verticalAlign: 'middle',
              }}
            >
              {FORM_METADATA.subdivision}
            </td>
            <td
              style={{
                width: '33.33%',
                border: '1px solid #000000',
                padding: '2px',
                verticalAlign: 'middle',
                fontWeight: 'bold',
              }}
            >
              {FORM_METADATA.docNumber}
            </td>
            <td
              style={{
                width: '33.34%',
                border: '1px solid #000000',
                padding: '2px',
                verticalAlign: 'middle',
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
