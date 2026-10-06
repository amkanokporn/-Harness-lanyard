import React, { useState, useMemo } from 'react';
import {
  EquipmentItem,
  EquipmentType,
  InspectionRecord,
  Inspector,
} from '../types';
import { PdfReportTemplate } from './PdfReportTemplate';
import { SingleEquipmentReportTemplate } from './SingleEquipmentReportTemplate';
import {
  buildEquipmentPairReports,
  EquipmentPairPageData,
} from '../utils/inspectionAggregation';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  FileText,
  Check,
  Layers,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';

interface ReportPreviewPanelProps {
  plant: string;
  month: string;
  year: string;
  equipmentType: 'all' | EquipmentType;
  harnessEquipment: EquipmentItem[];
  lanyardEquipment: EquipmentItem[];
  records: InspectionRecord[];
  inspector: Inspector | null;
  inspectors?: Inspector[];
  selectedPairIndex?: number | 'all';
  onSelectPairIndex?: (idx: number | 'all') => void;
  onOpenInspectorManager?: () => void;
}

export const ReportPreviewPanel: React.FC<ReportPreviewPanelProps> = ({
  plant,
  month,
  year,
  equipmentType,
  harnessEquipment,
  lanyardEquipment,
  records,
  inspector,
  inspectors = [],
  selectedPairIndex = 0,
  onSelectPairIndex,
  onOpenInspectorManager,
}) => {
  const [viewFormat, setViewFormat] = useState<'pair' | 'matrix'>('pair');
  const [internalPairIndex, setInternalPairIndex] = useState<number | 'all'>(0);
  const [matrixTab, setMatrixTab] = useState<'both' | 'harness' | 'lanyard'>('both');
  const [zoomLevel, setZoomLevel] = useState<number>(0.85);

  const activePairIndex = onSelectPairIndex !== undefined ? selectedPairIndex : internalPairIndex;
  const setPairIndex = onSelectPairIndex || setInternalPairIndex;

  // Registered inspectors
  const allInspectors = useMemo(() => {
    return inspectors.length > 0 ? inspectors : (inspector ? [inspector] : []);
  }, [inspectors, inspector]);

  // Build paired reports (Harness-1 + Lanyard-1, Harness-2 + Lanyard-2, etc.)
  const pairReports: EquipmentPairPageData[] = useMemo(() => {
    return buildEquipmentPairReports(
      records,
      harnessEquipment,
      lanyardEquipment,
      month,
      year,
      allInspectors
    );
  }, [records, harnessEquipment, lanyardEquipment, month, year, allInspectors]);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.1, 1.3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setZoomLevel(0.85);

  // Active pairs to display
  const displayedPairs = useMemo(() => {
    if (activePairIndex === 'all') {
      return pairReports;
    }
    const idx = typeof activePairIndex === 'number' ? activePairIndex : 0;
    return pairReports[idx] ? [pairReports[idx]] : (pairReports.length > 0 ? [pairReports[0]] : []);
  }, [pairReports, activePairIndex]);

  return (
    <div
      id="report-preview-container"
      className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col space-y-5"
    >
      {/* Top Preview Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-950 text-yellow-400 flex items-center justify-center font-bold shrink-0 shadow-md">
            <Eye className="w-7 h-7 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-blue-950 tracking-normal">
                ตัวอย่างเอกสารรายงานจริง (Document Preview)
              </h2>
              <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs sm:text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Sparkles className="w-4 h-4 mr-1 text-emerald-600" /> ลายเซ็นลงตรงตามวันตรวจ
              </span>
            </div>
            <p className="text-sm sm:text-base text-slate-600 mt-0.5 font-normal">
              แบบฟอร์ม FM-004/QP-PB-013 กฟผ. (ขนาด A4 แนวนอน • ฟอนต์ TH Sarabun New 13.5pt พอดี 1 หน้า)
            </p>
          </div>
        </div>

        {/* View Mode & Zoom Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* Layout Mode Switcher */}
          <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex items-center gap-1.5 text-sm sm:text-base">
            <button
              type="button"
              id="tab-mode-pair"
              onClick={() => setViewFormat('pair')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer font-semibold flex items-center gap-2 ${
                viewFormat === 'pair'
                  ? 'bg-blue-950 text-yellow-300 shadow-xs'
                  : 'text-slate-700 hover:text-blue-950 hover:bg-slate-200/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>รายชุดอุปกรณ์ (Word Layout)</span>
            </button>
            <button
              type="button"
              id="tab-mode-matrix"
              onClick={() => setViewFormat('matrix')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer font-semibold flex items-center gap-2 ${
                viewFormat === 'matrix'
                  ? 'bg-blue-950 text-yellow-300 shadow-xs'
                  : 'text-slate-700 hover:text-blue-950 hover:bg-slate-200/60'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>ตารางรวม (Matrix)</span>
            </button>
          </div>

          {/* Zoom Buttons */}
          <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex items-center gap-1 text-sm sm:text-base">
            <button
              type="button"
              id="btn-zoom-out"
              onClick={handleZoomOut}
              className="p-2 text-slate-700 hover:text-blue-950 rounded-xl hover:bg-slate-200 transition-colors"
              title="ย่อขนาด"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs sm:text-sm font-mono font-bold text-blue-950 min-w-[42px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              id="btn-zoom-in"
              onClick={handleZoomIn}
              className="p-2 text-slate-700 hover:text-blue-950 rounded-xl hover:bg-slate-200 transition-colors"
              title="ขยายขนาด"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              id="btn-zoom-reset"
              onClick={handleResetZoom}
              className="p-2 text-slate-700 hover:text-blue-950 rounded-xl hover:bg-slate-200 transition-colors"
              title="ขนาดพอดีจอ"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Equipment Pair Tabs (When in Pair Mode) */}
      {viewFormat === 'pair' && (
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap overflow-x-auto py-1">
            <span className="text-sm sm:text-base font-bold text-blue-950 flex items-center gap-1.5 pl-1">
              <Layers className="w-4 h-4 text-blue-800" /> ชุดอุปกรณ์:
            </span>
            {pairReports.map((pair, idx) => {
              const isSelected = activePairIndex === idx;
              const hasData = pair.hasAnyInspection;
              const harnessName = pair.harnessData.equipment.name || `Harness-${pair.setLabel || pair.pairNumber}`;
              const lanyardName = pair.lanyardData.equipment.name || `Lanyard-${pair.setLabel || pair.pairNumber}`;
              const daysCount = pair.totalInspectionDays || 0;

              return (
                <button
                  key={pair.pairNumber}
                  type="button"
                  id={`select-pair-tab-${pair.pairNumber}`}
                  onClick={() => setPairIndex(idx)}
                  className={`px-4 py-2 rounded-xl text-sm sm:text-base font-semibold transition-all cursor-pointer flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-blue-950 text-yellow-300 border-blue-950 shadow-sm'
                      : hasData
                      ? 'bg-white text-slate-800 hover:bg-blue-50 border-slate-300'
                      : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200/70'
                  }`}
                >
                  <span>ชุดที่ {pair.setLabel || pair.pairNumber}</span>
                  <span className="text-xs opacity-80">
                    ({harnessName.replace(/Harness-/i, 'H-').replace(/[✓√✔]/g, '').trim()} / {lanyardName.replace(/Lanyard-/i, 'L-').replace(/[✓√✔]/g, '').trim()})
                  </span>
                  {hasData ? (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        isSelected
                          ? 'bg-yellow-400 text-blue-950'
                          : 'bg-blue-100 text-blue-900 border border-blue-200'
                      }`}
                      title={`ตรวจ ${daysCount} วัน`}
                    >
                      {daysCount} วัน
                    </span>
                  ) : (
                    <span className="text-xs opacity-40">0 วัน</span>
                  )}
                </button>
              );
            })}

            <button
              type="button"
              id="select-pair-tab-all"
              onClick={() => setPairIndex('all')}
              className={`px-4 py-2 rounded-xl text-sm sm:text-base font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                activePairIndex === 'all'
                  ? 'bg-blue-950 text-yellow-300 border-blue-950 shadow-sm'
                  : 'bg-white text-blue-950 hover:bg-yellow-50 border-yellow-400/60'
              }`}
            >
              <span>แสดงทั้งหมดทุกชุด ({pairReports.length} หน้า)</span>
            </button>
          </div>
        </div>
      )}

      {/* Matrix Sub-tabs (When in Matrix Mode) */}
      {viewFormat === 'matrix' && (
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
          <span className="text-xs sm:text-sm font-semibold text-slate-600 pl-1">เลือกหน้าตารางรวม:</span>
          <button
            type="button"
            onClick={() => setMatrixTab('both')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer ${
              matrixTab === 'both' ? 'bg-blue-950 text-white' : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            ทั้ง 2 หน้า
          </button>
          <button
            type="button"
            onClick={() => setMatrixTab('harness')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer ${
              matrixTab === 'harness' ? 'bg-blue-950 text-white' : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            เฉพาะ Harness (12 รายการ)
          </button>
          <button
            type="button"
            onClick={() => setMatrixTab('lanyard')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer ${
              matrixTab === 'lanyard' ? 'bg-blue-950 text-white' : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            เฉพาะ Lanyard (10 รายการ)
          </button>
        </div>
      )}

      {/* Preview Stage Area with Scale */}
      <div
        id="preview-viewport"
        className="w-full bg-slate-800 rounded-2xl p-4 sm:p-8 overflow-auto border border-slate-700 min-h-[550px] flex flex-col items-center gap-8 shadow-inner"
      >
        {viewFormat === 'pair' ? (
          /* Single Equipment Pair Pages */
          displayedPairs.map((pair) => {
            return (
              <div key={pair.pairNumber} className="flex flex-col items-center">
                <div className="mb-2.5 flex items-center justify-between w-full max-w-[1122px] text-xs sm:text-sm text-slate-300 font-medium px-1">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-yellow-400" />
                    <span className="font-semibold text-white">
                      {pair.pairLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs sm:text-sm text-blue-200">
                    <span>
                      Harness ตรวจ {pair.harnessData.inspectedDays.length} วัน
                    </span>
                    <span>•</span>
                    <span>
                      Lanyard ตรวจ {pair.lanyardData.inspectedDays.length} วัน
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'top center',
                    marginBottom:
                      zoomLevel < 1
                        ? `-${(1 - zoomLevel) * 793}px`
                        : `${(zoomLevel - 1) * 793}px`,
                  }}
                  className="transition-transform duration-150 shadow-2xl rounded-sm"
                >
                  <SingleEquipmentReportTemplate
                    pageData={pair}
                    idPrefix="single-report-page"
                    onDaySignatureClick={(eqType, day, inspName) => {
                      if (onOpenInspectorManager) {
                        onOpenInspectorManager();
                      }
                    }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          /* Matrix Mode Pages */
          <>
            {(matrixTab === 'both' || matrixTab === 'harness') && (
              <div className="flex flex-col items-center">
                <div className="mb-2 flex items-center gap-2 text-xs sm:text-sm text-slate-300 font-medium">
                  <FileText className="w-4 h-4 text-yellow-400" />
                  <span>หน้าที่ 1 : ตารางรวม Full Body Harness (12 รายการ)</span>
                </div>
                <div
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'top center',
                    marginBottom:
                      zoomLevel < 1
                        ? `-${(1 - zoomLevel) * 764}px`
                        : `${(zoomLevel - 1) * 764}px`,
                  }}
                  className="transition-transform duration-150 shadow-2xl rounded-sm"
                >
                  <PdfReportTemplate
                    equipmentType="harness"
                    plant={plant}
                    month={month}
                    year={year}
                    equipmentList={harnessEquipment}
                    records={records}
                    inspector={inspector}
                    inspectors={inspectors}
                    idPrefix="master-template-page"
                  />
                </div>
              </div>
            )}

            {(matrixTab === 'both' || matrixTab === 'lanyard') && (
              <div className="flex flex-col items-center">
                <div className="mb-2 flex items-center gap-2 text-xs sm:text-sm text-slate-300 font-medium">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>หน้าที่ 2 : ตารางรวม Lanyard (10 รายการ)</span>
                </div>
                <div
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'top center',
                    marginBottom:
                      zoomLevel < 1
                        ? `-${(1 - zoomLevel) * 764}px`
                        : `${(zoomLevel - 1) * 764}px`,
                  }}
                  className="transition-transform duration-150 shadow-2xl rounded-sm"
                >
                  <PdfReportTemplate
                    equipmentType="lanyard"
                    plant={plant}
                    month={month}
                    year={year}
                    equipmentList={lanyardEquipment}
                    records={records}
                    inspector={inspector}
                    inspectors={inspectors}
                    idPrefix="master-template-page"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Notes & Inspector Information */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm text-slate-600 px-1 pt-1">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
          <span>
            แยกตามเลขที่อุปกรณ์ (Harness-1 / Lanyard-1) และลงลายเซ็นใต้ช่องวันที่ตรวจโดยอัตโนมัติ
          </span>
        </div>
        {onOpenInspectorManager && (
          <button
            type="button"
            onClick={onOpenInspectorManager}
            className="text-blue-900 hover:text-blue-700 underline font-semibold cursor-pointer"
          >
            จัดการรายชื่อและลายเซ็นผู้ตรวจ ({allInspectors.length} ท่าน)
          </button>
        )}
      </div>
    </div>
  );
};
