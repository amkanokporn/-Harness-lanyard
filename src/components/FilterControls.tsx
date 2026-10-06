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
  Layers,
  UserCheck,
  FileDown,
  Printer,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { normalizeInspectorName } from '../utils/inspectionAggregation';
import { fuzzyFilterInspectors } from '../utils/thaiNameNormalizer';

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

  // Precomputed inspector day counts for current filtered records (O(1) lookups)
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

  // Memoized filtered inspectors for display in badges based on search query
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
    <div id="filter-controls-panel" className="bg-white rounded-2xl border-2 border-blue-900/20 shadow-md p-5 sm:p-6 space-y-5">
      {/* 1. File Upload & Source Status */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-950">
            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>
            1. ข้อมูลนำเข้า (Excel Data Source)
          </label>
          {parsedData && (
            <span className="text-[11px] font-semibold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              โหลดข้อมูลสำเร็จ
            </span>
          )}
        </div>

        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-blue-200 hover:border-yellow-400 bg-blue-50/30 hover:bg-yellow-50/30 rounded-xl p-4 transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv"
            className="hidden"
            id="file-input-excel"
          />

          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-950 text-yellow-400 flex items-center justify-center font-bold shrink-0 shadow-sm">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-950">
                {parsedData ? parsedData.fileName : 'คลิกเพื่อเลือกไฟล์ Excel (.xlsx) หรือลากไฟล์มาวางที่นี่'}
              </p>
              <p className="text-xs text-slate-600">
                {parsedData
                  ? `ประมวลผลแล้ว ${parsedData.records.length} วันตรวจ (พบข้อมูล ${parsedData.totalRowsParsed} แถวในไฟล์)`
                  : 'รองรับไฟล์ Excel ตารางรวม Full Body Harness & Lanyard'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-yellow-400 hover:bg-yellow-300 text-blue-950 rounded-xl text-xs font-bold shadow-xs transition-colors">
              <UploadCloud className="w-4 h-4 text-blue-950" />
              {parsedData ? 'เปลี่ยนไฟล์ Excel' : 'เลือกไฟล์ Excel'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filter Grid (Without Plant) */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-950 mb-2.5">
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>
          2. ตัวกรองและกำหนดค่ารายงาน (Report Filters)
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* เดือน */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-blue-950 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-700" />
              เดือน <span className="text-red-500">*</span>
            </label>
            <select
              id="select-month"
              value={filters.month}
              onChange={(e) => onFilterChange({ month: e.target.value })}
              className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-slate-200 focus:border-blue-900 rounded-xl bg-white focus:ring-2 focus:ring-yellow-400/50 focus:outline-none font-medium text-slate-800"
            >
              <option value="">-- เลือกเดือน --</option>
              {THAI_MONTHS.map((m) => {
                const count = (parsedData?.records || []).filter(
                  (r) => r.month === m && (!filters.year || String(r.year) === String(filters.year))
                ).length;
                return (
                  <option key={m} value={m}>
                    {m} {count > 0 ? `(มีข้อมูล ${count} วันตรวจ)` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* ปี พ.ศ. */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-blue-950 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-700" />
              ปี (พ.ศ.) <span className="text-red-500">*</span>
            </label>
            <select
              id="select-year"
              value={filters.year}
              onChange={(e) => onFilterChange({ year: e.target.value })}
              className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-slate-200 focus:border-blue-900 rounded-xl bg-white focus:ring-2 focus:ring-yellow-400/50 focus:outline-none font-medium text-slate-800"
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
                      พ.ศ. {y} {count > 0 ? `(มีข้อมูล ${count} วันตรวจ)` : ''}
                    </option>
                  );
                })}
            </select>
          </div>

          {/* ประเภทอุปกรณ์ */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-blue-950 mb-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-700" />
              ประเภทอุปกรณ์
            </label>
            <select
              id="select-equipment-type"
              value={filters.equipmentType}
              onChange={(e) =>
                onFilterChange({ equipmentType: e.target.value as 'all' | EquipmentType })
              }
              className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-slate-200 focus:border-blue-900 rounded-xl bg-white focus:ring-2 focus:ring-yellow-400/50 focus:outline-none font-medium text-slate-800"
            >
              <option value="all">ทั้งหมด (Harness + Lanyard / 2 หน้า)</option>
              <option value="harness">เฉพาะ Full Body Harness (หน้า 1)</option>
              <option value="lanyard">เฉพาะ Lanyard (หน้า 2)</option>
            </select>
          </div>

          {/* ผู้ตรวจสอบ */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-blue-950 mb-1.5">
              <UserCheck className="w-3.5 h-3.5 text-blue-700" />
              ผู้ตรวจสอบ (Inspector)
            </label>
            <select
              id="select-inspector"
              value={filters.selectedInspectorId}
              onChange={(e) => onFilterChange({ selectedInspectorId: e.target.value })}
              className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-slate-200 focus:border-blue-900 rounded-xl bg-white focus:ring-2 focus:ring-yellow-400/50 focus:outline-none font-medium text-slate-800"
            >
              <option value="">-- ผู้ตรวจสอบทั้งหมด (ภาพรวม) --</option>
              {inspectors.map((insp) => {
                const count = inspectorCountsMap.get(normalizeInspectorName(insp.name).toLowerCase()) || 0;
                const aliasNotice =
                  insp.aliases && insp.aliases.length > 0
                    ? ` [รวมชื่อ ${insp.aliases.length}]`
                    : '';
                return (
                  <option key={insp.id} value={insp.id}>
                    {insp.name} {count > 0 ? `(ตรวจ ${count} วัน)` : ''}{aliasNotice}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Quick Month/Year Switcher Pills for all detected historical periods */}
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
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2 flex-wrap text-xs">
              <span className="text-blue-950 font-bold shrink-0">ข้อมูลในไฟล์ (คลิกเลือกดูได้ทันที):</span>
              {uniquePeriods.map((p) => {
                const isSelected = filters.month === p.month && String(filters.year) === String(p.year);
                return (
                  <button
                    key={`${p.year}-${p.month}`}
                    type="button"
                    onClick={() => onFilterChange({ month: p.month, year: p.year })}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-950 text-yellow-400 border-yellow-400 shadow-sm'
                        : 'bg-blue-50 text-blue-950 border-blue-200 hover:bg-yellow-100 hover:border-yellow-400'
                    }`}
                  >
                    {p.month} {p.year} <span className="opacity-80 text-[11px]">({p.count} วัน)</span>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* 3. Real-Data Inspectors Signature Overview */}
      <div className="pt-2 border-t border-slate-200">
        <div className="flex flex-col gap-3.5 bg-gradient-to-r from-blue-950 via-blue-900 to-slate-900 p-4 sm:p-5 rounded-2xl text-white border border-yellow-400/30 shadow-inner">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-7 h-7 rounded-lg bg-yellow-400 text-blue-950 flex items-center justify-center font-bold shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white tracking-wide">
                ผู้ตรวจสอบจากข้อมูลจริง ({monthInspectorNamesSet.size > 0 ? `พบ ${monthInspectorNamesSet.size} ท่านในเดือนนี้` : `ทั้งหมด ${inspectors.length} ท่าน`})
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400/20 text-yellow-300 border border-yellow-400/40">
                <Sparkles className="w-3 h-3 text-yellow-400" /> รวมชื่อคล้ายคลึง & แก้คำสะกดผิดอัตโนมัติ
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Inspector Search Input */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อคล้ายคลึง/คำสะกด..."
                  value={inspectorSearchQuery}
                  onChange={(e) => setInspectorSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-blue-700 rounded-xl bg-blue-900/60 text-white placeholder-blue-300/60 focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                />
              </div>

              <button
                type="button"
                id="btn-manage-inspectors-panel"
                onClick={onOpenInspectorModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-blue-950 bg-yellow-400 hover:bg-yellow-300 border border-yellow-300 rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-950" />
                <span>จัดการลายเซ็น</span>
              </button>
            </div>
          </div>

          {/* List of inspector badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {displayedInspectors.length === 0 ? (
              <span className="text-xs text-blue-200">
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
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      isFilterSelected
                        ? 'bg-yellow-400 text-blue-950 border-yellow-300 shadow-md font-bold ring-2 ring-yellow-300/50'
                        : hasSig
                        ? 'bg-blue-900/80 border-blue-700/80 text-white hover:border-yellow-400 hover:bg-blue-800'
                        : 'bg-amber-950/60 border-amber-500/50 text-amber-200 hover:bg-amber-900/70'
                    } ${!isCurrentMonth && !isFilterSelected ? 'opacity-60' : ''}`}
                    title={
                      isFilterSelected
                        ? 'คลิกเพื่อยกเลิกการเลือก'
                        : `คลิกเพื่อกรองเฉพาะ ${insp.name}`
                    }
                  >
                    <span>{insp.name}</span>
                    {countInMonth > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          isFilterSelected
                            ? 'bg-blue-950 text-yellow-300'
                            : 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30'
                        }`}
                      >
                        {countInMonth} วัน
                      </span>
                    )}
                    {insp.aliases && insp.aliases.length > 0 && (
                      <span
                        className={`text-[10px] px-1 py-0.2 rounded font-medium ${
                          isFilterSelected
                            ? 'bg-blue-900 text-white'
                            : 'bg-blue-950 text-blue-200 border border-blue-800'
                        }`}
                        title={`รวมชื่อที่สะกดผิด/คล้ายกัน: ${insp.aliases.join(', ')}`}
                      >
                        รวม {insp.aliases.length} ชื่อ
                      </span>
                    )}
                    {hasSig ? (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                          isFilterSelected ? 'text-blue-950' : 'text-emerald-400'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> มีลายเซ็น
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                          isFilterSelected ? 'text-blue-950' : 'text-yellow-400'
                        }`}
                      >
                        <AlertCircle className="w-3.5 h-3.5" /> รอลายเซ็น
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 4. Data Summary Banner */}
      {parsedData && (
        <div
          id="data-summary-box"
          className="p-3.5 bg-yellow-50/80 border border-yellow-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-950"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-blue-950">ผลการประมวลผลข้อมูล:</span>
            <span>พบข้อมูลการตรวจสอบ {filteredRecords.length} รายการ</span>
            {checkedDays.length > 0 ? (
              <span className="bg-blue-950 text-yellow-300 px-2 py-0.5 rounded-md font-bold">
                วันที่ตรวจในไฟล์: วันที่ {checkedDays.join(', ')} {filters.month} {filters.year} (รวม {checkedDays.length} วัน)
              </span>
            ) : (
              <span className="text-amber-800 font-bold">
                (ไม่พบวันที่ตรวจในเดือน/ปีที่เลือก)
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-600">
            * ช่องวันที่ที่ไม่มีข้อมูลใน Excel จะถูกเว้นว่างใน PDF โดยอัตโนมัติตามข้อกำหนด
          </div>
        </div>
      )}

      {/* 5. Validation Alert Box before Generation */}
      {!canGenerate && validationErrors.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">ข้อกำหนดก่อนสร้าง PDF:</span>
            <ul className="list-disc list-inside mt-0.5 space-y-0.5">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 6. Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
        <button
          type="button"
          id="btn-print-preview"
          onClick={onPrintPreview}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          พิมพ์เอกสาร (Print)
        </button>

        {/* Export Word (.docx) Button */}
        <button
          type="button"
          id="btn-generate-word"
          disabled={!canGenerate || isGeneratingDocx}
          onClick={onGenerateDocx}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl border-2 transition-all ${
            canGenerate && !isGeneratingDocx
              ? 'bg-blue-900 hover:bg-blue-800 text-white border-blue-950 cursor-pointer shadow-sm'
              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
          }`}
        >
          {isGeneratingDocx ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-yellow-400" />
              <span>กำลังสร้าง Word...</span>
            </>
          ) : (
            <>
              <FileSpreadsheet className="w-4 h-4 text-yellow-400" />
              <span>ดาวน์โหลด Word (.docx)</span>
            </>
          )}
        </button>

        {/* Export PDF Button - High Contrast Yellow Button */}
        <button
          type="button"
          id="btn-generate-pdf"
          disabled={!canGenerate || isGeneratingPdf}
          onClick={onGeneratePdf}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all ${
            canGenerate && !isGeneratingPdf
              ? 'bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-blue-950 cursor-pointer border-2 border-yellow-300 shadow-yellow-500/20'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
          }`}
        >
          {isGeneratingPdf ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-blue-950" />
              <span>{generationProgressText || 'กำลังสร้าง PDF...'}</span>
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4 text-blue-950" />
              <span>สร้างเอกสาร PDF (Generate PDF)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
