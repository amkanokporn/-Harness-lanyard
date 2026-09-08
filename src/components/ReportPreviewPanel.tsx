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
      className="bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl border border-slate-700 flex flex-col space-y-4"
    >
      {/* Top Preview Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">
                ตัวอย่างเอกสารรายงานจริง (Live Report Preview)
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Sparkles className="w-3 h-3 mr-1" /> ลายเซ็นตรงตามวันตรวจ
              </span>
            </div>
            <p className="text-xs text-slate-400">
              ขนาด A4 แนวนอน (Landscape) ตามแบบฟอร์ม FM-004/QP-PB-013 พร้อมช่องเซ็นชื่อใต้แต่ละวันที่ตรวจ
            </p>
          </div>
        </div>

        {/* View Mode & Zoom Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Layout Mode Switcher */}
          <div className="bg-slate-900/90 p-1 rounded-xl border border-slate-700 flex items-center gap-1 text-xs">
            <button
              type="button"
              id="tab-mode-pair"
              onClick={() => setViewFormat('pair')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium flex items-center gap-1.5 ${
                viewFormat === 'pair'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>แบบรายชุดอุปกรณ์ (Master Form)</span>
            </button>
            <button
              type="button"
              id="tab-mode-matrix"
              onClick={() => setViewFormat('matrix')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium flex items-center gap-1.5 ${
                viewFormat === 'matrix'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>แบบสรุปตารางรวม (Matrix)</span>
            </button>
          </div>

          {/* Zoom Buttons */}
          <div className="bg-slate-900/90 p-1 rounded-xl border border-slate-700 flex items-center gap-1 text-xs">
            <button
              type="button"
              id="btn-zoom-out"
              onClick={handleZoomOut}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="ย่อขนาด"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-[11px] font-mono text-slate-300">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              id="btn-zoom-in"
              onClick={handleZoomIn}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="ขยายขนาด"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              id="btn-zoom-reset"
              onClick={handleResetZoom}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="ขนาดพอดีจอ"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Equipment Pair Tabs (When in Pair Mode) */}
      {viewFormat === 'pair' && (
        <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-700/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap overflow-x-auto py-1">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 pl-1">
              <Layers className="w-3.5 h-3.5 text-blue-400" /> ลำดับชุดอุปกรณ์ (ใช้มากที่สุดขึ้นก่อน):
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : hasData
                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-600'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 border border-slate-700/50'
                  }`}
                >
                  <span className="font-semibold">ชุดที่ {pair.setLabel || pair.pairNumber}</span>
                  <span className="text-[10px] opacity-80">
                    ({harnessName.replace(/Harness-/i, 'H-').replace(/[✓√✔]/g, '').trim()} / {lanyardName.replace(/Lanyard-/i, 'L-').replace(/[✓√✔]/g, '').trim()})
                  </span>
                  {hasData ? (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected
                          ? 'bg-emerald-400 text-slate-900'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                      title={`ตรวจ ${daysCount} วัน (${pair.totalInspectionCount || 0} ครั้ง)`}
                    >
                      {daysCount} วัน
                    </span>
                  ) : (
                    <span className="text-[9.5px] opacity-40">0 วัน</span>
                  )}
                </button>
              );
            })}

            <button
              type="button"
              id="select-pair-tab-all"
              onClick={() => setPairIndex('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activePairIndex === 'all'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600'
              }`}
            >
              <span>แสดงทั้งหมดทุกชุด ({pairReports.length} หน้า)</span>
            </button>
          </div>
        </div>
      )}

      {/* Matrix Sub-tabs (When in Matrix Mode) */}
      {viewFormat === 'matrix' && (
        <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-700/80 flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 pl-1">เลือกหน้าตารางรวม:</span>
          <button
            type="button"
            onClick={() => setMatrixTab('both')}
            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
              matrixTab === 'both' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            ทั้ง 2 หน้า
          </button>
          <button
            type="button"
            onClick={() => setMatrixTab('harness')}
            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
              matrixTab === 'harness' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            เฉพาะ Harness (12 รายการ)
          </button>
          <button
            type="button"
            onClick={() => setMatrixTab('lanyard')}
            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
              matrixTab === 'lanyard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            เฉพาะ Lanyard (10 รายการ)
          </button>
        </div>
      )}

      {/* Preview Stage Area with Scale */}
      <div
        id="preview-viewport"
        className="w-full bg-slate-900/90 rounded-xl p-4 sm:p-8 overflow-auto border border-slate-700/80 min-h-[550px] flex flex-col items-center gap-8"
      >
        {viewFormat === 'pair' ? (
          /* Single Equipment Pair Pages */
          displayedPairs.map((pair) => {
            return (
              <div key={pair.pairNumber} className="flex flex-col items-center">
                <div className="mb-2 flex items-center justify-between w-full max-w-[1080px] text-xs text-slate-300 font-medium px-1">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span className="font-semibold text-white">
                      {pair.pairLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
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
                        ? `-${(1 - zoomLevel) * 764}px`
                        : `${(zoomLevel - 1) * 764}px`,
                  }}
                  className="transition-transform duration-150"
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
                <div className="mb-2 flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
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
                  className="transition-transform duration-150"
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
                <div className="mb-2 flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
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
                  className="transition-transform duration-150"
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-400 px-1">
        <div className="flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            แยกตามเลขที่อุปกรณ์ (Harness-1 / Lanyard-1) และลงลายเซ็นในช่องใต้วันที่ตรวจโดยอัตโนมัติตาม Master Template
          </span>
        </div>
        {onOpenInspectorManager && (
          <button
            type="button"
            onClick={onOpenInspectorManager}
            className="text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
          >
            จัดการรายชื่อและลายเซ็นผู้ตรวจสอบ ({allInspectors.length} ท่าน)
          </button>
        )}
      </div>
    </div>
  );
};
