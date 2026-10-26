import React, { useRef, useState, useMemo } from 'react';
import {
  EquipmentType,
  FilterState,
  Inspector,
  ParsedExcelResult,
} from '../types';
import { THAI_MONTHS } from '../constants/masterTemplates';
import {
  UploadCloud,
  FileSpreadsheet,
  Calendar,
  UserCheck,
  FileDown,
  Printer,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { normalizeInspectorName } from '../utils/inspectionAggregation';
import { fuzzyFilterInspectors } from '../utils/thaiNameNormalizer';
import { generateSignatureExcelTemplate } from '../utils/signatureTemplateGenerator';

interface FilterControlsProps {
  parsedData: ParsedExcelResult | null;
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  onFileUpload: (file: File) => void;
  inspectors: Inspector[];
  onOpenInspectorModal: () => void;
  onGeneratePdf: () => void;
  onGenerateDocx: () => void;
  onPrintPreview: () => void;
  isGeneratingPdf: boolean;
  isGeneratingDocx: boolean;
  generationProgressText: string;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  parsedData,
  filters,
  onFilterChange,
  onFileUpload,
  inspectors,
  onOpenInspectorModal,
  onGeneratePdf,
  onGenerateDocx,
  onPrintPreview,
  isGeneratingPdf,
  isGeneratingDocx,
  generationProgressText,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [inspectorSearchQuery, setInspectorSearchQuery] = useState('');
  // ซ่อนรายชื่อผู้ตรวจสอบไว้ก่อนเป็นค่าเริ่มต้นตามความต้องการของผู้ใช้
  const [isInspectorsExpanded, setIsInspectorsExpanded] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  // Memoized Filtered Records
  const filteredRecords = useMemo(() => {
    return (parsedData?.records || []).filter((r) => {
      const matchMonth = !filters.month || r.month === filters.month;
      const matchYear = !filters.year || String(r.year) === String(filters.year);
      const matchType =
        filters.equipmentType === 'all' || r.equipmentType === filters.equipmentType;
      return matchMonth && matchYear && matchType;
    });
  }, [parsedData?.records, filters.month, filters.year, filters.equipmentType]);

  const checkedDays = useMemo(() => {
    return Array.from(new Set(filteredRecords.map((r) => Number(r.day)))).sort(
      (a: number, b: number) => a - b
    );
  }, [filteredRecords]);

  // Precomputed inspector day counts for current filtered records
  const inspectorCountsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredRecords) {
      const name = normalizeInspectorName(r.inspectorName);
      if (name) {
        map.set(name.toLowerCase(), (map.get(name.toLowerCase()) || 0) + 1);
      }
    }
    return map;
  }, [filteredRecords]);

  // Set of inspector names appearing in current filtered month/year
  const monthInspectorNamesSet = useMemo(() => {
    return new Set(
      filteredRecords
        .map((r) => normalizeInspectorName(r.inspectorName || '').trim())
        .filter(Boolean)
    );
  }, [filteredRecords]);

  // Memoized filtered inspectors for display based on search query
  const displayedInspectors = useMemo(() => {
    return fuzzyFilterInspectors(inspectors, inspectorSearchQuery);
  }, [inspectors, inspectorSearchQuery]);

  // Check validity for PDF/DOCX generation
  const validationErrors: string[] = [];
  if (!parsedData) {
    validationErrors.push('ยังไม่ได้อัปโหลดหรือเลือกไฟล์ข้อมูล Excel');
  } else {
    if (!filters.month) validationErrors.push('กรุณาระบุเดือน');
    if (!filters.year) validationErrors.push('กรุณาระบุปี พ.ศ.');
    if (filteredRecords.length === 0) {
      validationErrors.push('ไม่พบข้อมูลการตรวจสอบตามเงื่อนไขที่เลือก');
    }
  }

  const canGenerate = validationErrors.length === 0;

  return (
    <div
      id="filter-controls-panel"
      className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-5"
    >
      {/* 1. File Upload Card */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-base sm:text-lg font-bold text-[#1e3a8a] flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-[#1e3a8a] text-[#fbbf24] flex items-center justify-center text-sm font-bold shadow-2xs">
              1
            </span>
            <span>นำเข้าไฟล์การตรวจสอบ (Excel)</span>
          </h2>
          {parsedData && (
            <span className="text-xs sm:text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-md flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
              พร้อมใช้งาน
            </span>
          )}
        </div>

        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-[#1e3a8a] bg-slate-50/60 hover:bg-blue-50/30 rounded-xl p-4.5 sm:p-6 transition-colors cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv"
            className="hidden"
            id="file-input-excel"
          />

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1e3a8a] border border-blue-200 flex items-center justify-center font-bold shrink-0">
              <FileSpreadsheet className="w-6.5 h-6.5 stroke-[2]" />
            </div>
            <div>
              <p className="text-base sm:text-lg font-bold text-slate-900">
                {parsedData ? parsedData.fileName : 'คลิกเลือกไฟล์ Excel หรือลากไฟล์มาวางที่นี่'}
              </p>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                {parsedData
                  ? `ประมวลผลแล้ว ${parsedData.records.length} วันตรวจ (${parsedData.totalRowsParsed} แถว)`
                  : 'รองรับไฟล์ Excel แม่แบบ FM-004 กฟผ. (Harness & Lanyard)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-2 px-4.5 py-2.5 bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-colors">
              <UploadCloud className="w-4.5 h-4.5 stroke-[2]" />
              {parsedData ? 'เปลี่ยนไฟล์' : 'เลือกไฟล์ Excel'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filter Dropdowns Grid - เน้นเฉพาะเดือนและปี พ.ศ. ตามที่ผู้ใช้ต้องการ */}
      <div className="pt-1">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-base sm:text-lg font-bold text-[#1e3a8a] flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-[#1e3a8a] text-[#fbbf24] flex items-center justify-center text-sm font-bold shadow-2xs">
              2
            </span>
            <span>เลือกเดือนและปีสำหรับออกรายงาน</span>
          </h2>
          <span className="text-xs sm:text-sm text-slate-500 font-medium hidden sm:inline">
            * ระบบผูกข้อมูลอุปกรณ์และผู้ตรวจตามวันให้อัตโนมัติ
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* เดือน */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors shadow-2xs">
            <label className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-700 mb-2">
              <Calendar className="w-4 h-4 text-[#1e3a8a]" />
              เดือน <span className="text-red-500">*</span>
            </label>
            <select
              id="select-month"
              value={filters.month}
              onChange={(e) => onFilterChange({ month: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm sm:text-base border border-slate-200 focus:border-[#1e3a8a] rounded-xl bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none font-semibold text-slate-800 cursor-pointer"
            >
              <option value="">-- เลือกเดือน --</option>
              {THAI_MONTHS.map((m) => {
                const count = (parsedData?.records || []).filter(
                  (r) => r.month === m && (!filters.year || String(r.year) === String(filters.year))
                ).length;
                return (
                  <option key={m} value={m}>
                    {m} {count > 0 ? `(${count} วันที่มีข้อมูลตรวจ)` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* ปี พ.ศ. */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors shadow-2xs">
            <label className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-700 mb-2">
              <Calendar className="w-4 h-4 text-[#1e3a8a]" />
              ปี (พ.ศ.) <span className="text-red-500">*</span>
            </label>
            <select
              id="select-year"
              value={filters.year}
              onChange={(e) => onFilterChange({ year: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm sm:text-base border border-slate-200 focus:border-[#1e3a8a] rounded-xl bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none font-semibold text-slate-800 cursor-pointer"
            >
              <option value="">-- เลือกปี พ.ศ. --</option>
              {Array.from(
                new Set([
                  ...(parsedData?.availableYears || []),
                  '2569',
                  '2568',
                  '2567',
                ])
              )
                .sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
                .map((y) => {
                  const count = (parsedData?.records || []).filter(
                    (r) => String(r.year) === String(y)
                  ).length;
                  return (
                    <option key={y} value={y}>
                      พ.ศ. {y} {count > 0 ? `(${count} วัน)` : ''}
                    </option>
                  );
                })}
            </select>
          </div>
        </div>

        {/* Quick Month/Year Switcher Chips from uploaded Excel */}
        {parsedData && parsedData.records.length > 0 && (() => {
          const uniquePeriods: { month: string; year: string; count: number }[] = [];
          const seen = new Set<string>();
          for (const r of parsedData.records) {
            const key = `${r.year}:::${r.month}`;
            if (!seen.has(key)) {
              seen.add(key);
              const count = parsedData.records.filter((rec) => String(rec.year) === String(r.year) && rec.month === r.month).length;
              uniquePeriods.push({ month: r.month, year: r.year, count });
            }
          }
          uniquePeriods.sort((a, b) => {
            const yA = parseInt(a.year, 10) || 0;
            const yB = parseInt(b.year, 10) || 0;
            if (yA !== yB) return yA - yB;
            return THAI_MONTHS.indexOf(a.month) - THAI_MONTHS.indexOf(b.month);
          });

          if (uniquePeriods.length <= 1) return null;

          return (
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-medium shrink-0">เดือนที่ตรวจพบในไฟล์:</span>
              {uniquePeriods.map((p) => {
                const isSelected = filters.month === p.month && String(filters.year) === String(p.year);
                return (
                  <button
                    key={`${p.year}-${p.month}`}
                    type="button"
                    onClick={() => onFilterChange({ month: p.month, year: p.year })}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                      isSelected
                        ? 'bg-amber-100 text-amber-900 border-amber-400 font-semibold shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {p.month} {p.year} ({p.count} วัน)
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* 3. รายการผู้ตรวจสอบ */}
      <div className="pt-1">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-all shadow-2xs">
          {/* Header Row: Always visible with summary & Expand Button */}
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-7 h-7 rounded-lg bg-[#1e3a8a] text-[#fbbf24] flex items-center justify-center text-sm font-bold shadow-2xs shrink-0">
                3
              </span>
              <span className="text-base sm:text-lg font-bold text-[#1e3a8a]">
                ข้อมูลผู้ตรวจสอบ
              </span>
              <span className="text-xs sm:text-sm px-3 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 font-semibold">
                {monthInspectorNamesSet.size > 0
                  ? `พบ ${monthInspectorNamesSet.size} ท่านในเดือนนี้`
                  : `มี ${inspectors.length} ท่าน`}
              </span>
              <span className="text-xs sm:text-sm text-slate-500 font-medium hidden md:inline">
                (ชื่อดึงตรงจากไฟล์ต้นทาง • ลายเซ็นลงตามวันตรวจอัตโนมัติ)
              </span>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              {/* Button to toggle expanding inspector list */}
              <button
                type="button"
                id="btn-toggle-inspectors-list"
                onClick={() => setIsInspectorsExpanded((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
                title={isInspectorsExpanded ? 'ซ่อนรายชื่อผู้ตรวจสอบ' : 'ขยายดูรายชื่อผู้ตรวจสอบและลายเซ็น'}
              >
                {isInspectorsExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                    <span>ซ่อนรายชื่อ</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                    <span>ดูรายชื่อผู้ตรวจ ({inspectors.length})</span>
                  </>
                )}
              </button>

              {/* Manage Signatures Modal Button */}
              <button
                type="button"
                id="btn-manage-inspectors-panel"
                onClick={onOpenInspectorModal}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#1e3a8a] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <UserCheck className="w-4 h-4 text-amber-600" />
                <span>จัดการลายเซ็น</span>
              </button>
            </div>
          </div>

          {/* Expandable Inspector List Details */}
          {isInspectorsExpanded && (
            <div className="px-4 sm:px-5 pb-5 pt-3 border-t border-slate-100 space-y-3.5 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อผู้ตรวจสอบ..."
                    value={inspectorSearchQuery}
                    onChange={(e) => setInspectorSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 placeholder-slate-400 focus:border-[#1e3a8a] focus:outline-none font-medium"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 font-medium">
                  <span>* คลิกที่ชื่อเพื่อเลือกกรองเฉพาะผู้ตรวจท่านนั้น</span>
                </div>
              </div>

              {/* Badges List */}
              <div className="flex items-center gap-2.5 flex-wrap pt-1">
                {displayedInspectors.length === 0 ? (
                  <span className="text-xs sm:text-sm text-slate-500">
                    {inspectorSearchQuery ? `ไม่พบผู้ตรวจที่ตรงกับ "${inspectorSearchQuery}"` : 'ยังไม่พบรายชื่อผู้ตรวจในไฟล์'}
                  </span>
                ) : (
                  displayedInspectors.map((insp) => {
                    const normName = normalizeInspectorName(insp.name);
                    const normKey = normName.toLowerCase();
                    const hasSig = Boolean(insp.signatureDataUrl);
                    const isCurrentMonth = monthInspectorNamesSet.has(normName) || monthInspectorNamesSet.size === 0;
                    const countInMonth = inspectorCountsMap.get(normKey) || 0;
                    const isFilterSelected = filters.selectedInspectorId === insp.id;

                    return (
                      <div
                        key={insp.id}
                        onClick={() => {
                          if (filters.selectedInspectorId === insp.id) {
                            onFilterChange({ selectedInspectorId: '' });
                          } else {
                            onFilterChange({ selectedInspectorId: insp.id });
                          }
                        }}
                        className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs sm:text-sm cursor-pointer transition-colors ${
                          isFilterSelected
                            ? 'bg-blue-50 text-[#1e3a8a] border-blue-400 font-semibold shadow-2xs'
                            : hasSig
                            ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            : 'bg-amber-50/80 border-amber-300 text-amber-900 hover:bg-amber-100'
                        } ${!isCurrentMonth && !isFilterSelected ? 'opacity-50' : ''}`}
                        title={
                          isFilterSelected
                            ? 'คลิกเพื่อยกเลิกการเลือก'
                            : `คลิกเพื่อกรองเฉพาะ ${insp.name}`
                        }
                      >
                        <span className="font-semibold">{insp.name}</span>
                        {countInMonth > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                            {countInMonth} วัน
                          </span>
                        )}
                        {hasSig ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.2]" /> มีลายเซ็น
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-800 font-bold">
                            <AlertCircle className="w-3.5 h-3.5 stroke-[2.2]" /> รอลายเซ็น
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Data Summary Alert Banner */}
      {parsedData && (
        <div
          id="data-summary-box"
          className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-slate-700 shadow-2xs"
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-bold text-slate-900">สรุปข้อมูล:</span>
            <span className="font-semibold text-slate-800">พบรายการตรวจ {filteredRecords.length} รายการ</span>
            {checkedDays.length > 0 ? (
              <span className="bg-blue-50 text-[#1e3a8a] border border-blue-200 px-3 py-1 rounded-md font-bold text-xs sm:text-sm">
                วันที่ตรวจ: {checkedDays.join(', ')} {filters.month} {filters.year} (รวม {checkedDays.length} วัน)
              </span>
            ) : (
              <span className="text-amber-800 font-bold">
                (ไม่พบวันที่ตรวจในเดือน/ปีที่เลือก)
              </span>
            )}
          </div>
          <div className="text-xs sm:text-sm text-slate-500 font-medium">
            * ช่องวันที่ไม่มีการตรวจจะเว้นว่างใน PDF อัตโนมัติ
          </div>
        </div>
      )}

      {/* 5. Validation Alert Box before Generation */}
      {!canGenerate && validationErrors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-xs sm:text-sm text-red-900 font-medium">
          <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-red-950">ข้อกำหนดก่อนสร้างเอกสาร:</span>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 6. Action Buttons - ตัวเลือกสร้าง Word & PDF ให้ปุ่มใหญ่ คมชัด อ่านง่าย */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3.5 border-t border-slate-100">
        {/* พิมพ์เอกสาร */}
        <button
          type="button"
          id="btn-print-preview"
          onClick={onPrintPreview}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4.5 py-3 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
        >
          <Printer className="w-4.5 h-4.5 text-slate-500" />
          <span>พิมพ์เอกสาร (Print)</span>
        </button>

        {/* ตัวทำเป็น Word (.docx) */}
        <button
          type="button"
          id="btn-generate-word"
          disabled={!canGenerate || isGeneratingDocx}
          onClick={onGenerateDocx}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5.5 py-3 text-sm sm:text-base font-bold rounded-xl border transition-colors ${
            canGenerate && !isGeneratingDocx
              ? 'bg-white hover:bg-blue-50/60 text-[#1e3a8a] border-blue-200 cursor-pointer shadow-2xs hover:border-blue-300'
              : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
          }`}
          title="สร้างไฟล์ Word (.docx) 13pt พอดีหน้า A4 แนวนอน"
        >
          {isGeneratingDocx ? (
            <>
              <RefreshCw className="w-4.5 h-4.5 animate-spin text-[#1e3a8a]" />
              <span>กำลังสร้าง Word...</span>
            </>
          ) : (
            <>
              <FileText className="w-4.5 h-4.5 text-[#1e3a8a]" />
              <span className="font-bold text-[#1e3a8a]">ดาวน์โหลด Word (.docx)</span>
            </>
          )}
        </button>

        {/* ตัวทำเป็น PDF (.pdf) - EGAT Navy Blue Button */}
        <button
          type="button"
          id="btn-generate-pdf"
          disabled={!canGenerate || isGeneratingPdf}
          onClick={onGeneratePdf}
          className={`w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3 text-sm sm:text-base font-bold rounded-xl transition-colors ${
            canGenerate && !isGeneratingPdf
              ? 'bg-[#1e3a8a] hover:bg-[#1e40af] active:bg-[#172554] text-white cursor-pointer shadow-xs'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
          }`}
          title="สร้างไฟล์ PDF A4 แนวนอน ลายเซ็นครบถ้วนตรงตามวันตรวจ"
        >
          {isGeneratingPdf ? (
            <>
              <RefreshCw className="w-4.5 h-4.5 animate-spin text-white" />
              <span>{generationProgressText || 'กำลังสร้าง PDF...'}</span>
            </>
          ) : (
            <>
              <FileDown className="w-4.5 h-4.5 text-white stroke-[2.3]" />
              <span>ดาวน์โหลด PDF (A4 13.5pt)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
