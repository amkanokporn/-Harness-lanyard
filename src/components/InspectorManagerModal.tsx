import React, { useState, useEffect } from 'react';
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
} from '../utils/signatureUtils';
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
  const [localInspectors, setLocalInspectors] = useState<Inspector[]>(inspectors);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync and auto-merge with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      const autoMerged = mergeAndDeduplicateInspectors(inspectors);
      setLocalInspectors(autoMerged);
      setFeedbackMsg(null);
      if (targetInspectorName) {
        const found = autoMerged.find(
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

  const handleUpdateInspectorSignature = async (id: string, rawSignatureDataUrl: string) => {
    let signatureDataUrl = rawSignatureDataUrl;
    let verticalSignatureDataUrl = '';
    if (signatureDataUrl) {
      signatureDataUrl = await convertToTransparentPng(signatureDataUrl);
      verticalSignatureDataUrl = await rotateDataUrlToVertical(signatureDataUrl, -90);
    }
    const updated = localInspectors.map((insp) =>
      insp.id === id ? { ...insp, signatureDataUrl, verticalSignatureDataUrl } : insp
    );
    setLocalInspectors(updated);
    onSaveInspectors(updated);
    setActiveDrawingId(null);
    setFeedbackMsg({ text: 'แปลงเป็นไฟล์ .PNG พื้นหลังโปร่งใสและบันทึกลายเซ็นเรียบร้อยแล้ว', type: 'success' });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleClearSignature = (id: string) => {
    const updated = localInspectors.map((insp) =>
      insp.id === id ? { ...insp, signatureDataUrl: '', verticalSignatureDataUrl: '' } : insp
    );
    setLocalInspectors(updated);
    onSaveInspectors(updated);
    setFeedbackMsg({ text: 'ลบลายเซ็นเรียบร้อยแล้ว', type: 'success' });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleGenerateQuickSignature = (insp: Inspector) => {
    const firstName = extractFirstNameOnly(insp.name);
    const sigs = generateDigitalSignaturePng(insp.name, insp.id);
    const updated = localInspectors.map((item) =>
      item.id === insp.id
        ? { ...item, signatureDataUrl: sigs.horizontal, verticalSignatureDataUrl: sigs.vertical }
        : item
    );
    setLocalInspectors(updated);
    onSaveInspectors(updated);
    setActiveDrawingId(null);
    setFeedbackMsg({
      text: `สร้างลายเซ็น .PNG พื้นหลังโปร่งใสจากชื่อจริง "${firstName}" ให้กับ ${insp.name} สำเร็จ`,
      type: 'success',
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleAutoFillAllSignatures = () => {
    const updated = localInspectors.map((insp) => {
      if (insp.signatureDataUrl) return insp;
      const sigs = generateDigitalSignaturePng(insp.name, insp.id);
      return {
        ...insp,
        signatureDataUrl: sigs.horizontal,
        verticalSignatureDataUrl: sigs.vertical,
      };
    });
    setLocalInspectors(updated);
    onSaveInspectors(updated);
    setFeedbackMsg({
      text: `สร้างลายเซ็นดิจิทัลภาษาไทยโปร่งใสให้ผู้ตรวจที่ยังไม่มีลายเซ็นครบทุกคนแล้ว`,
      type: 'success',
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleSmartMergeAndFixGrammar = () => {
    const merged = mergeAndDeduplicateInspectors(localInspectors);
    setLocalInspectors(merged);
    onSaveInspectors(merged);
    setFeedbackMsg({
      text: `ระบบทำการรวมชื่อที่สะกดผิดคล้ายคลึงกัน และจัดกลุ่มผู้ตรวจสอบให้เรียบร้อยแล้ว`,
      type: 'success',
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
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

        const updated = localInspectors.map((insp) =>
          insp.id === id
            ? { ...insp, signatureDataUrl: cleanPng, verticalSignatureDataUrl: verticalSig }
            : insp
        );
        setLocalInspectors(updated);
        onSaveInspectors(updated);
        setFeedbackMsg({ text: `อัปโหลดลายเซ็นและลบพื้นหลังขาวเป็น .PNG โปร่งใสเรียบร้อยแล้ว`, type: 'success' });
        setTimeout(() => setFeedbackMsg(null), 3000);
      };
      reader.readAsDataURL(file);
    }
  };

  const displayedInspectors = fuzzyFilterInspectors(localInspectors, searchQuery);
  const totalWithSignature = localInspectors.filter((i) => Boolean(i.signatureDataUrl)).length;
  const totalInspectors = localInspectors.length;

  return (
    <div
      id="inspector-manager-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
    >
      <div
        id="inspector-manager-dialog"
        className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-blue-950 via-blue-900 to-slate-900 text-white border-b-2 border-yellow-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400 text-blue-950 flex items-center justify-center font-bold shrink-0 shadow-md">
              <UserCheck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold tracking-wide">
                จัดการรายชื่อและลายเซ็นผู้ตรวจสอบ
              </h3>
              <p className="text-xs sm:text-sm text-blue-200 mt-0.5">
                รวมชื่อสะกดผิดอัตโนมัติ และแนบลายเซ็นดิจิทัลสำหรับประทับลงในเอกสาร
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-inspector-modal"
            onClick={onClose}
            className="p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Status Bar with Search & Quick Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800 text-sm sm:text-base">สถานะ:</span>
            <span className="inline-flex items-center gap-1.5 font-bold px-3 py-1 rounded-xl bg-blue-950 text-yellow-300 text-sm">
              <CheckCircle2 className="w-4 h-4 text-yellow-400" />
              พร้อมใช้งาน {totalWithSignature} / {totalInspectors} ท่าน
            </span>
          </div>

          {/* Search bar inside modal */}
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้ตรวจ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-sm sm:text-base border border-slate-300 rounded-xl bg-white text-slate-800 focus:border-blue-900 focus:outline-none font-normal"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-smart-merge-sigs"
              onClick={handleSmartMergeAndFixGrammar}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-yellow-400 hover:bg-yellow-300 text-blue-950 rounded-xl font-bold shadow-xs transition-colors cursor-pointer text-sm"
              title="ระบบรวมชื่อและแก้ไขคำสะกดผิดอัตโนมัติ"
            >
              <Sparkles className="w-4 h-4 text-blue-950" />
              รวมชื่อออโต้แล้ว
            </button>

            <button
              type="button"
              id="btn-quick-fill-all-sigs"
              onClick={handleAutoFillAllSignatures}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-950 hover:bg-blue-900 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer text-sm"
            >
              <Sparkles className="w-4 h-4 text-yellow-400" />
              สร้างลายเซ็นทุกคน
            </button>
          </div>
        </div>

        {/* Feedback Message */}
        {feedbackMsg && (
          <div
            className={`mx-6 mt-4 p-3.5 rounded-xl flex items-center gap-2 text-sm font-medium ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                : 'bg-red-50 border border-red-200 text-red-900'
            }`}
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Inspector Cards List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {displayedInspectors.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-base border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <UserCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              {searchQuery
                ? `ไม่พบผู้ตรวจสอบที่ตรงกับ "${searchQuery}"`
                : 'ไม่พบรายชื่อผู้ตรวจสอบในไฟล์ข้อมูล Excel กรุณาตรวจสอบไฟล์นำเข้า'}
            </div>
          ) : (
            displayedInspectors.map((insp) => {
              const cleanName = normalizeInspectorName(insp.name);
              const firstNameOnly = extractFirstNameOnly(insp.name);
              const inspectCount = inspectorStats.get(cleanName) || 0;
              const hasSig = Boolean(insp.signatureDataUrl);
              const isDrawing = activeDrawingId === insp.id;

              return (
                <div
                  key={insp.id}
                  id={`inspector-card-${insp.id}`}
                  className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                    hasSig
                      ? 'border-slate-200 bg-white hover:border-blue-300 shadow-xs'
                      : 'border-amber-200 bg-amber-50/40 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Inspector Info */}
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base shrink-0 ${
                          hasSig
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {cleanName.charAt(0) || 'ผ'}
                      </div>

                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-base sm:text-lg font-bold text-slate-900">{insp.name}</span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs sm:text-sm font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                            ชื่อจริง: <strong className="ml-1 font-bold">{firstNameOnly}</strong>
                          </span>
                          {hasSig ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" /> ลายเซ็นพร้อม
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              <AlertCircle className="w-3.5 h-3.5" /> รอลายเซ็น
                            </span>
                          )}
                        </div>

                        {/* Merged Aliases / Misspelled Variants Notice */}
                        {insp.aliases && insp.aliases.length > 0 && (
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-medium text-amber-900 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                              รวมชื่อที่สะกดผิด:
                            </span>
                            {insp.aliases.map((a, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                              >
                                "{a}"
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                          <span>{insp.position || 'ผู้ตรวจสอบความปลอดภัย'}</span>
                          <span>•</span>
                          <span className="text-blue-800 font-medium">
                            {inspectCount > 0
                              ? `พบประวัติตรวจ ${inspectCount} รายการในไฟล์`
                              : 'ผู้ตรวจสอบประจำหน่วยงาน'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Signature Preview & Quick Actions */}
                    <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
                      {/* Signature Thumbnail */}
                      {hasSig ? (
                        <div
                          className="h-12 w-32 bg-slate-50 border border-slate-200 rounded-xl p-1 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:shadow-xs transition-all shrink-0"
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
                        <div className="h-12 w-32 bg-amber-100/60 border border-dashed border-amber-300 rounded-xl flex items-center justify-center text-xs text-amber-700 font-medium shrink-0">
                          ไม่มีลายเซ็น
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Generate Thai Cursive Signature Button (First Name Only) */}
                        <button
                          type="button"
                          id={`btn-gen-thai-sig-${insp.id}`}
                          onClick={() => handleGenerateQuickSignature(insp)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                          title={`สร้างลายเซ็นตัวเขียนภาษาไทยจากชื่อจริง "${firstNameOnly}"`}
                        >
                          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>สร้างลายเซ็น</span>
                        </button>

                        {/* Upload Button */}
                        <label
                          id={`btn-upload-sig-${insp.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-sm font-medium cursor-pointer transition-colors"
                          title="อัปโหลดไฟล์รูปภาพลายเซ็น"
                        >
                          <Upload className="w-4 h-4 text-slate-600 shrink-0" />
                          <span>อัปโหลด</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, insp.id)}
                            className="hidden"
                          />
                        </label>

                        {/* Draw Button */}
                        <button
                          type="button"
                          id={`btn-draw-sig-${insp.id}`}
                          onClick={() => setActiveDrawingId(isDrawing ? null : insp.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                            isDrawing
                              ? 'bg-blue-950 text-white border-blue-950'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                          }`}
                          title="วาดลายเซ็นบนหน้าจอ"
                        >
                          <PenTool className="w-4 h-4 shrink-0" />
                          <span>วาด</span>
                        </button>

                        {/* Clear Button */}
                        {hasSig && (
                          <button
                            type="button"
                            id={`btn-clear-sig-${insp.id}`}
                            onClick={() => handleClearSignature(insp.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                            title="ลบลายเซ็น"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Inline Signature Pad Canvas if active */}
                  {isDrawing && (
                    <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in duration-150">
                      <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                        <span className="font-semibold text-blue-900">
                          วาดลายเซ็นดิจิทัลสำหรับ: {insp.name}
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
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <FileCheck2 className="w-5 h-5 text-blue-700 shrink-0" />
            <span>
              ลายเซ็นทั้งหมดจะถูกจัดเก็บไว้ในเบราว์เซอร์ และถูกประทับลงในช่องวันที่ตรวจโดยอัตโนมัติ
            </span>
          </div>

          <button
            type="button"
            id="btn-done-inspector-modal"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 text-sm sm:text-base font-bold text-white bg-blue-950 hover:bg-blue-900 rounded-xl shadow-sm transition-all cursor-pointer"
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
            className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-700" />
                ตัวอย่างภาพลายเซ็น
              </span>
              <button
                type="button"
                id="btn-close-sig-preview"
                onClick={() => setPreviewSignatureUrl(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="border border-slate-200 rounded-xl bg-slate-50 p-6 flex items-center justify-center">
              <img
                src={previewSignatureUrl}
                alt="Signature Full Preview"
                className="max-h-48 max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
