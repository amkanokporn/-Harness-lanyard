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
    <div className="mb-2">
      {/* 1. Single-line Equipment Info Box */}
      <div
        className="border border-black mb-1 px-2 py-0.5 text-black bg-white"
        style={{ width: '1040px', boxSizing: 'border-box' }}
      >
        <table
          className="border-collapse text-[10.5px] leading-normal"
          style={{ width: '100%', tableLayout: 'fixed' }}
        >
          <colgroup>
            <col style={{ width: '260px' }} />
            <col style={{ width: '210px' }} />
            <col style={{ width: '220px' }} />
            <col style={{ width: '350px' }} />
          </colgroup>
          <tbody>
            <tr className="border-none" style={{ height: '19px' }}>
              {/* Col 1: ชื่อเครื่องมืออุปกรณ์ */}
              <td className="text-left py-0 px-1 text-black align-middle whitespace-nowrap overflow-visible">
                <span className="font-normal text-slate-800">ชื่อเครื่องมืออุปกรณ์:&nbsp;</span>
                {hasData ? (
                  <span className="font-bold text-black inline-flex items-center">
                    {cleanName}
                    {isChecked && <CheckmarkSvg size={11} className="ml-1.5" />}
                  </span>
                ) : (
                  <span className="font-normal text-slate-400">-</span>
                )}
              </td>

              {/* Col 2: รหัสประจำตัวอุปกรณ์ */}
              <td className="text-left py-0 px-1 text-black align-middle whitespace-nowrap overflow-visible">
                <span className="font-normal text-slate-800">รหัสประจำตัวอุปกรณ์:&nbsp;</span>
                <span className="font-normal text-black">{hasData ? eq.sn || '-' : '-'}</span>
              </td>

              {/* Col 3: ทะเบียน กฟผ. */}
              <td className="text-left py-0 px-1 text-black align-middle whitespace-nowrap overflow-visible">
                <span className="font-normal text-slate-800">ทะเบียน กฟผ.:&nbsp;</span>
                <span className="font-normal text-black">{hasData ? eq.egatNo || '-' : '-'}</span>
              </td>

              {/* Col 4: ยี่ห้อ/รุ่น */}
              <td className="text-left py-0 px-1 text-black align-middle whitespace-nowrap overflow-visible">
                <span className="font-normal text-slate-800">ยี่ห้อ/รุ่น:&nbsp;</span>
                <span className="font-normal text-black">{hasData ? eq.brandModel || '-' : '-'}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 2. Checklist Table (Days 1..31) */}
      <table
        className="border-collapse border border-black text-[10.5px] text-center bg-white"
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
                lineHeight: 1.15,
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
                fontSize: '11px',
                fontWeight: 'bold',
                padding: '3px 6px',
                lineHeight: 1.15,
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
                fontSize: '11.5px',
                fontWeight: 'bold',
                padding: '2px 0',
                lineHeight: 1.15,
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
                lineHeight: 1.15,
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
                  height: '16px',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  borderRight: '1px solid #000',
                  fontSize: '10px',
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
                  borderRight: '1px solid #000',
                  fontSize: '10.5px',
                  fontWeight: 'normal',
                  padding: '1px',
                }}
              >
                {item.id}
              </td>
              {/* รายการตรวจสอบ */}
              <td
                style={{
                  width: '275px',
                  textAlign: 'left',
                  verticalAlign: 'middle',
                  borderRight: '1px solid #000',
                  fontSize: isHarness ? '10px' : '9.5px',
                  lineHeight: '1.25',
                  padding: '2px 5px',
                }}
              >
                {item.text}
              </td>

              {/* 31 Day Cells */}
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
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      borderRight: '1px solid #000',
                      padding: 0,
                    }}
                  >
                    {(symbol === '/' || symbol === '√') && (
                      <span
                        style={{
                          fontSize: '13px',
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
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  padding: '1px',
                }}
              ></td>
            </tr>
          ))}

          {/* Bottom Row: Status Legend + ลงชื่อ ผู้ตรวจสอบ (Per-Day Signatures) */}
          <tr className="border-b-0">
            {/* Left: Legend & Label */}
            <td
              colSpan={2}
              style={{
                width: '311px',
                verticalAlign: 'middle',
                borderRight: '1px solid #000',
                padding: '2px 6px',
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
                {/* Legend */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '11px',
                        height: '11px',
                        border: '1px solid #000000',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <CheckmarkSvg size={8} />
                    </span>
                    <span style={{ fontSize: '8.5px', lineHeight: 1 }}>สภาพปกติ</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '11px',
                        height: '11px',
                        border: '1px solid #000000',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <CrossSvg size={7} />
                    </span>
                    <span style={{ fontSize: '8.5px', lineHeight: 1 }}>สภาพผิดปกติ ยังใช้ได้</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '11px',
                        height: '11px',
                        backgroundColor: '#000000',
                      }}
                    ></span>
                    <span style={{ fontSize: '8.5px', lineHeight: 1 }}>ต้องแก้ไขห้ามใช้</span>
                  </div>
                </div>

                {/* ลงชื่อ ผู้ตรวจสอบ label */}
                <div style={{ textAlign: 'right', paddingRight: '2px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '9.5px', lineHeight: 1 }}>
                    ลงชื่อ ผู้ตรวจสอบ
                  </span>
                  <span style={{ fontSize: '8px', color: '#475569', marginLeft: '3px' }}>
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
                    height: '32px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    borderRight: '1px solid #000',
                    padding: 0,
                    cursor: isInspected ? 'pointer' : 'default',
                    backgroundColor: isInspected ? '#f8fafc' : '#ffffff',
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
                        padding: '1px 0',
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
                            maxHeight: '28px',
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain',
                            display: 'block',
                            margin: '0 auto',
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

            {/* Right Box: ผู้รายงาน (Signature of the top inspector who used this equipment the most) */}
            <td
              style={{
                width: '78px',
                height: '32px',
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
                        maxHeight: '19px',
                        maxWidth: '72px',
                        width: 'auto',
                        objectFit: 'contain',
                        display: 'block',
                        margin: '0 auto',
                      }}
                    />
                  ) : null;
                })()}
                <span
                  style={{
                    fontSize: '9.5px',
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
      <div className="text-center mb-0.5">
        <h1 className="text-[17px] font-bold tracking-tight text-black leading-snug">
          {FORM_METADATA.title}
        </h1>
      </div>

      {/* 2. Subheader Metadata */}
      <div className="flex items-center justify-start text-[11.5px] font-medium text-black px-1 mb-1 gap-8 leading-tight">
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

      {/* 4. Section 2: Lanyard */}
      <EquipmentSection
        data={pageData.lanyardData}
        month={pageData.month}
        year={pageData.year}
        onDaySignatureClick={onDaySignatureClick}
      />

      {/* 5. Footer: Copy Note & Document Revision Bar */}
      <div className="text-[9.5px] text-black mb-0.5 pl-1 font-normal leading-tight">
        {FORM_METADATA.copyNote}
      </div>

      <div className="border border-black grid grid-cols-12 text-center text-[10px] font-normal py-0.5 bg-white leading-tight">
        <div className="col-span-4 border-r border-black">
          {FORM_METADATA.subdivision}
        </div>
        <div className="col-span-4 border-r border-black font-bold">
          {FORM_METADATA.docNumber}
        </div>
        <div className="col-span-4">
          {FORM_METADATA.revision}
        </div>
      </div>
    </div>
  );
};
