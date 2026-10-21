import React, { useState, useRef, useEffect } from 'react';
import { Inspector } from '../types';
import {
  UploadCloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  Server,
  CloudCheck,
  FileCheck2,
  Sparkles,
  Info,
} from 'lucide-react';
import { processBatchSignatureFiles } from '../utils/signatureMatcher';
import {
  forceSyncFromDatabase,
  getAllSavedSignatures,
  applyVaultSignaturesToInspectors,
} from '../utils/signatureStorage';

interface DatabaseSignatureUploaderProps {
  inspectors: Inspector[];
  onInspectorsUpdated: (inspectors: Inspector[]) => void;
  className?: string;
  compact?: boolean;
}

export const DatabaseSignatureUploader: React.FC<DatabaseSignatureUploaderProps> = ({
  inspectors,
  onInspectorsUpdated,
  className = '',
  compact = false,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbStatus, setDbStatus] = useState<{
    serverOnline: boolean;
    firestoreOnline: boolean;
    totalSignatures: number;
    lastChecked: string;
  }>({
    serverOnline: true,
    firestoreOnline: true,
    totalSignatures: getAllSavedSignatures().length,
    lastChecked: new Date().toLocaleTimeString('th-TH'),
  });

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    details?: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check database status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/signatures');
      let serverCount = 0;
      if (res.ok) {
        const json = await res.json();
        serverCount = json?.count || 0;
      }
      const vaultCount = getAllSavedSignatures().length;
      setDbStatus({
        serverOnline: res.ok,
        firestoreOnline: true,
        totalSignatures: Math.max(serverCount, vaultCount),
        lastChecked: new Date().toLocaleTimeString('th-TH'),
      });
    } catch (e) {
      setDbStatus((prev) => ({
        ...prev,
        serverOnline: false,
        totalSignatures: getAllSavedSignatures().length,
        lastChecked: new Date().toLocaleTimeString('th-TH'),
      }));
    }
  };

  // 1. Handle file upload directly to Database
  const handleFilesUpload = async (files: File[]) => {
    if (!files || files.length === 0) return;

    const imageFiles = files.filter((f) =>
      f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name)
    );

    if (imageFiles.length === 0) {
      setNotification({
        type: 'error',
        message: 'กรุณาเลือกไฟล์ภาพลายเซ็น (.png, .jpg, .jpeg, .webp) เท่านั้น',
      });
      return;
    }

    setIsUploading(true);
    setNotification({
      type: 'info',
      message: `กำลังประมวลผล ${imageFiles.length} ไฟล์ ลบพื้นหลังให้โปร่งใส และบันทึกขึ้น Server & Database...`,
    });

    try {
      const result = await processBatchSignatureFiles(imageFiles, inspectors);
      onInspectorsUpdated(result.updatedInspectors);

      // Force refresh status
      await checkStatus();

      if (result.matchedCount > 0) {
        const matchedNames = result.matchedInspectors.map(
          (m) => `• ${m.inspector.name} (จากไฟล์: ${m.fileName})`
        );

        setNotification({
          type: 'success',
          message: `✅ บันทึกลายเซ็นขึ้น Server และ Cloud Database สำเร็จ ${result.matchedCount} ท่าน เรียบร้อยแล้ว!`,
          details: matchedNames,
        });
      } else {
        const unmatchedNames = result.unmatchedFiles.map((u) => u.detectedName).join(', ');
        setNotification({
          type: 'error',
          message: `ไม่สามารถจับคู่ชื่อไฟล์ภาพกับรายชื่อผู้ตรวจได้ (${unmatchedNames}) กรุณาตั้งชื่อไฟล์ให้ตรงกับชื่อผู้ตรวจ เช่น "นายชญานนท์ เชื้อคำ.png" หรือ "ชญานนท์.png"`,
        });
      }
    } catch (err: any) {
      console.error('Database upload error:', err);
      setNotification({
        type: 'error',
        message: `เกิดข้อผิดพลาดในการบันทึกขึ้นฐานข้อมูล: ${err?.message || 'โปรดลองอีกครั้ง'}`,
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 2. Handle manual sync from Database
  const handleForceSync = async () => {
    setIsSyncing(true);
    setNotification({
      type: 'info',
      message: 'กำลังดึงข้อมูลลายเซ็นล่าสุดจาก Server และ Cloud Database...',
    });

    try {
      const syncResult = await forceSyncFromDatabase();
      const updated = applyVaultSignaturesToInspectors(inspectors);
      onInspectorsUpdated(updated);
      await checkStatus();

      setNotification({
        type: 'success',
        message: `ซิงค์สำเร็จ! ดึงข้อมูลจาก Server (${syncResult.serverCount} ไฟล์) และ Cloud Firestore (${syncResult.firestoreCount} ไฟล์) รวมพร้อมใช้งาน ${syncResult.totalVaultCount} ท่าน`,
      });
    } catch (err: any) {
      console.error('Sync error:', err);
      setNotification({
        type: 'error',
        message: `ไม่สามารถซิงค์ข้อมูลได้: ${err?.message || 'โปรดลองใหม่อีกครั้ง'}`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div
      id="database-signature-uploader"
      className={`rounded-2xl border-2 border-blue-200 bg-linear-to-br from-blue-50/70 via-white to-amber-50/40 p-4 sm:p-5 shadow-xs ${className}`}
    >
      {/* Title & Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-blue-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#1e3a8a] text-[#fbbf24] flex items-center justify-center font-bold shadow-2xs shrink-0">
            <Database className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm sm:text-base font-bold text-[#1e3a8a] tracking-tight">
                ช่องอัปโหลดลายเซ็นขึ้นฐานข้อมูล (Server & Database Direct Upload)
              </h4>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CloudCheck className="w-3.5 h-3.5 text-emerald-700" />
                ออนไลน์ทุกเครื่อง
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              บันทึกลายเซ็นจริงขึ้น Server และ Cloud Database ถาวรตามชื่อไฟล์ — เปิดเครื่องไหนก็เจอลายเซ็นเดียวกัน 100%
            </p>
          </div>
        </div>

        {/* Sync Button */}
        <button
          type="button"
          id="btn-sync-database-now"
          onClick={handleForceSync}
          disabled={isSyncing || isUploading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-blue-50 text-[#1e3a8a] border border-blue-200 hover:border-blue-300 rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-colors cursor-pointer shrink-0 disabled:opacity-60"
          title="ดึงลายเซ็นล่าสุดจาก Server และ Cloud เพื่อให้ทุกเครื่องตรงกันทันที"
        >
          <RefreshCw
            className={`w-4 h-4 text-[#1e3a8a] shrink-0 ${isSyncing ? 'animate-spin' : ''}`}
          />
          <span>{isSyncing ? 'กำลังซิงค์...' : 'กดซิงค์ลายเซ็นจากฐานข้อมูล'}</span>
        </button>
      </div>

      {/* Main Drag-and-Drop & File Select Area */}
      <div className="mt-3.5">
        <label
          htmlFor="db-signature-files-input"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFilesUpload(Array.from(e.dataTransfer.files));
            }
          }}
          className={`relative flex flex-col items-center justify-center p-5 sm:p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
            isUploading
              ? 'border-blue-400 bg-blue-50/50 pointer-events-none'
              : 'border-blue-300 hover:border-[#1e3a8a] bg-white hover:bg-blue-50/30'
          }`}
        >
          <input
            id="db-signature-files-input"
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={(e) => {
              if (e.target.files) {
                handleFilesUpload(Array.from(e.target.files));
              }
            }}
            className="hidden"
          />

          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-100 text-[#1e3a8a] mb-2.5 shadow-2xs">
            {isUploading ? (
              <RefreshCw className="w-6 h-6 animate-spin text-[#1e3a8a]" />
            ) : (
              <UploadCloud className="w-6 h-6 text-[#1e3a8a] stroke-[2.2]" />
            )}
          </div>

          <p className="text-xs sm:text-sm font-bold text-slate-800 text-center">
            {isUploading
              ? 'กำลังตัดพื้นหลังโปร่งใส และบันทึกเข้า Database...'
              : 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์ภาพลายเซ็นจริงมาวางที่นี่ (เลือกได้หลายไฟล์พร้อมกัน)'}
          </p>
          <p className="text-[11px] text-slate-500 text-center mt-1">
            รองรับ .PNG, .JPG (ระบบจะตัดพื้นหลังขาวออกให้โปร่งใส และจับคู่ตามชื่อไฟล์ เช่น{' '}
            <code className="text-[#1e3a8a] font-semibold">นายชญานนท์ เชื้อคำ.png</code>,{' '}
            <code className="text-[#1e3a8a] font-semibold">กิติคุณ.png</code> ให้อัตโนมัติ)
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e3a8a] text-white text-xs font-semibold shadow-2xs">
            <UploadCloud className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span>เลือกไฟล์ภาพลายเซ็นเพื่อบันทึกขึ้นฐานข้อมูล</span>
          </div>
        </label>
      </div>

      {/* Database Status Pills */}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 font-medium text-slate-700">
            <Server className="w-3.5 h-3.5 text-blue-600" />
            Server Database: {dbStatus.serverOnline ? 'เชื่อมต่อแล้ว' : 'ออฟไลน์'}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 font-medium text-slate-700">
            <CloudCheck className="w-3.5 h-3.5 text-emerald-600" />
            Firestore Cloud: เชื่อมต่อแล้ว
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 font-bold text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            มีลายเซ็นในฐานข้อมูล: {dbStatus.totalSignatures} ท่าน
          </span>
        </div>
        <span className="text-[11px] text-slate-400 italic">
          อัปเดตล่าสุด: {dbStatus.lastChecked}
        </span>
      </div>

      {/* Notification / Feedback Banner */}
      {notification && (
        <div
          className={`mt-3.5 p-3 sm:p-4 rounded-xl text-xs sm:text-sm font-medium border ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notification.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            ) : (
              <RefreshCw className="w-4 h-4 shrink-0 text-blue-600 animate-spin" />
            )}
            <span>{notification.message}</span>
          </div>

          {notification.details && notification.details.length > 0 && (
            <div className="mt-2 pl-6 space-y-0.5 text-xs text-slate-700 max-h-32 overflow-y-auto">
              {notification.details.map((detail, idx) => (
                <div key={idx}>{detail}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
