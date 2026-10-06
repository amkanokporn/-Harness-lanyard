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
    <header className="bg-gradient-to-r from-blue-950 via-blue-900 to-slate-900 text-white border-b-2 border-yellow-400 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Title */}
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="w-12 h-12 rounded-2xl bg-yellow-400 text-blue-950 flex items-center justify-center font-bold shadow-md shadow-yellow-500/20 ring-2 ring-yellow-300 shrink-0">
              <ShieldCheck className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                  ระบบรายงานตรวจอุปกรณ์ก่อนการใช้งาน
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 text-xs sm:text-sm font-bold bg-yellow-400 text-blue-950 rounded-lg">
                  FM-004/QP-PB-013 (กฟผ.)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-blue-200 mt-0.5 font-normal">
                Full Body Harness & Lanyard Inspection Report (ส่งออก PDF & Word 13.5pt พอดีหน้า A4)
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Load Sample Data Button */}
            <button
              type="button"
              id="btn-load-sample-data"
              onClick={onLoadSampleData}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold text-blue-950 bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 rounded-xl transition-all shadow-sm cursor-pointer"
              title="โหลดข้อมูลตัวอย่าง มีนาคม 2569"
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-blue-950 shrink-0" />
              <span>โหลดตัวอย่าง</span>
            </button>

            {/* Download Excel Template */}
            <button
              type="button"
              id="btn-download-excel-template"
              onClick={generateExcelTemplate}
              className="hidden md:flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold text-yellow-300 bg-blue-900/80 hover:bg-blue-800 border border-yellow-400/40 rounded-xl transition-colors cursor-pointer"
              title="ดาวน์โหลดไฟล์แม่แบบ Excel เพื่อนำไปกรอกข้อมูล"
            >
              <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 shrink-0" />
              <span>แม่แบบ Excel</span>
            </button>

            {/* Manage Inspectors */}
            <button
              type="button"
              id="btn-manage-inspectors-nav"
              onClick={onOpenInspectorModal}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold text-white bg-blue-800 hover:bg-blue-700 border border-blue-600 rounded-xl transition-colors cursor-pointer"
            >
              <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 shrink-0" />
              <span>ผู้ตรวจ ({totalInspectors})</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
