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
import { mergeAndDeduplicateInspectors } from './utils/thaiNameNormalizer';
import {
  ensureInspectorSignatures,
  convertToTransparentPng,
  rotateDataUrlToVertical,
  cleanInspectorFullName,
} from './utils/signatureUtils';
import {
  initSignatureVault,
  applyVaultSignaturesToInspectors,
  batchSaveSignaturesToVault,
} from './utils/signatureStorage';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  X,
} from 'lucide-react';

const LOCAL_STORAGE_INSPECTORS_KEY = 'pre_use_inspection_inspectors_v1';

export default function App() {
  // Inspectors State (persisted in localStorage)
  const [inspectors, setInspectors] = useState<Inspector[]>(() => {
    let initialInspectors = DEFAULT_INSPECTORS.map(ensureInspectorSignatures);
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_INSPECTORS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialInspectors = parsed.map(ensureInspectorSignatures);
        }
      }
    } catch (e) {
      console.warn('Failed to load inspectors from localStorage', e);
    }
    // We can't apply vault signatures here because initSignatureVault is async,
    // so we apply them in the useEffect below.
    return mergeAndDeduplicateInspectors(initialInspectors);
  });

  const [isInspectorModalOpen, setIsInspectorModalOpen] = useState(false);

  // 3. Parsed Data State (Default initialized with the sample data matching Master PDF)
  const [parsedData, setParsedData] = useState<ParsedExcelResult | null>(() => {
    return getSampleParsedData();
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

  // Initialize permanent signature vault (IndexedDB + localStorage) on startup
  useEffect(() => {
    let isMounted = true;
    const initializeVaultAndSanitize = async () => {
      try {
        await initSignatureVault();
        if (isMounted) {
          // Re-fetch everything from vault and update inspectors
          setInspectors((prev) => {
            const withVault = applyVaultSignaturesToInspectors(prev);
            return withVault;
          });
        }
      } catch (err) {
        console.warn('Vault init error:', err);
      }
    };
    initializeVaultAndSanitize();
    return () => {
      isMounted = false;
    };
  }, []); // Note: This only runs once on mount. If inspectors update, we might need a better trigger.

  // Save inspectors to permanent vault and localStorage when modified
  const handleSaveInspectors = async (rawUpdated: Inspector[]) => {
    const updatedInspectors = mergeAndDeduplicateInspectors(rawUpdated);
    setInspectors(updatedInspectors);

    // Save custom signatures to permanent vault
    const customList = updatedInspectors
      .filter((i) => i.isCustomSignature && i.signatureDataUrl)
      .map((i) => ({
        id: i.id,
        name: i.name,
        cleanName: cleanInspectorFullName(i.name),
        signatureDataUrl: i.signatureDataUrl!,
        verticalSignatureDataUrl: i.verticalSignatureDataUrl,
        isCustomSignature: true,
        uploadedAt: i.uploadedAt || new Date().toISOString(),
        originalFileName: i.originalFileName,
        position: i.position,
        department: i.department,
      }));

    if (customList.length > 0) {
      await batchSaveSignaturesToVault(customList);
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_INSPECTORS_KEY, JSON.stringify(updatedInspectors));
    } catch (e) {
      console.warn('Failed to save inspectors to localStorage', e);
    }

    setToast({
      type: 'success',
      message: 'บันทึกข้อมูลและจัดเก็บลายเซ็นจริงลงระบบถาวรเรียบร้อยแล้ว',
    });
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const result = parseInspectionExcel(buffer, file.name);

      // ดึงชื่อผู้ใช้งานและบันทึกการตรวจจากไฟล์โดยตรง 100% ไม่ดัดแปลง ไม่แก้ไขคำผิด เพื่อให้คงตามไฟล์ต้นทาง
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

      // Automatically extract and sync all inspectors from real records,
      // enforcing the 13 locked master personnel and preserving vault signatures!
      const extractionRes = extractUniqueInspectorsFromRecords(
        result.records,
        inspectors
      );
      const preservedInspectors = applyVaultSignaturesToInspectors(extractionRes.updatedInspectors);
      setInspectors(preservedInspectors);
      try {
        localStorage.setItem(LOCAL_STORAGE_INSPECTORS_KEY, JSON.stringify(preservedInspectors));
      } catch (e) {
        console.warn(e);
      }

      if (preservedInspectors.length > 0) {
        newFilters.selectedInspectorId = preservedInspectors[0].id;
      }

      setFilters((prev) => ({
        ...prev,
        ...newFilters,
      }));

      if (extractionRes.unknownNames.length > 0) {
        setToast({
          type: 'error',
          message: `แจ้งเตือน: พบรายชื่อนอกเหนือจาก 13 รายชื่อหลัก (${extractionRes.unknownNames.join(', ')}). ชื่อนอกเหนือจากนี้จะไม่ถูกเพิ่มในระบบจนกว่าจะมีการแอดเพิ่ม`,
        });
      } else {
        const errorCount = result.issues.filter((i) => i.type === 'error').length;
        if (errorCount > 0) {
          setToast({
            type: 'error',
            message: `อ่านไฟล์ "${file.name}" พบข้อผิดพลาด ${errorCount} รายการ กรุณาตรวจสอบรายละเอียด`,
          });
        } else {
          setToast({
            type: 'success',
            message: `อ่านไฟล์ "${file.name}" สำเร็จ (${result.records.length} วันตรวจ) • ล็อกรายชื่อ 13 ท่านถูกต้องครบถ้วน`,
          });
        }
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
    const extractionRes = extractUniqueInspectorsFromRecords(
      sample.records,
      inspectors
    );
    setInspectors(extractionRes.updatedInspectors);
    setParsedData(sample);
    setFilters({
      plant: '',
      month: 'มีนาคม',
      year: '2569',
      equipmentType: 'all',
      selectedInspectorId: extractionRes.updatedInspectors.length > 0 ? extractionRes.updatedInspectors[0].id : '',
    });
    setToast({
      type: 'success',
      message: 'โหลดข้อมูลตัวอย่าง มีนาคม 2569 สำเร็จ (ดึงรายชื่อและรายการตรวจครบถ้วน)',
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Prompt','Sarabun',sans-serif]">
      {/* Top Navbar */}
      <Navbar
        onOpenInspectorModal={() => setIsInspectorModalOpen(true)}
        onLoadSampleData={handleLoadSampleData}
        totalInspectors={inspectors.length}
        hasLoadedData={!!parsedData}
      />

      {/* Main Content Area - Single, Intuitive, Familiar Standard Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5">
        {/* Soft, Calming Toast Alert */}
        {toast && (
          <div
            id="toast-notification"
            className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl border shadow-xs transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toast.type === 'success' ? (
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                </div>
              ) : toast.type === 'error' ? (
                <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold shrink-0">
                  <AlertCircle className="w-4 h-4 stroke-[2.5]" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                  <Info className="w-4 h-4 stroke-[2.5]" />
                </div>
              )}
              <span className="text-xs sm:text-sm font-medium">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Validation Issues / Error Banner from Excel parsing */}
        {parsedData && <ValidationBanner issues={parsedData.issues} />}

        {/* 1. Filter Controls & Import Excel Panel */}
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

        {/* 2. Master Document Preview Panel */}
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
          width: '1122px',
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
