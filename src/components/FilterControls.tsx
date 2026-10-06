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
  Check,
  FileText,
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
    <div id="filter-controls-panel" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      {/* 1. File Upload & Source Status */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg sm:text-xl font-bold text-blue-950 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-blue-950 text-yellow-400 flex items-center justify-center text-sm font-bold shadow-xs">
              1
            </span>
            <span>นำเข้าข้อมูลการตรวจสอบ (Excel Source)</span>
          </h2>
          {parsedData && (
            <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-1 rounded-full flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              พร้อมใช้งาน
            </span>
          )}
        </div>

        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-blue-200 hover:border-yellow-500 bg-blue-50/30 hover:bg-yellow-50/30 rounded-2xl p-5 sm:p-6 transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left"
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
            <div className="w-14 h-14 rounded-2xl bg-blue-950 text-yellow-400 flex items-center justify-center font-bold shrink-0 shadow-md">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div>
              <p className="text-base sm:text-lg font-bold text-blue-950">
                {parsedData ? parsedData.fileName : 'คลิกเพื่อเลือกไฟล์ Excel หรือลากไฟล์มาวางที่นี่'}
              </p>
              <p className="text-sm sm:text-base text-slate-600 mt-0.5 font-normal">
                {parsedData
                  ? `ประมวลผลแล้ว ${parsedData.records.length} วันตรวจ (ข้อมูลทั้งหมด ${parsedData.totalRowsParsed} แถว)`
                  : 'รองรับไฟล์ Excel ตารางรวม Full Body Harness & Lanyard'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-2 px-5 py-3 bg-yellow-400 hover:bg-yellow-300 text-blue-950 rounded-xl text-sm sm:text-base font-bold shadow-xs transition-all">
              <UploadCloud className="w-5 h-5 text-blue-950 stroke-[2.5]" />
              {parsedData ? 'เปลี่ยนไฟล์ Excel' : 'เลือกไฟล์ Excel'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filter Grid */}
      <div className="pt-2">
        <h2 className="text-lg sm:text-xl font-bold text-blue-950 flex items-center gap-2.5 mb-3.5">
          <span className="w-8 h-8 rounded-xl bg-blue-950 text-yellow-400 flex items-center justify-center text-sm font-bold shadow-xs">
            2
          </span>
          <span>เลือกเงื่อนไขรายงาน (Report Options)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* เดือน */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <label className="flex items-center gap-2 text-sm sm:text-base font-bold text-blue-950 mb-2">
              <Calendar className="w-4 h-4 text-blue-700" />
              เดือน <span className="text-red-500">*</span>
            </label>
            <select
              id="select-month"
              value={filters.month}
              onChange={(e) => onFilterChange({ month: e.target.value })}
              className="w-full px-3.5 py-3 text-base border border-slate-300 focus:border-blue-900 rounded-xl bg-white focus:ring-2 focus:ring-yellow-400/50 focus:outline-none font-medium text-slate-900 shadow-xs"
            >
              <option value="">-- เลือกเดือน --</option>
              {THAI_MONTHS.map((m) => {
                const count = (parsedData?.records || []).filter(
                  (r) => r.month === m && (!filters.year || String(r.year) === String(filters.year))
                ).length;
                return (
                  <option key={m} value={m}>
                    {m} {count > 0 ? `(${count} วันตรวจ)` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* ปี พ.ศ. */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <label className="flex items-center gap-2 text-sm sm:text-base font-bold text-blue-950 mb-2">
              <Calendar className="w-4 h-4 text-blue-700" />
              ปี (พ.ศ.) <span className="text-red-500">*</span>
            </label>
            <select
              id="select-year"
              value={filters.year}
              onChange={(e) => onFilterChange({ year: e.target.value })}
              className="w-full px-3.5 py-3 text-base border border-slate-300 focus:border-blue-900 rounded-xl bg-white focus:ring-2 focus:ring-yellow-400/50 focus:outline-none font-medium text-slate-900 shadow-xs"
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

          {/* ประเภทอุปกรณ์ */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <label className="flex items-center gap-2 text-sm sm:text-base font-bold text-blue-950 mb-2">
              <Layers className="w-4 h-4 text-blue-700" />
              ประเภทอุปกรณ์
            </label>
            <select
              id="select-equipment-type"
              value={filters.equipmentType}
              onChange={(e) =>
                onFilterChange({ equipmentType: e.target.value as 'all' | EquipmentType })
              }
              className="w-full px-3.5 py-3 text-base border border-slate-300 focus:border-blue-900 rounded-xl bg-white focus:ring-2 focus:ring-yellow-400/50 focus:outline-none font-medium text-slate-900 shadow-xs"
            >
              <option value="all">ทั้งหมด (Harness + Lanyard)</option>
              <option value="harness">เฉพาะ Full Body Harness</option>
              <option value="lanyard">เฉพาะ Lanyard</option>
            </select>
          </div>

          {/* ผู้ตรวจสอบ */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <label className="flex items-center gap-2 text-sm sm:text-base font-bold text-blue-950 mb-2">
              <UserCheck className="w-4 h-4 text-blue-700" />
              กรองตามผู้ตรวจสอบ
            </label>
            <select
              id="select-inspector"
              value={filters.selectedInspectorId}
              onChange={(e) => onFilterChange({ selectedInspectorId: e.target.value })}
              className="w-full px-3.5 py-3 text-base border border-slate-300 focus:border-blue-900 rounded-xl bg-white focus:ring-2 focus:ring-yellow-400/50 focus:outline-none font-medium text-slate-900 shadow-xs"
            >
              <option value="">-- ผู้ตรวจทั้งหมด (รวม) --</option>
              {inspectors.map((insp) => {
                const count = inspectorCountsMap.get(normalizeInspectorName(insp.name).toLowerCase()) || 0;
                return (
                  <option key={insp.id} value={insp.id}>
                    {insp.name} {count > 0 ? `(ตรวจ ${count} วัน)` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Quick Month/Year Switcher Buttons */}
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
            <div className="mt-4 pt-3.5 border-t border-slate-200 flex items-center gap-2.5 flex-wrap">
              <span className="text-sm sm:text-base font-semibold text-slate-700 shrink-0">เลือกดูเดือนในไฟล์:</span>
              {uniquePeriods.map((p) => {
                const isSelected = filters.month === p.month && String(filters.year) === String(p.year);
                return (
                  <button
                    key={`${p.year}-${p.month}`}
                    type="button"
                    onClick={() => onFilterChange({ month: p.month, year: p.year })}
                    className={`px-4 py-2 rounded-xl text-sm sm:text-base font-semibold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-950 text-yellow-300 border-blue-950 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {p.month} {p.year} <span className="opacity-75 text-xs">({p.count} วัน)</span>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* 3. Real-Data Inspectors Signature Overview */}
      <div className="pt-2">
        <div className="flex flex-col gap-4 bg-slate-900 p-5 sm:p-6 rounded-3xl text-white border border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-8 h-8 rounded-xl bg-yellow-400 text-blue-950 flex items-center justify-center text-sm font-bold shrink-0">
                3
              </span>
              <span className="text-base sm:text-lg font-bold text-white tracking-normal">
                ผู้ตรวจสอบและลายเซ็น ({monthInspectorNamesSet.size > 0 ? `พบ ${monthInspectorNamesSet.size} ท่านในเดือนนี้` : `ทั้งหมด ${inspectors.length} ท่าน`})
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                <Sparkles className="w-4 h-4 text-yellow-400" /> รวมชื่อคล้ายคลึง & แก้สะกดผิดอัตโนมัติแล้ว
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Search Input */}
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อผู้ตรวจ..."
                  value={inspectorSearchQuery}
                  onChange={(e) => setInspectorSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-sm sm:text-base border border-slate-700 rounded-xl bg-slate-800 text-white placeholder-slate-400 focus:border-yellow-400 focus:outline-none font-normal"
                />
              </div>

              <button
                type="button"
                id="btn-manage-inspectors-panel"
                onClick={onOpenInspectorModal}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm sm:text-base font-semibold text-blue-950 bg-yellow-400 hover:bg-yellow-300 rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
              >
                <UserCheck className="w-4 h-4 text-blue-950 stroke-[2.5]" />
                <span>จัดการลายเซ็น</span>
              </button>
            </div>
          </div>

          {/* List of inspector badges */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {displayedInspectors.length === 0 ? (
              <span className="text-sm sm:text-base text-slate-400 font-normal">
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
                    className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm sm:text-base font-medium cursor-pointer transition-all ${
                      isFilterSelected
                        ? 'bg-yellow-400 text-blue-950 border-yellow-400 shadow-sm font-bold'
                        : hasSig
                        ? 'bg-slate-800 border-slate-700 text-white hover:border-yellow-400'
                        : 'bg-amber-950/70 border-amber-500/60 text-amber-200 hover:bg-amber-900/80'
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
                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          isFilterSelected
                            ? 'bg-blue-950 text-yellow-300'
                            : 'bg-yellow-400/20 text-yellow-300'
                        }`}
                      >
                        {countInMonth} วัน
                      </span>
                    )}
                    {hasSig ? (
                      <span
                        className={`inline-flex items-center gap-1 text-xs sm:text-sm font-semibold ${
                          isFilterSelected ? 'text-blue-950' : 'text-emerald-400'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> มีลายเซ็น
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 text-xs sm:text-sm font-semibold ${
                          isFilterSelected ? 'text-blue-950' : 'text-yellow-400'
                        }`}
                      >
                        <AlertCircle className="w-4 h-4 stroke-[2.5]" /> รอลายเซ็น
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
          className="p-4 sm:p-5 bg-amber-50/80 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm sm:text-base text-slate-800"
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-bold text-blue-950">สรุปข้อมูลตรวจ:</span>
            <span>พบรายการตรวจ {filteredRecords.length} รายการ</span>
            {checkedDays.length > 0 ? (
              <span className="bg-blue-950 text-yellow-300 px-3 py-1 rounded-lg font-semibold text-sm sm:text-base">
                วันที่ตรวจ: วันที่ {checkedDays.join(', ')} {filters.month} {filters.year} (รวม {checkedDays.length} วัน)
              </span>
            ) : (
              <span className="text-amber-800 font-bold">
                (ไม่พบวันที่ตรวจในเดือน/ปีที่เลือก)
              </span>
            )}
          </div>
          <div className="text-xs sm:text-sm text-slate-500">
            * ช่องวันที่ไม่มีการตรวจจะเว้นว่างใน PDF อัตโนมัติตามแบบฟอร์ม
          </div>
        </div>
      )}

      {/* 5. Validation Alert Box before Generation */}
      {!canGenerate && validationErrors.length > 0 && (
        <div className="p-4 sm:p-5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-sm sm:text-base text-red-900">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5 stroke-[2.5]" />
          <div>
            <span className="font-bold text-base sm:text-lg">ข้อกำหนดก่อนสร้าง PDF / Word:</span>
            <ul className="list-disc list-inside mt-1 space-y-1">
              {validationErrors.map((err, idx) => (
                <li key={idx} className="font-medium">{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 6. Action Buttons - Big, Clean, Legible, Comfortable */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3.5 pt-4 border-t border-slate-200">
        <button
          type="button"
          id="btn-print-preview"
          onClick={onPrintPreview}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 text-sm sm:text-base font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-2xl transition-colors cursor-pointer"
        >
          <Printer className="w-5 h-5" />
          พิมพ์เอกสาร (Print)
        </button>

        {/* Export Word (.docx) Button */}
        <button
          type="button"
          id="btn-generate-word"
          disabled={!canGenerate || isGeneratingDocx}
          onClick={onGenerateDocx}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 text-sm sm:text-base font-semibold rounded-2xl border transition-all ${
            canGenerate && !isGeneratingDocx
              ? 'bg-blue-950 hover:bg-blue-900 text-white border-blue-950 cursor-pointer shadow-sm'
              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
          }`}
        >
          {isGeneratingDocx ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin text-yellow-400" />
              <span>กำลังสร้าง Word...</span>
            </>
          ) : (
            <>
              <FileSpreadsheet className="w-5 h-5 text-yellow-400" />
              <span>ดาวน์โหลด Word (.docx)</span>
            </>
          )}
        </button>

        {/* Export PDF Button - Big Yellow Primary Button */}
        <button
          type="button"
          id="btn-generate-pdf"
          disabled={!canGenerate || isGeneratingPdf}
          onClick={onGeneratePdf}
          className={`w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-3.5 text-base sm:text-lg font-bold rounded-2xl shadow-md transition-all ${
            canGenerate && !isGeneratingPdf
              ? 'bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-blue-950 cursor-pointer border border-yellow-300 shadow-yellow-500/20'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
          }`}
        >
          {isGeneratingPdf ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin text-blue-950" />
              <span>{generationProgressText || 'กำลังสร้าง PDF...'}</span>
            </>
          ) : (
            <>
              <FileDown className="w-5 h-5 text-blue-950 stroke-[2.5]" />
              <span>สร้างเอกสาร PDF (13.5pt)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
