import React, { useState, useEffect } from 'react';
import { Inspector, InspectionRecord } from '../types';
import { SignaturePad } from './SignaturePad';
import { normalizeInspectorName } from '../utils/inspectionAggregation';
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
  Image as ImageIcon,
} from 'lucide-react';

interface InspectorManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspectors: Inspector[];
  onSaveInspectors: (inspectors: Inspector[]) => void;
  records?: InspectionRecord[];
  targetInspectorName?: string | null;
}

/**
 * Generates an elegant digital signature data URL for quick preview/use
 */
function generateDigitalSignatureDataUrl(name: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 110;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, 320, 110);

  const clean = name.replace(/^(นาย|นางสาว|นาง)\s*/, '').trim() || name;

  // Set drawing style
  ctx.strokeStyle = '#1e3a8a';
  ctx.fillStyle = '#1e3a8a';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Signature text style
  ctx.font = 'italic bold 28px "Brush Script MT", "Segoe Script", "Dancing Script", cursive, sans-serif';
  ctx.fillText(clean, 28, 58);

  // Flowing signature baseline underline
  ctx.beginPath();
  ctx.moveTo(22, 70);
  ctx.bezierCurveTo(80, 82, 180, 60, 280, 72);
  ctx.stroke();

  // Subtle accent mark
  ctx.beginPath();
  ctx.moveTo(200, 40);
  ctx.lineTo(240, 28);
  ctx.stroke();

  return canvas.toDataURL('image/png');
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

  // Sync with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalInspectors(inspectors);
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
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedbackMsg({ text: 'กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, หรือ WEBP)', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        const raw = event.target.result as string;
        const transparentPng = await convertToTransparentPng(raw);
        await handleUpdateInspectorSignature(id, transparentPng);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAutoFillAllSignatures = () => {
    const updated = localInspectors.map((insp) => {
      if (insp.signatureDataUrl && insp.verticalSignatureDataUrl) return insp;
      const sigs = generateDigitalSignaturePng(insp.name, insp.id);
      return {
        ...insp,
        signatureDataUrl: insp.signatureDataUrl || sigs.horizontal,
        verticalSignatureDataUrl: insp.verticalSignatureDataUrl || sigs.vertical,
      };
    });
    setLocalInspectors(updated);
    onSaveInspectors(updated);
    setFeedbackMsg({
      text: 'สร้างลายเซ็นตัวเขียนภาษาไทยจากชื่อจริง (ไม่เอานามสกุล) ให้ครบทุกท่านแล้ว',
      type: 'success',
    });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const totalWithSignature = localInspectors.filter((i) => Boolean(i.signatureDataUrl)).length;
  const totalInspectors = localInspectors.length;

  return (
    <div
      id="inspector-manager-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        id="inspector-manager-dialog"
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                จัดการลายเซ็นผู้ตรวจสอบ (ดึงจากไฟล์ Excel อัตโนมัติ)
              </h2>
              <p className="text-xs text-slate-500">
                ระบบสร้างลายเซ็นตัวเขียนภาษาไทยจากชื่อจริง (ไม่เอานามสกุล) ให้อัตโนมัติ หรือสามารถวาด/อัปโหลดใหม่ได้
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-inspector-modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="px-6 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">สถานะลายเซ็น:</span>
            <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-md bg-white border border-slate-300 text-slate-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              พร้อมใช้งาน {totalWithSignature} / {totalInspectors} ท่าน
            </span>
          </div>

          <button
            type="button"
            id="btn-quick-fill-all-sigs"
            onClick={handleAutoFillAllSignatures}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-xs transition-colors cursor-pointer text-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            สร้างลายเซ็นชื่อจริงให้ทุกคน
          </button>
        </div>

        {/* Feedback Message */}
        {feedbackMsg && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl flex items-center gap-2 text-xs ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Inspector Cards List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {localInspectors.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <UserCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              ไม่พบรายชื่อผู้ตรวจสอบในไฟล์ข้อมูล Excel กรุณาตรวจสอบไฟล์นำเข้า
            </div>
          ) : (
            localInspectors.map((insp) => {
              const cleanName = normalizeInspectorName(insp.name);
              const firstNameOnly = extractFirstNameOnly(insp.name);
              const inspectCount = inspectorStats.get(cleanName) || 0;
              const hasSig = Boolean(insp.signatureDataUrl);
              const isDrawing = activeDrawingId === insp.id;

              return (
                <div
                  key={insp.id}
                  id={`inspector-card-${insp.id}`}
                  className={`rounded-2xl border p-4.5 transition-all ${
                    hasSig
                      ? 'border-slate-200 bg-white hover:border-blue-300 shadow-xs'
                      : 'border-amber-300 bg-amber-50/40 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Inspector Info */}
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          hasSig
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {cleanName.charAt(0) || 'ผ'}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">{insp.name}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                            ชื่อจริง: <strong className="ml-1 font-bold">{firstNameOnly}</strong>
                          </span>
                          {hasSig ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> ลายเซ็นพร้อม
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              <AlertCircle className="w-3 h-3" /> รอลายเซ็น
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                          <span>{insp.position || 'ผู้ตรวจสอบความปลอดภัย'}</span>
                          <span>•</span>
                          <span className="text-blue-700 font-medium">
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
                          className="h-12 w-28 bg-slate-50 border border-slate-200 rounded-xl p-1 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:shadow-xs transition-all shrink-0"
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
                        <div className="h-12 w-28 bg-amber-100/60 border border-dashed border-amber-300 rounded-xl flex items-center justify-center text-[10px] text-amber-700 font-medium shrink-0">
                          ไม่มีลายเซ็น
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Generate Thai Cursive Signature Button (First Name Only) */}
                        <button
                          type="button"
                          id={`btn-gen-thai-sig-${insp.id}`}
                          onClick={() => handleGenerateQuickSignature(insp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          title={`สร้างลายเซ็นตัวเขียนภาษาไทยจากชื่อจริง "${firstNameOnly}" (ไม่เอานามสกุล)`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>เจนลายเซ็น (ชื่อจริง)</span>
                        </button>

                        {/* Upload Button */}
                        <label
                          id={`btn-upload-sig-${insp.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                          title="อัปโหลดไฟล์รูปภาพลายเซ็น"
                        >
                          <Upload className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <span>อัปโหลดรูป</span>
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
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 border rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            isDrawing
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                          title="วาดลายเซ็นบนหน้าจอ"
                        >
                          <PenTool className="w-3.5 h-3.5 shrink-0" />
                          <span>วาด</span>
                        </button>

                        {/* Clear Button */}
                        {hasSig && (
                          <button
                            type="button"
                            id={`btn-clear-sig-${insp.id}`}
                            onClick={() => handleClearSignature(insp.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="ลบลายเซ็น"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Inline Signature Pad Canvas if active */}
                  {isDrawing && (
                    <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in duration-150">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
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
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <FileCheck2 className="w-4 h-4 text-blue-600" />
            <span>
              ลายเซ็นทั้งหมดจะถูกจัดเก็บไว้ในเบราว์เซอร์ และถูกประทับลงในช่องวันที่ตรวจของแต่ละท่านอัตโนมัติ
            </span>
          </div>

          <button
            type="button"
            id="btn-done-inspector-modal"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
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
              <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                ตัวอย่างลายเซ็น
              </span>
              <button
                type="button"
                id="btn-close-sig-preview"
                onClick={() => setPreviewSignatureUrl(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
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
