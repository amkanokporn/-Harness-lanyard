import React, { useState, useEffect, useRef } from 'react';
import { Inspector, InspectionRecord } from '../types';
import { SignaturePad } from './SignaturePad';
import { normalizeInspectorName } from '../utils/inspectionAggregation';
import {
  mergeAndDeduplicateInspectors,
  fuzzyFilterInspectors,
} from '../utils/thaiNameNormalizer';
import {
  generateDigitalSignaturePng,
  rotateDataUrlToVertical,
  extractFirstNameOnly,
  convertToTransparentPng,
  cleanInspectorFullName,
} from '../utils/signatureUtils';
import {
  generateSignatureExcelTemplate,
  parseSignatureExcelTemplate,
} from '../utils/signatureTemplateGenerator';
import { processBatchSignatureFiles } from '../utils/signatureMatcher';
import {
  saveSignatureToVault,
  exportSignaturesBackupJson,
  importSignaturesBackupJson,
} from '../utils/signatureStorage';
import { DatabaseSignatureUploader } from './DatabaseSignatureUploader';
import { saveAs } from 'file-saver';
import {
  X,
  UserCheck,
  Upload,
  PenTool,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sparkles,
  Trash2,
  FileCheck2,
  Search,
  FileSpreadsheet,
  Download,
  UploadCloud,
  ShieldCheck,
  RefreshCw,
  FolderArchive,
  ArrowDownToLine,
  Info,
  Plus,
  Edit3,
} from 'lucide-react';

interface InspectorManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspectors: Inspector[];
  onSaveInspectors: (inspectors: Inspector[]) => void;
  records?: InspectionRecord[];
  targetInspectorName?: string | null;
}

export const InspectorManagerModal: React.FC<InspectorManagerModalProps> = ({
  isOpen,
  onClose,
  inspectors,
  onSaveInspectors,
  records = [],
  targetInspectorName = null,
}) => {
  const [activeDrawingId, setActiveDrawingId] = useState<string | null>(null);
  const [previewSignatureUrl, setPreviewSignatureUrl] = useState<string | null>(null);
  const [localInspectors, setLocalInspectors] = useState<Inspector[]>(() => mergeAndDeduplicateInspectors(inspectors));
  const [feedbackMsg, setFeedbackMsg] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Add & Edit Inspector state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newInspectorName, setNewInspectorName] = useState('');
  const [newInspectorPosition, setNewInspectorPosition] = useState('พนักงานตรวจสอบอุปกรณ์');
  const [newInspectorDept, setNewInspectorDept] = useState('โรงไฟฟ้าจะนะ');

  const [editingInspectorId, setEditingInspectorId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editDept, setEditDept] = useState('');

  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const excelTemplateInputRef = useRef<HTMLInputElement>(null);
  const jsonBackupInputRef = useRef<HTMLInputElement>(null);

  // Sync with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalInspectors(mergeAndDeduplicateInspectors(inspectors));
      setFeedbackMsg(null);
      if (targetInspectorName) {
        const found = inspectors.find(
          (i) => normalizeInspectorName(i.name) === normalizeInspectorName(targetInspectorName)
        );
        if (found) {
          setActiveDrawingId(null);
        }
      }
    }
  }, [isOpen, inspectors, targetInspectorName]);

  if (!isOpen) return null;

  // Calculate inspection stats per inspector from real records
  const inspectorStats = new Map<string, number>();
  for (const r of records) {
    const clean = normalizeInspectorName(r.inspectorName);
    if (clean) {
      inspectorStats.set(clean, (inspectorStats.get(clean) || 0) + 1);
    }
  }

  // 1. Download Excel Template for Signatures
  const handleDownloadExcelTemplate = () => {
    try {
      generateSignatureExcelTemplate(
        localInspectors,
        'แบบฟอร์มรายชื่อและแม่แบบลายเซ็นผู้ตรวจสอบ.xlsx'
      );
      setFeedbackMsg({
        text: 'ดาวน์โหลดไฟล์แม่แบบ Excel "แบบฟอร์มรายชื่อและแม่แบบลายเซ็นผู้ตรวจสอบ.xlsx" เรียบร้อยแล้ว',
        type: 'success',
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      setFeedbackMsg({
        text: `เกิดข้อผิดพลาดในการดาวน์โหลด Excel: ${err?.message || 'โปรดลองอีกครั้ง'}`,
        type: 'error',
      });
    }
  };

  // 2. Batch Upload Real Signature Images (Multiple files at once)
  const handleBatchSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? (Array.from(e.target.files) as File[]) : [];
    if (files.length === 0) return;

    setIsProcessingBatch(true);
    setFeedbackMsg({
      text: `กำลังประมวลผลไฟล์ภาพลายเซ็น ${files.length} ไฟล์ ลบพื้นหลัง และจับคู่ชื่อ...`,
      type: 'info',
    });

    try {
      const result = await processBatchSignatureFiles(files, localInspectors);
      setLocalInspectors(result.updatedInspectors);
      onSaveInspectors(result.updatedInspectors);

      if (result.matchedCount > 0) {
        const names = result.matchedInspectors.map((m) => m.inspector.name).join(', ');
        setFeedbackMsg({
          text: `อัปโหลดและบันทึกลายเซ็นจริงถาวรสำเร็จ ${result.matchedCount} ท่าน (${names})`,
          type: 'success',
        });
      } else {
        setFeedbackMsg({
          text: `ประมวลผล ${files.length} ไฟล์ แต่ชื่อไฟล์ยังไม่ตรงกับรายชื่อผู้ตรวจ กรุณาตรวจสอบหรือเปลี่ยนชื่อไฟล์ภาพให้ตรงกับชื่อผู้ตรวจ`,
          type: 'error',
        });
      }
    } catch (err: any) {
      console.error('Batch upload error:', err);
      setFeedbackMsg({
        text: `เกิดข้อผิดพลาดในการประมวลผลไฟล์: ${err?.message || 'โปรดลองใหม่อีกครั้ง'}`,
        type: 'error',
      });
    } finally {
      setIsProcessingBatch(false);
      if (batchFileInputRef.current) batchFileInputRef.current.value = '';
      setTimeout(() => setFeedbackMsg(null), 6000);
    }
  };

  // 3. Upload and sync Excel template back
  const handleUploadExcelTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const parsedInspectors = parseSignatureExcelTemplate(buffer);

      if (parsedInspectors.length === 0) {
        setFeedbackMsg({
          text: 'ไม่พบข้อมูลผู้ตรวจสอบในไฟล์ Excel ที่อัปโหลด',
          type: 'error',
        });
        return;
      }

      // Merge parsed inspectors with localInspectors
      const updated = [...localInspectors];
      let updatedCount = 0;

      for (const p of parsedInspectors) {
        if (!p.name) continue;
        const normP = cleanInspectorFullName(p.name);
        const existingIdx = updated.findIndex(
          (i) => cleanInspectorFullName(i.name) === normP
        );

        if (existingIdx !== -1) {
          updated[existingIdx] = {
            ...updated[existingIdx],
            position: p.position || updated[existingIdx].position,
            department: p.department || updated[existingIdx].department,
          };
          updatedCount++;
        } else {
          const sigs = generateDigitalSignaturePng(p.name);
          updated.push({
            id: p.id || `insp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            name: p.name,
            position: p.position || 'พนักงานตรวจสอบอุปกรณ์',
            department: p.department || 'โรงไฟฟ้าจะนะ',
            signatureDataUrl: sigs.horizontal,
            verticalSignatureDataUrl: sigs.vertical,
          });
          updatedCount++;
        }
      }

      setLocalInspectors(updated);
      onSaveInspectors(updated);
      setFeedbackMsg({
        text: `นำเข้าข้อมูลจาก Excel และอัปเดตผู้ตรวจสอบ ${updatedCount} ท่านเรียบร้อยแล้ว`,
        type: 'success',
      });
    } catch (err: any) {
      setFeedbackMsg({
        text: `อ่านไฟล์ Excel ไม่สำเร็จ: ${err?.message || 'โปรดลองอีกครั้ง'}`,
        type: 'error',
      });
    } finally {
      if (excelTemplateInputRef.current) excelTemplateInputRef.current.value = '';
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // 4. Export JSON Backup of All Signatures
  const handleExportBackup = async () => {
    try {
      const jsonStr = await exportSignaturesBackupJson();
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      saveAs(blob, `สำรองข้อมูลลายเซ็น_กฟผ_${new Date().toISOString().slice(0, 10)}.json`);
      setFeedbackMsg({
        text: 'ดาวน์โหลดไฟล์สำรองข้อมูลลายเซ็น (.json) เรียบร้อยแล้ว สามารถนำกลับมาใช้ได้ทุกเมื่อ',
        type: 'success',
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      setFeedbackMsg({
        text: `เกิดข้อผิดพลาดในการสำรองข้อมูล: ${err?.message || 'โปรดลองอีกครั้ง'}`,
        type: 'error',
      });
    }
  };

  // 5. Restore JSON Backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const count = await importSignaturesBackupJson(text);
      if (count > 0) {
        // Refresh localInspectors
        setFeedbackMsg({
          text: `กู้คืนและนำเข้าลายเซ็นจริงสำเร็จ ${count} ท่าน`,
          type: 'success',
        });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setFeedbackMsg({
          text: 'ไม่พบลายเซ็นในไฟล์สำรองข้อมูล',
          type: 'error',
        });
      }
    } catch (err: any) {
      setFeedbackMsg({
        text: `กู้คืนข้อมูลไม่สำเร็จ: ${err?.message || 'รูปแบบไฟล์ไม่ถูกต้อง'}`,
        type: 'error',
      });
    } finally {
      if (jsonBackupInputRef.current) jsonBackupInputRef.current.value = '';
    }
  };

  // 6. Update individual signature (e.g. drawn from canvas or uploaded)
  const handleUpdateInspectorSignature = async (id: string, rawSignatureDataUrl: string) => {
    let signatureDataUrl = rawSignatureDataUrl;
    let verticalSignatureDataUrl = '';
    if (signatureDataUrl) {
      signatureDataUrl = await convertToTransparentPng(signatureDataUrl);
      verticalSignatureDataUrl = await rotateDataUrlToVertical(signatureDataUrl, -90);
    }

    const targetInsp = localInspectors.find((i) => i.id === id);
    const updated = localInspectors.map((insp) =>
      insp.id === id
        ? {
            ...insp,
            signatureDataUrl,
            verticalSignatureDataUrl,
            isCustomSignature: true,
            uploadedAt: new Date().toISOString(),
          }
        : insp
    );

    setLocalInspectors(updated);
    onSaveInspectors(updated);

    // Save to permanent vault
    if (targetInsp && signatureDataUrl) {
      await saveSignatureToVault({
        id: targetInsp.id,
        name: targetInsp.name,
        cleanName: cleanInspectorFullName(targetInsp.name),
        signatureDataUrl,
        verticalSignatureDataUrl,
        isCustomSignature: true,
        uploadedAt: new Date().toISOString(),
        position: targetInsp.position,
        department: targetInsp.department,
      });
    }

    setActiveDrawingId(null);
    setFeedbackMsg({
      text: `บันทึกลายเซ็นจริงของ "${targetInsp?.name || ''}" ลงฐานข้อมูลถาวรเรียบร้อยแล้ว`,
      type: 'success',
    });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // 7. Single file upload for specific inspector (overwrite/upload)
  const handleSingleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setFeedbackMsg({ text: 'กรุณาอัปโหลดไฟล์รูปภาพ (PNG, JPG, WebP) เท่านั้น', type: 'error' });
        return;
      }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const rawDataUrl = ev.target?.result as string;
        const cleanPng = await convertToTransparentPng(rawDataUrl);
        const verticalSig = await rotateDataUrlToVertical(cleanPng, -90);

        const targetInsp = localInspectors.find((i) => i.id === id);
        const updated = localInspectors.map((insp) =>
          insp.id === id
            ? {
                ...insp,
                signatureDataUrl: cleanPng,
                verticalSignatureDataUrl: verticalSig,
                isCustomSignature: true,
                uploadedAt: new Date().toISOString(),
                originalFileName: file.name,
              }
            : insp
        );

        setLocalInspectors(updated);
        onSaveInspectors(updated);

        // Save to permanent vault
        if (targetInsp) {
          await saveSignatureToVault({
            id: targetInsp.id,
            name: targetInsp.name,
            cleanName: cleanInspectorFullName(targetInsp.name),
            signatureDataUrl: cleanPng,
            verticalSignatureDataUrl: verticalSig,
            isCustomSignature: true,
            uploadedAt: new Date().toISOString(),
            originalFileName: file.name,
            position: targetInsp.position,
            department: targetInsp.department,
          });
        }

        setFeedbackMsg({
          text: `อัปโหลดลายเซ็นจริงของ "${targetInsp?.name || ''}" และบันทึกถาวรเรียบร้อยแล้ว`,
          type: 'success',
        });
        setTimeout(() => setFeedbackMsg(null), 3500);
      };
      reader.readAsDataURL(file);
    }
  };

  // 8. Clear signature
  const handleClearSignature = (id: string) => {
    const targetInsp = localInspectors.find((i) => i.id === id);
    const updated = localInspectors.map((insp) =>
      insp.id === id
        ? {
            ...insp,
            signatureDataUrl: '',
            verticalSignatureDataUrl: '',
            isCustomSignature: false,
            uploadedAt: undefined,
            originalFileName: undefined,
          }
        : insp
    );
    setLocalInspectors(updated);
    onSaveInspectors(updated);
    setFeedbackMsg({ text: `ลบลายเซ็นของ "${targetInsp?.name || ''}" เรียบร้อยแล้ว`, type: 'info' });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // 9. Generate Quick Thai Cursive Computer Signature
  const handleGenerateQuickSignature = (insp: Inspector) => {
    const firstName = extractFirstNameOnly(insp.name);
    const sigs = generateDigitalSignaturePng(insp.name, insp.id);
    const updated = localInspectors.map((item) =>
      item.id === insp.id
        ? {
            ...item,
            signatureDataUrl: sigs.horizontal,
            verticalSignatureDataUrl: sigs.vertical,
            isCustomSignature: false,
          }
        : item
    );
    setLocalInspectors(updated);
    onSaveInspectors(updated);
    setActiveDrawingId(null);
    setFeedbackMsg({
      text: `สร้างลายเซ็นดิจิทัลจากชื่อ "${firstName}" เรียบร้อยแล้ว`,
      type: 'success',
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // 10. Auto-fill all missing signatures with digital cursive
  const handleAutoFillAllSignatures = () => {
    const updated = localInspectors.map((insp) => {
      if (insp.signatureDataUrl) return insp;
      const sigs = generateDigitalSignaturePng(insp.name, insp.id);
      return {
        ...insp,
        signatureDataUrl: sigs.horizontal,
        verticalSignatureDataUrl: sigs.vertical,
        isCustomSignature: false,
      };
    });
    setLocalInspectors(updated);
    onSaveInspectors(updated);
    setFeedbackMsg({
      text: `สร้างลายเซ็นดิจิทัลให้กับผู้ตรวจที่ยังไม่มีลายเซ็นครบทุกคนแล้ว`,
      type: 'success',
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // 11. Add New Inspector
  const handleAddNewInspector = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInspectorName.trim()) {
      setFeedbackMsg({ text: 'กรุณากรอกชื่อ-นามสกุลผู้ตรวจสอบ', type: 'error' });
      return;
    }

    const trimmedName = newInspectorName.trim();
    const exists = localInspectors.some(
      (i) => cleanInspectorFullName(i.name) === cleanInspectorFullName(trimmedName)
    );
    if (exists) {
      setFeedbackMsg({ text: `มีรายชื่อ "${trimmedName}" อยู่ในระบบแล้ว`, type: 'error' });
      return;
    }

    const sigs = generateDigitalSignaturePng(trimmedName);
    const newInsp: Inspector = {
      id: `insp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: trimmedName,
      position: newInspectorPosition.trim() || 'พนักงานตรวจสอบอุปกรณ์',
      department: newInspectorDept.trim() || 'โรงไฟฟ้าจะนะ',
      signatureDataUrl: sigs.horizontal,
      verticalSignatureDataUrl: sigs.vertical,
      isCustomSignature: false,
    };

    const updated = mergeAndDeduplicateInspectors([...localInspectors, newInsp]);
    setLocalInspectors(updated);
    onSaveInspectors(updated);

    setNewInspectorName('');
    setShowAddModal(false);
    setFeedbackMsg({
      text: `เพิ่มรายชื่อผู้ตรวจสอบ "${trimmedName}" เรียบร้อยแล้ว`,
      type: 'success',
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // 12. Edit Inspector
  const handleStartEdit = (insp: Inspector) => {
    setEditingInspectorId(insp.id);
    setEditName(insp.name);
    setEditPosition(insp.position || 'พนักงานตรวจสอบอุปกรณ์');
    setEditDept(insp.department || 'โรงไฟฟ้าจะนะ');
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) {
      setFeedbackMsg({ text: 'กรุณากรอกชื่อ-นามสกุลผู้ตรวจสอบ', type: 'error' });
      return;
    }

    const trimmedName = editName.trim();
    const updated = localInspectors.map((insp) =>
      insp.id === id
        ? {
            ...insp,
            name: trimmedName,
            position: editPosition.trim() || 'พนักงานตรวจสอบอุปกรณ์',
            department: editDept.trim() || 'โรงไฟฟ้าจะนะ',
          }
        : insp
    );

    const merged = mergeAndDeduplicateInspectors(updated);
    setLocalInspectors(merged);
    onSaveInspectors(merged);
    setEditingInspectorId(null);
    setFeedbackMsg({
      text: `แก้ไขข้อมูลผู้ตรวจสอบเรียบร้อยแล้ว`,
      type: 'success',
    });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // 13. Delete Inspector
  const handleDeleteInspector = (id: string) => {
    const target = localInspectors.find((i) => i.id === id);
    if (!confirm(`คุณต้องการลบรายชื่อ "${target?.name || id}" ออกจากระบบใช่หรือไม่?`)) return;

    const updated = localInspectors.filter((i) => i.id !== id);
    setLocalInspectors(updated);
    onSaveInspectors(updated);
    setFeedbackMsg({
      text: `ลบรายชื่อ "${target?.name || ''}" ออกจากระบบแล้ว`,
      type: 'info',
    });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const displayedInspectors = fuzzyFilterInspectors(localInspectors, searchQuery);
  const totalWithRealSignature = localInspectors.filter((i) => Boolean(i.isCustomSignature && i.signatureDataUrl)).length;
  const totalWithAnySignature = localInspectors.filter((i) => Boolean(i.signatureDataUrl)).length;
  const totalInspectors = localInspectors.length;

  return (
    <div
      id="inspector-manager-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div
        id="inspector-manager-dialog"
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Header - EGAT Navy & Yellow Theme */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-white text-slate-800 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1e3a8a] text-[#fbbf24] flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <UserCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-[#1e3a8a] tracking-tight">
                  ระบบจัดการและจัดเก็บลายเซ็นจริงผู้ตรวจสอบ
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5" /> จัดเก็บถาวรในระบบ
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ดาวน์โหลดแบบฟอร์ม Excel นำเข้าภาพลายเซ็นจริง และบันทึกเก็บไว้ถาวรไม่สูญหาย
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-inspector-modal"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar: Excel Template Download & Batch Upload */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50/90 border-b border-slate-200 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Left buttons: Excel Template & Batch Upload */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 1. Download Excel Template Button */}
              <button
                type="button"
                id="btn-download-excel-sig-template"
                onClick={handleDownloadExcelTemplate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
                title="ดาวน์โหลดแบบฟอร์ม Excel ที่มีรายชื่อผู้ตรวจสอบครบถ้วนพร้อมคำแนะนำ"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#fbbf24] shrink-0" />
                <span>ดาวน์โหลดแม่แบบ Excel</span>
              </button>

              {/* Add New Inspector Button */}
              <button
                type="button"
                id="btn-open-add-inspector-modal"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-colors cursor-pointer"
                title="เพิ่มรายชื่อผู้ตรวจสอบใหม่ด้วยตนเอง"
              >
                <Plus className="w-4 h-4 text-white shrink-0 stroke-[2.5]" />
                <span>เพิ่มรายชื่อใหม่</span>
              </button>

              {/* 2. Batch Upload Signatures Button */}
              <label
                id="btn-batch-upload-signatures"
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-900 rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-colors cursor-pointer ${
                  isProcessingBatch ? 'opacity-50 pointer-events-none' : ''
                }`}
                title="เลือกไฟล์รูปภาพลายเซ็นหลายๆ ไฟล์พร้อมกัน (.png, .jpg) ระบบจะผูกตามชื่อให้อัตโนมัติ"
              >
                {isProcessingBatch ? (
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-slate-900" />
                ) : (
                  <UploadCloud className="w-4 h-4 text-slate-900 shrink-0 stroke-[2.3]" />
                )}
                <span>อัปโหลดภาพลายเซ็นจริง (หลายไฟล์)</span>
                <input
                  ref={batchFileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleBatchSignatureUpload}
                  className="hidden"
                />
              </label>

              {/* 3. Sync Excel File Button */}
              <label
                id="btn-upload-excel-sync"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer shadow-2xs"
                title="อัปโหลดไฟล์ Excel ที่แก้ไขรายชื่อกลับเข้าระบบ"
              >
                <ArrowDownToLine className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span>นำเข้าจาก Excel</span>
                <input
                  ref={excelTemplateInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleUploadExcelTemplate}
                  className="hidden"
                />
              </label>

              {/* Instructions Toggle */}
              <button
                type="button"
                onClick={() => setShowInstructions((prev) => !prev)}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-[#1e3a8a] hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                title="ดูคำแนะนำการใช้งาน"
              >
                <Info className="w-3.5 h-3.5 text-[#1e3a8a]" />
                <span>{showInstructions ? 'ซ่อนคำแนะนำ' : 'วิธีใช้งาน'}</span>
              </button>
            </div>

            {/* Right: Search & Backup */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Search */}
              <div className="relative flex-1 sm:w-52">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อผู้ตรวจ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-xl bg-white text-slate-800 focus:border-[#1e3a8a] focus:outline-none"
                />
              </div>

              {/* Backup & Restore Dropdown/Buttons */}
              <button
                type="button"
                id="btn-backup-signatures-json"
                onClick={handleExportBackup}
                className="p-2 text-slate-600 hover:text-[#1e3a8a] bg-white border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                title="สำรองข้อมูลลายเซ็นเก็บไว้ในเครื่อง (Backup JSON)"
              >
                <FolderArchive className="w-4 h-4" />
              </button>

              <label
                id="btn-restore-signatures-json"
                className="p-2 text-slate-600 hover:text-[#1e3a8a] bg-white border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                title="กู้คืนข้อมูลลายเซ็นจากไฟล์สำรอง (Restore JSON)"
              >
                <Download className="w-4 h-4" />
                <input
                  ref={jsonBackupInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>

              {/* Auto Fill Missing Button */}
              <button
                type="button"
                id="btn-quick-fill-all-sigs"
                onClick={handleAutoFillAllSignatures}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-[#1e3a8a] border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-2xs"
                title="สร้างลายเซ็นดิจิทัลเฉพาะคนที่ยังไม่มี"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>เติมคนที่ขาด</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Pill Bar */}
          <div className="flex items-center justify-between text-xs text-slate-600 pt-1 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                มีลายเซ็นจริงแล้ว: {totalWithRealSignature} ท่าน
              </span>
              <span className="inline-flex items-center gap-1 text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                รวมพร้อมใช้งาน: {totalWithAnySignature} / {totalInspectors} ท่าน
              </span>
            </div>
            <span className="text-slate-500 italic">
              * ลายเซ็นจริงจะถูกจัดเก็บถาวร ไม่สูญหายเมื่ออัปโหลดไฟล์ใหม่หรือเปิดเข้ามาใหม่
            </span>
          </div>

          {/* Collapsible Usage Instructions Box */}
          {showInstructions && (
            <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl text-xs sm:text-sm text-slate-700 space-y-2 animate-in fade-in duration-150">
              <div className="font-bold text-[#1e3a8a] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                ขั้นตอนการเพิ่มและจัดเก็บลายเซ็นจริงให้คงอยู่ถาวร:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-xs text-slate-600 pl-1">
                <li>
                  <strong>กดปุ่ม "ดาวน์โหลดแม่แบบ Excel":</strong> ระบบจะสร้างไฟล์ Excel ที่มีรายชื่อผู้ตรวจสอบทั้งหมดตามไฟล์ที่เปิดอยู่
                </li>
                <li>
                  <strong>เตรียมรูปภาพลายเซ็น:</strong> เซ็นชื่อลงบนกระดาษขาว ถ่ายรูปหรือสแกน บันทึกเป็นไฟล์ .png หรือ .jpg (ระบบจะลบพื้นหลังขาวเป็นโปร่งใสให้อัตโนมัติ)
                </li>
                <li>
                  <strong>ตั้งชื่อไฟล์รูปภาพ:</strong> ตั้งชื่อไฟล์ให้ตรงกับชื่อผู้ตรวจ เช่น <code>นายชญานนท์ เชื้อคำ.png</code> หรือ <code>ชญานนท์.png</code>
                </li>
                <li>
                  <strong>กดปุ่ม "อัปโหลดภาพลายเซ็นจริง (หลายไฟล์)":</strong> เลือกภาพทั้งหมดพร้อมกัน ระบบจะตรวจจับชื่อ หมุนแนวตั้ง และจัดเก็บถาวรลงฐานข้อมูลของระบบทันที
                </li>
                <li>
                  <strong>การคงอยู่:</strong> ลายเซ็นจะถูกเก็บถาวร ไม่หายไปเมื่อเปิดเว็บใหม่หรืออัปโหลดรายงานใหม่ จนกว่าท่านจะกดอัปโหลดทับลงไป
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Feedback Alert Banner */}
        {feedbackMsg && (
          <div
            className={`mx-5 sm:mx-6 mt-3 p-3 rounded-xl flex items-center gap-2 text-xs sm:text-sm font-medium ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                : feedbackMsg.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-900'
                : 'bg-blue-50 border border-blue-200 text-blue-900'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : feedbackMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            ) : (
              <RefreshCw className="w-4 h-4 shrink-0 text-blue-600 animate-spin" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Inspectors List */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/40">
          {/* Prominent Database Uploader Panel */}
          <DatabaseSignatureUploader
            inspectors={localInspectors}
            onInspectorsUpdated={(updated) => {
              setLocalInspectors(updated);
              onSaveInspectors(updated);
            }}
          />

          {displayedInspectors.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl bg-white">
              <UserCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              {searchQuery
                ? `ไม่พบผู้ตรวจสอบที่ตรงกับ "${searchQuery}"`
                : 'ไม่พบรายชื่อผู้ตรวจสอบในไฟล์ข้อมูล Excel'}
            </div>
          ) : (
            displayedInspectors.map((insp) => {
              const cleanName = cleanInspectorFullName(insp.name);
              const firstNameOnly = extractFirstNameOnly(insp.name);
              const inspectCount = inspectorStats.get(normalizeInspectorName(insp.name)) || 0;
              const hasSig = Boolean(insp.signatureDataUrl);
              const isRealSig = Boolean(insp.isCustomSignature && hasSig);
              const isDrawing = activeDrawingId === insp.id;

              return (
                <div
                  key={insp.id}
                  id={`inspector-card-${insp.id}`}
                  className={`rounded-xl border p-4 transition-all bg-white ${
                    isRealSig
                      ? 'border-emerald-300 shadow-2xs'
                      : hasSig
                      ? 'border-slate-200 hover:border-blue-300 shadow-2xs'
                      : 'border-amber-300 bg-amber-50/30 shadow-2xs'
                  }`}
                >
                  {editingInspectorId === insp.id ? (
                    <div className="space-y-3.5 p-1">
                      <div className="flex items-center justify-between text-xs font-bold text-[#1e3a8a]">
                        <span className="flex items-center gap-1.5">
                          <Edit3 className="w-4 h-4 text-blue-600" />
                          แก้ไขข้อมูลผู้ตรวจสอบ: {insp.name}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">ชื่อ - นามสกุล</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-[#1e3a8a] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">ตำแหน่ง</label>
                          <input
                            type="text"
                            value={editPosition}
                            onChange={(e) => setEditPosition(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-[#1e3a8a] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">สังกัด / แผนก</label>
                          <input
                            type="text"
                            value={editDept}
                            onChange={(e) => setEditDept(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-[#1e3a8a] focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingInspectorId(null)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(insp.id)}
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1e3a8a] hover:bg-[#1e40af] rounded-lg cursor-pointer shadow-2xs transition-colors"
                        >
                          บันทึกการแก้ไข
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                      {/* Left: Inspector Info */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            isRealSig
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : hasSig
                              ? 'bg-blue-50 text-[#1e3a8a] border border-blue-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {cleanName.charAt(0) || 'ผ'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm sm:text-base font-bold text-slate-900">
                              {insp.name}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                              ชื่อ: <strong className="ml-1 font-semibold">{firstNameOnly}</strong>
                            </span>

                            {/* Signature Status Badges */}
                            {isRealSig ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                                ลายเซ็นจริง (อัปโหลดแล้ว)
                              </span>
                            ) : hasSig ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-[#1e3a8a] border border-blue-200">
                                <CheckCircle2 className="w-3 h-3 text-[#1e3a8a]" />
                                ลายเซ็นดิจิทัลคอมพิวเตอร์
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                รอลายเซ็น
                              </span>
                            )}
                          </div>

                          {/* Subtitle Info */}
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                            <span>{insp.position || 'พนักงานตรวจสอบอุปกรณ์'}</span>
                            <span>•</span>
                            <span>{insp.department || 'โรงไฟฟ้าจะนะ'}</span>
                            {insp.originalFileName && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-700 font-medium">
                                  ไฟล์: {insp.originalFileName}
                                </span>
                              </>
                            )}
                            {inspectCount > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-[#1e3a8a] font-medium">
                                  พบตรวจ {inspectCount} ครั้งในเดือนนี้
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Signature Preview & Actions */}
                      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
                        {/* Signature Thumbnail */}
                        {hasSig ? (
                          <div
                            className="h-11 w-32 bg-slate-50 border border-slate-200 rounded-xl p-1 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:shadow-2xs transition-all shrink-0"
                            title="คลิกเพื่อดูภาพขยาย"
                            onClick={() => setPreviewSignatureUrl(insp.signatureDataUrl || null)}
                          >
                            <img
                              src={insp.signatureDataUrl}
                              alt={`ลายเซ็น ${insp.name}`}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="h-11 w-32 bg-amber-50 border border-dashed border-amber-300 rounded-xl flex items-center justify-center text-xs text-amber-700 font-medium shrink-0">
                            ไม่มีลายเซ็น
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Single Upload / Overwrite Button */}
                          <label
                            id={`btn-upload-sig-${insp.id}`}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors border shadow-2xs ${
                              isRealSig
                                ? 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                            title={isRealSig ? 'อัปโหลดภาพใหม่ทับลายเซ็นนี้' : 'อัปโหลดไฟล์ภาพลายเซ็นจริง'}
                          >
                            <Upload className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                            <span>{isRealSig ? 'อัปโหลดทับ' : 'อัปโหลดภาพ'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleSingleFileUpload(e, insp.id)}
                              className="hidden"
                            />
                          </label>

                          {/* Draw Button */}
                          <button
                            type="button"
                            id={`btn-draw-sig-${insp.id}`}
                            onClick={() => setActiveDrawingId(isDrawing ? null : insp.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-2xs ${
                              isDrawing
                                ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                            title="วาดลายเซ็นบนหน้าจอ"
                          >
                            <PenTool className="w-3.5 h-3.5 shrink-0" />
                            <span>วาด</span>
                          </button>

                          {/* Quick Cursive Generator Button */}
                          {!isRealSig && (
                            <button
                              type="button"
                              id={`btn-gen-thai-sig-${insp.id}`}
                              onClick={() => handleGenerateQuickSignature(insp)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1e3a8a] border border-blue-200 rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                              title={`สร้างลายเซ็นดิจิทัลจากชื่อ "${firstNameOnly}"`}
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>สร้าง</span>
                            </button>
                          )}

                          {/* Edit Button */}
                          <button
                            type="button"
                            id={`btn-edit-insp-${insp.id}`}
                            onClick={() => handleStartEdit(insp)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                            title="แก้ไขชื่อ ตำแหน่ง หรือสังกัด"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>แก้ไข</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            id={`btn-delete-insp-${insp.id}`}
                            onClick={() => handleDeleteInspector(insp.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="ลบรายชื่อผู้ตรวจสอบออกจากระบบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Inline Signature Pad Canvas if active */}
                  {isDrawing && (
                    <div className="mt-3.5 pt-3.5 border-t border-slate-200 animate-in fade-in duration-150">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
                        <span className="font-semibold text-[#1e3a8a]">
                          วาดลายเซ็นจริงสำหรับ: {insp.name}
                        </span>
                        <span>ใช้เมาส์หรือนิ้วลากบนหน้าจอ</span>
                      </div>
                      <SignaturePad
                        initialSignature={insp.signatureDataUrl || ''}
                        onSave={(dataUrl) => handleUpdateInspectorSignature(insp.id, dataUrl)}
                        onCancel={() => setActiveDrawingId(null)}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              ลายเซ็นจริงที่อัปโหลดจะถูกบันทึกเก็บไว้ในระบบถาวร ไม่สูญหายจนกว่าท่านจะกดอัปโหลดทับลงไป
            </span>
          </div>

          <button
            type="button"
            id="btn-done-inspector-modal"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#1e3a8a] hover:bg-[#1e40af] rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            บันทึกและปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Signature Enlarged Preview Modal */}
      {previewSignatureUrl && (
        <div
          id="signature-zoom-modal"
          className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewSignatureUrl(null)}
        >
          <div
            className="bg-white p-5 rounded-2xl max-w-md w-full shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#1e3a8a]" />
                ตัวอย่างภาพลายเซ็นจริง
              </span>
              <button
                type="button"
                id="btn-close-sig-preview"
                onClick={() => setPreviewSignatureUrl(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="border border-slate-200 rounded-xl bg-slate-50 p-6 flex items-center justify-center">
              <img
                src={previewSignatureUrl}
                alt="Signature Full Preview"
                className="max-h-48 max-w-full object-contain"
              />
            </div>
            <p className="text-center text-xs text-slate-500 mt-2">
              ภาพลายเซ็นพื้นหลังโปร่งใส สำหรับประทับลงในแบบฟอร์มรายงาน กฟผ.
            </p>
          </div>
        </div>
      )}

      {/* Add New Inspector Modal Dialog */}
      {showAddModal && (
        <div
          id="add-inspector-modal"
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl relative space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="text-base font-bold text-[#1e3a8a] flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                เพิ่มรายชื่อผู้ตรวจสอบใหม่
              </h4>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewInspector} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อ - นามสกุล (พร้อมคำนำหน้า เช่น นาย, นาง, นางสาว, ส.อ., ส.ท.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น นายสมชาย ใจดี"
                  value={newInspectorName}
                  onChange={(e) => setNewInspectorName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#1e3a8a] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ตำแหน่ง
                </label>
                <input
                  type="text"
                  placeholder="เช่น พนักงานตรวจสอบอุปกรณ์"
                  value={newInspectorPosition}
                  onChange={(e) => setNewInspectorPosition(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#1e3a8a] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  แผนก / สังกัด
                </label>
                <input
                  type="text"
                  placeholder="เช่น โรงไฟฟ้าจะนะ"
                  value={newInspectorDept}
                  onChange={(e) => setNewInspectorDept(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#1e3a8a] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  บันทึกเพิ่มรายชื่อ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
