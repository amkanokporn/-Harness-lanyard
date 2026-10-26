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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Logo & Title - กฟผ. โทนน้ำเงิน-เหลือง เรียบๆ สบายตา อ่านง่าย */}
          <div className="flex items-center gap-3.5 shrink-0">
            <div className="w-11 h-11 rounded-xl bg-[#1e3a8a] text-[#fbbf24] flex items-center justify-center font-bold shadow-2xs shrink-0">
              <ShieldCheck className="w-6.5 h-6.5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-[#1e3a8a] tracking-tight">
                  ระบบรายงานตรวจอุปกรณ์ก่อนการใช้งาน
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 text-xs sm:text-sm font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-md">
                  FM-004/QP-PB-013 (กฟผ.)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Full Body Harness & Lanyard (ส่งออก PDF & Word 13.5pt พอดีหน้า A4 แนวนอน)
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* โหลดข้อมูลตัวอย่าง */}
            <button
              type="button"
              id="btn-load-sample-data"
              onClick={onLoadSampleData}
              className="flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#1e3a8a] bg-blue-50/90 hover:bg-blue-100 border border-blue-200/80 rounded-xl transition-colors cursor-pointer"
              title="โหลดข้อมูลตัวอย่าง มีนาคม 2569"
            >
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="hidden sm:inline">ข้อมูลตัวอย่าง</span>
              <span className="sm:hidden">ตัวอย่าง</span>
            </button>

            {/* แม่แบบ Excel */}
            <button
              type="button"
              id="btn-download-excel-template"
              onClick={generateExcelTemplate}
              className="hidden md:flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              title="ดาวน์โหลดไฟล์แม่แบบ Excel เพื่อนำไปกรอกข้อมูล"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>แม่แบบ Excel</span>
            </button>

            {/* จัดการรายชื่อผู้ตรวจ */}
            <button
              type="button"
              id="btn-manage-inspectors-nav"
              onClick={onOpenInspectorModal}
              className="flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#1e3a8a] bg-amber-50/90 hover:bg-amber-100 border border-amber-300/80 rounded-xl transition-colors cursor-pointer"
              title="จัดการรายชื่อผู้ตรวจและลายเซ็น"
            >
              <UserCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>ผู้ตรวจ ({totalInspectors})</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
