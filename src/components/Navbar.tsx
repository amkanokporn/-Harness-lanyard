import React from 'react';
import { ShieldCheck, UserCheck, FileSpreadsheet, Sparkles, Award } from 'lucide-react';
import { generateExcelTemplate } from '../utils/excelParser';

interface NavbarProps {
  onOpenInspectorModal: () => void;
  onLoadSampleData: () => void;
  totalInspectors: number;
  hasLoadedData: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenInspectorModal,
  onLoadSampleData,
  totalInspectors,
  hasLoadedData,
}) => {
  return (
    <header className="bg-gradient-to-r from-blue-950 via-blue-900 to-slate-900 text-white border-b border-yellow-400/30 sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 text-blue-950 flex items-center justify-center font-bold shadow-md shadow-yellow-500/20 ring-2 ring-yellow-300/40 shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-white leading-tight tracking-wide">
                  ระบบสร้างรายงานแบบตรวจสอบเครื่องมืออุปกรณ์ก่อนการใช้งาน
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 rounded-full">
                  <Award className="w-3 h-3 text-yellow-400" />
                  FM-004/QP-PB-013
                </span>
              </div>
              <p className="text-xs text-blue-200/80 hidden sm:block">
                Full Body Harness & Lanyard Pre-Use Inspection PDF & Word Generator (ตามแบบฟอร์มมาตรฐาน กฟผ.)
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Load Sample Data Button */}
            <button
              type="button"
              id="btn-load-sample-data"
              onClick={onLoadSampleData}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-950 bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 border border-yellow-300 rounded-xl transition-all shadow-sm shadow-yellow-500/20 cursor-pointer"
              title="โหลดข้อมูลตัวอย่าง มีนาคม 2569 พร้อมระบบตรวจสอบและรวมชื่ออัตโนมัติ"
            >
              <Sparkles className="w-4 h-4 text-blue-950" />
              <span className="hidden md:inline">โหลดข้อมูลตัวอย่าง</span>
              <span className="md:hidden">ตัวอย่าง</span>
            </button>

            {/* Download Excel Template */}
            <button
              type="button"
              id="btn-download-excel-template"
              onClick={generateExcelTemplate}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-yellow-200 bg-blue-900/80 hover:bg-blue-800/90 border border-yellow-400/30 rounded-xl transition-colors cursor-pointer"
              title="ดาวน์โหลดไฟล์แม่แบบ Excel (.xlsx) เพื่อนำไปกรอกข้อมูล"
            >
              <FileSpreadsheet className="w-4 h-4 text-yellow-400" />
              <span className="hidden md:inline">ดาวน์โหลด Excel Template</span>
              <span className="md:hidden">แม่แบบ Excel</span>
            </button>

            {/* Manage Inspectors */}
            <button
              type="button"
              id="btn-manage-inspectors-nav"
              onClick={onOpenInspectorModal}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-800/60 hover:bg-blue-700/80 border border-blue-600/50 rounded-xl transition-colors cursor-pointer"
            >
              <UserCheck className="w-4 h-4 text-yellow-400" />
              <span>ผู้ตรวจสอบ ({totalInspectors})</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
