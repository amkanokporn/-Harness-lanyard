import React, { useState, useEffect } from 'react';
import {
  EquipmentType,
  FilterState,
  Inspector,
  ParsedExcelResult,
} from './types';
import { DEFAULT_INSPECTORS, getSampleParsedData } from './utils/sampleData';
import { parseInspectionExcel } from './utils/excelParser';
import { THAI_MONTHS } from './constants/masterTemplates';
import { generatePdfFromElements } from './utils/pdfGenerator';
import { generateDocxReport } from './utils/docxGenerator';
import { Navbar } from './components/Navbar';
import { FilterControls } from './components/FilterControls';
import { ValidationBanner } from './components/ValidationBanner';
import { ReportPreviewPanel } from './components/ReportPreviewPanel';
import { InspectorManagerModal } from './components/InspectorManagerModal';
import { PdfReportTemplate } from './components/PdfReportTemplate';
import { SingleEquipmentReportTemplate } from './components/SingleEquipmentReportTemplate';
import {
  buildEquipmentPairReports,
  extractUniqueInspectorsFromRecords,
  EquipmentPairPageData,
} from './utils/inspectionAggregation';
import {
  clusterAndNormalizeRecords,
  mergeAndDeduplicateInspectors,
} from './utils/thaiNameNormalizer';
import {
  ensureInspectorSignatures,
  convertToTransparentPng,
  rotateDataUrlToVertical,
} from './utils/signatureUtils';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const LOCAL_STORAGE_INSPECTORS_KEY = 'pre_use_inspection_inspectors_v1';

export default function App() {
  // 1. Inspectors State (persisted in localStorage)
  const [inspectors, setInspectors] = useState<Inspector[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_INSPECTORS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return mergeAndDeduplicateInspectors(parsed.map(ensureInspectorSignatures));
        }
      }
    } catch (e) {
      console.warn('Failed to load inspectors from localStorage', e);
    }
    return mergeAndDeduplicateInspectors(DEFAULT_INSPECTORS.map(ensureInspectorSignatures));
  });

  const [isInspectorModalOpen, setIsInspectorModalOpen] = useState(false);

  // 2. Parsed Data State (Default initialized with the sample data matching Master PDF)
  const [parsedData, setParsedData] = useState<ParsedExcelResult | null>(() => {
    const sample = getSampleParsedData();
    const cluster = clusterAndNormalizeRecords(sample.records, DEFAULT_INSPECTORS);
    sample.records = cluster.normalizedRecords;
    return sample;
  });

  // 3. Filter State (Plant removed since it is an overall checklist)
  const [filters, setFilters] = useState<FilterState>({
    plant: '',
    month: 'มีนาคม',
    year: '2569',
    equipmentType: 'all',
    selectedInspectorId: 'insp-1',
  });

  // 4. PDF & Word Generation State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [generationProgressText, setGenerationProgressText] = useState('');
  const [selectedPairIndex, setSelectedPairIndex] = useState<number | 'all'>(0);

  // Computed Equipment Pair Reports (Harness-1 + Lanyard-1, Harness-2 + Lanyard-2, ...)
  const pairReports: EquipmentPairPageData[] = React.useMemo(() => {
    return buildEquipmentPairReports(
      parsedData?.records || [],
      parsedData?.harnessEquipmentList || [],
      parsedData?.lanyardEquipmentList || [],
      filters.month,
      filters.year,
      inspectors
    );
  }, [parsedData, filters.month, filters.year, inspectors]);

  // 5. Toast Notification State
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>({
    type: 'info',
    message: 'โหลดข้อมูลตัวอย่าง มีนาคม 2569 ตาม Master PDF ต้นฉบับเรียบร้อยแล้ว',
  });

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Ensure all inspector signatures are 100% transparent PNG format without paper background
  useEffect(() => {
    let isMounted = true;
    const sanitizeSignatures = async () => {
      let hasChanges = false;
      const sanitized = await Promise.all(
        inspectors.map(async (insp) => {
          let sig = insp.signatureDataUrl;
          let vertSig = insp.verticalSignatureDataUrl;
          if (sig && typeof sig === 'string' && sig.startsWith('data:image/')) {
            const cleanSig = await convertToTransparentPng(sig);
            if (!vertSig || cleanSig !== sig) {
              sig = cleanSig;
              vertSig = await rotateDataUrlToVertical(cleanSig, -90);
              hasChanges = true;
            }
          }
          return {
            ...insp,
            signatureDataUrl: sig,
            verticalSignatureDataUrl: vertSig,
          };
        })
      );
      if (hasChanges && isMounted) {
        setInspectors(sanitized);
        try {
          localStorage.setItem(LOCAL_STORAGE_INSPECTORS_KEY, JSON.stringify(sanitized));
        } catch (e) {
          console.warn('Failed to update sanitized signatures in localStorage', e);
        }
      }
    };
    sanitizeSignatures();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save inspectors to localStorage when modified
  const handleSaveInspectors = (updatedInspectors: Inspector[]) => {
    setInspectors(updatedInspectors);
    try {
      localStorage.setItem(LOCAL_STORAGE_INSPECTORS_KEY, JSON.stringify(updatedInspectors));
    } catch (e) {
      console.warn('Failed to save inspectors to localStorage', e);
    }
    setToast({
      type: 'success',
      message: 'บันทึกข้อมูลผู้ตรวจสอบเรียบร้อยแล้ว',
    });
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const result = parseInspectionExcel(buffer, file.name);

      // Automatically cluster, normalize, and fix grammatical errors in inspector names
      const clusterResult = clusterAndNormalizeRecords(result.records, inspectors);
      result.records = clusterResult.normalizedRecords;

      setParsedData(result);

      // Automatically update filter defaults if detected from the uploaded excel
      const newFilters: Partial<FilterState> = {};
      if (result.availableYears.length > 0) {
        newFilters.year = result.availableYears[0]; // e.g. '2569' or latest
      }
      if (result.availableMonths.length > 0) {
        // Find months that belong to the selected year, pick the latest one
        const monthsForYear = Array.from(
          new Set(
            result.records
              .filter((r) => !newFilters.year || String(r.year) === String(newFilters.year))
              .map((r) => r.month)
          )
        );
        if (monthsForYear.length > 0) {
          monthsForYear.sort((a, b) => THAI_MONTHS.indexOf(a) - THAI_MONTHS.indexOf(b));
          newFilters.month = monthsForYear[monthsForYear.length - 1];
        } else {
          newFilters.month = result.availableMonths[result.availableMonths.length - 1];
        }
      }

      // Automatically extract and sync all inspectors from real records
      const updatedInspectors = extractUniqueInspectorsFromRecords(
        result.records,
        clusterResult.deduplicatedInspectors
      );
      setInspectors(updatedInspectors);
      try {
        localStorage.setItem(LOCAL_STORAGE_INSPECTORS_KEY, JSON.stringify(updatedInspectors));
      } catch (e) {
        console.warn(e);
      }

      if (updatedInspectors.length > 0) {
        newFilters.selectedInspectorId = updatedInspectors[0].id;
      }

      setFilters((prev) => ({
        ...prev,
        ...newFilters,
      }));

      const errorCount = result.issues.filter((i) => i.type === 'error').length;
      if (errorCount > 0) {
        setToast({
          type: 'error',
          message: `อ่านไฟล์ "${file.name}" พบข้อผิดพลาด ${errorCount} รายการ กรุณาตรวจสอบรายละเอียด`,
        });
      } else {
        const mergeAuditMsg =
          clusterResult.auditLogs.length > 0
            ? ` • รวมชื่อสะกดผิดอัตโนมัติ: ${clusterResult.auditLogs
                .map((a) => `${a.raw} ➔ ${a.canonical}`)
                .slice(0, 2)
                .join(', ')}${clusterResult.auditLogs.length > 2 ? ` และอีก ${clusterResult.auditLogs.length - 2} รายการ` : ''}`
            : '';
        setToast({
          type: 'success',
          message: `อ่านไฟล์ "${file.name}" สำเร็จ (${result.records.length} วันตรวจ)${mergeAuditMsg}`,
        });
      }
    } catch (err: any) {
      setToast({
        type: 'error',
        message: `ไม่สามารถเปิดอ่านไฟล์ได้: ${err?.message || 'เกิดข้อผิดพลาด'}`,
      });
    }
  };

  // Load Built-in Master Sample Data
  const handleLoadSampleData = () => {
    const sample = getSampleParsedData();
    const clusterResult = clusterAndNormalizeRecords(sample.records, inspectors);
    sample.records = clusterResult.normalizedRecords;
    const updatedInspectors = extractUniqueInspectorsFromRecords(
      sample.records,
      clusterResult.deduplicatedInspectors
    );
    setInspectors(updatedInspectors);
    setParsedData(sample);
    setFilters({
      plant: '',
      month: 'มีนาคม',
      year: '2569',
      equipmentType: 'all',
      selectedInspectorId: updatedInspectors.length > 0 ? updatedInspectors[0].id : '',
    });
    setToast({
      type: 'success',
      message: 'โหลดข้อมูลตัวอย่าง มีนาคม 2569 (รวมและแก้ไขชื่อสะกดผิดให้ถูกต้องตามหลักไวยากรณ์แล้ว)',
    });
  };

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => {
      const merged = { ...prev, ...newFilters };

      // If month or year changed, check if we should auto-switch inspector to match records
      if ((newFilters.month || newFilters.year) && parsedData) {
        const targetMonth = merged.month;
        const targetYear = merged.year;
        const monthRecs = parsedData.records.filter(
          (r) => (!targetMonth || r.month === targetMonth) && (!targetYear || String(r.year) === String(targetYear))
        );
        const inspName = monthRecs.find((r) => r.inspectorName)?.inspectorName;
        if (inspName) {
          const matched = inspectors.find(
            (insp) => insp.name.includes(inspName) || inspName.includes(insp.name)
          );
          if (matched) {
            merged.selectedInspectorId = matched.id;
          }
        }
      }

      return merged;
    });
  };

  // Selected Inspector Object
  const currentInspector = inspectors.find((i) => i.id === filters.selectedInspectorId) || null;

  // Handle PDF Generation
  const handleGeneratePdf = async () => {
    if (!filters.month || !filters.year) {
      setToast({
        type: 'error',
        message: 'กรุณาระบุเดือน และปี พ.ศ. ให้ครบถ้วน',
      });
      return;
    }

    setIsGeneratingPdf(true);
    setGenerationProgressText('กำลังเตรียมข้อมูลสร้าง PDF...');

    try {
      const elementIds: string[] = [];
      let fileName = '';

      if (selectedPairIndex === 'all') {
        // Export all pairs that have inspections (or all pairs if none)
        const activePairs = pairReports.filter((p) => p.hasAnyInspection).length > 0
          ? pairReports.filter((p) => p.hasAnyInspection)
          : pairReports;

        for (const pair of activePairs) {
          elementIds.push(`export-pair-page-set-${pair.pairNumber}`);
        }
        fileName = `แบบตรวจสอบ_Harness_and_Lanyard_ทุกชุด_${filters.month}_${filters.year}.pdf`;
      } else {
        const targetPair = pairReports[selectedPairIndex] || pairReports[0];
        const pairNum = targetPair?.pairNumber || 1;
        const setLabel = targetPair?.setLabel || pairNum;
        elementIds.push(`export-pair-page-set-${pairNum}`);
        fileName = `แบบตรวจสอบ_Harness_and_Lanyard_ชุดที่_${setLabel}_${filters.month}_${filters.year}.pdf`;
      }

      await generatePdfFromElements({
        elementIds,
        fileName,
        onProgress: (_step, _total, msg) => {
          setGenerationProgressText(msg);
        },
      });

      setToast({
        type: 'success',
        message: `สร้างและดาวน์โหลดไฟล์ "${fileName}" เรียบร้อยแล้ว`,
      });
    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      setToast({
        type: 'error',
        message: `เกิดข้อผิดพลาดในการสร้าง PDF: ${err?.message || 'โปรดลองอีกครั้ง'}`,
      });
    } finally {
      setIsGeneratingPdf(false);
      setGenerationProgressText('');
    }
  };

  // Handle Word (.docx) Generation
  const handleGenerateDocx = async () => {
    if (!filters.month || !filters.year) {
      setToast({
        type: 'error',
        message: 'กรุณาระบุเดือน และปี พ.ศ. ให้ครบถ้วน',
      });
      return;
    }

    setIsGeneratingDocx(true);

    try {
      let fileName = '';
      if (selectedPairIndex === 'all') {
        fileName = `แบบตรวจสอบ_Harness_and_Lanyard_ทุกชุด_${filters.month}_${filters.year}.docx`;
      } else {
        const targetPair = pairReports[selectedPairIndex] || pairReports[0];
        const setLabel = targetPair?.setLabel || targetPair?.pairNumber || 1;
        fileName = `แบบตรวจสอบ_Harness_and_Lanyard_ชุดที่_${setLabel}_${filters.month}_${filters.year}.docx`;
      }

      await generateDocxReport({
        month: filters.month,
        year: filters.year,
        equipmentType: filters.equipmentType,
        harnessEquipment: parsedData?.harnessEquipmentList || [],
        lanyardEquipment: parsedData?.lanyardEquipmentList || [],
        records: parsedData?.records || [],
        inspector: currentInspector,
        inspectors,
        fileName,
        pairReports,
        selectedPairIndex: typeof selectedPairIndex === 'number' ? selectedPairIndex : undefined,
        layoutMode: 'pair',
      });

      setToast({
        type: 'success',
        message: `สร้างและดาวน์โหลดไฟล์ "${fileName}" เรียบร้อยแล้ว`,
      });
    } catch (err: any) {
      console.error('Word Generation Error:', err);
      setToast({
        type: 'error',
        message: `เกิดข้อผิดพลาดในการสร้าง Word: ${err?.message || 'โปรดลองอีกครั้ง'}`,
      });
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  const handlePrintPreview = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100/90 flex flex-col font-['TH_Sarabun_New','THSarabunNew','TH_Sarabun_PSK','Sarabun',sans-serif]">
      {/* Top Navbar */}
      <Navbar
        onOpenInspectorModal={() => setIsInspectorModalOpen(true)}
        onLoadSampleData={handleLoadSampleData}
        totalInspectors={inspectors.length}
        hasLoadedData={!!parsedData}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Toast Alert */}
        {toast && (
          <div
            id="toast-notification"
            className={`flex items-center justify-between p-4 rounded-2xl border-2 shadow-md transition-all ${
              toast.type === 'success'
                ? 'bg-blue-950 border-yellow-400 text-yellow-300'
                : toast.type === 'error'
                ? 'bg-red-950 border-red-400 text-red-100'
                : 'bg-blue-900 border-blue-400 text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              {toast.type === 'success' ? (
                <div className="w-8 h-8 rounded-lg bg-yellow-400 text-blue-950 flex items-center justify-center font-bold shrink-0">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                </div>
              ) : toast.type === 'error' ? (
                <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center font-bold shrink-0">
                  <AlertCircle className="w-5 h-5 stroke-[2.5]" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-yellow-400 text-blue-950 flex items-center justify-center font-bold shrink-0">
                  <Info className="w-5 h-5 stroke-[2.5]" />
                </div>
              )}
              <span className="text-xs sm:text-sm font-bold tracking-wide">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 text-blue-200 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Validation Issues / Error Banner from Excel parsing */}
        {parsedData && <ValidationBanner issues={parsedData.issues} />}

        {/* Filter Controls Panel */}
        <FilterControls
          parsedData={parsedData}
          filters={filters}
          onFilterChange={handleFilterChange}
          onFileUpload={handleFileUpload}
          inspectors={inspectors}
          onOpenInspectorModal={() => setIsInspectorModalOpen(true)}
          onGeneratePdf={handleGeneratePdf}
          onGenerateDocx={handleGenerateDocx}
          onPrintPreview={handlePrintPreview}
          isGeneratingPdf={isGeneratingPdf}
          isGeneratingDocx={isGeneratingDocx}
          generationProgressText={generationProgressText}
        />

        {/* Master PDF Layout Preview Panel */}
        <ReportPreviewPanel
          plant={filters.plant}
          month={filters.month}
          year={filters.year}
          equipmentType={filters.equipmentType}
          harnessEquipment={parsedData?.harnessEquipmentList || []}
          lanyardEquipment={parsedData?.lanyardEquipmentList || []}
          records={parsedData?.records || []}
          inspector={currentInspector}
          inspectors={inspectors}
          selectedPairIndex={selectedPairIndex}
          onSelectPairIndex={setSelectedPairIndex}
          onOpenInspectorManager={() => setIsInspectorModalOpen(true)}
        />
      </main>

      {/* Inspector Management Modal */}
      <InspectorManagerModal
        isOpen={isInspectorModalOpen}
        onClose={() => setIsInspectorModalOpen(false)}
        inspectors={inspectors}
        onSaveInspectors={handleSaveInspectors}
        records={parsedData?.records || []}
      />

      {/* Hidden Unscaled Render Stage for Pristine PDF Export */}
      <div
        id="pdf-unscaled-export-stage"
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '1080px',
          height: 'auto',
          zIndex: -99999,
          pointerEvents: 'none',
          opacity: 1,
        }}
      >
        {/* Single Equipment Pair Pages for Export */}
        {pairReports.map((pair) => (
          <SingleEquipmentReportTemplate
            key={pair.pairNumber}
            pageData={pair}
            idPrefix="export-pair-page"
          />
        ))}

        {/* Matrix Template Pages for Export */}
        <PdfReportTemplate
          equipmentType="harness"
          plant={filters.plant}
          month={filters.month}
          year={filters.year}
          equipmentList={parsedData?.harnessEquipmentList || []}
          records={parsedData?.records || []}
          inspector={currentInspector}
          inspectors={inspectors}
          idPrefix="export-template-page"
        />
        <PdfReportTemplate
          equipmentType="lanyard"
          plant={filters.plant}
          month={filters.month}
          year={filters.year}
          equipmentList={parsedData?.lanyardEquipmentList || []}
          records={parsedData?.records || []}
          inspector={currentInspector}
          inspectors={inspectors}
          idPrefix="export-template-page"
        />
      </div>
    </div>
  );
}
