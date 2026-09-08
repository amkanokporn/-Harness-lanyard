import React from 'react';
import { ShieldCheck, UserCheck, FileSpreadsheet, Sparkles } from 'lucide-react';
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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  ระบบสร้างรายงานแบบตรวจสอบเครื่องมืออุปกรณ์ก่อนการใช้งาน
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                  FM-004/QP-PB-013
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Full Body Harness & Lanyard Pre-Use Inspection PDF Generator (ตาม Master Template กฟผ.)
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
              title="โหลดข้อมูลตัวอย่าง มีนาคม 2569 ตาม Master PDF ต้นฉบับ"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden md:inline">โหลดข้อมูลตัวอย่าง</span>
              <span className="md:hidden">ตัวอย่าง</span>
            </button>

            {/* Download Excel Template */}
            <button
              type="button"
              id="btn-download-excel-template"
              onClick={generateExcelTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
              title="ดาวน์โหลดไฟล์แม่แบบ Excel (.xlsx) เพื่อนำไปกรอกข้อมูล"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">ดาวน์โหลด Excel Template</span>
              <span className="md:hidden">แม่แบบ Excel</span>
            </button>

            {/* Manage Inspectors */}
            <button
              type="button"
              id="btn-manage-inspectors-nav"
              onClick={onOpenInspectorModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>ผู้ตรวจสอบ ({totalInspectors})</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
