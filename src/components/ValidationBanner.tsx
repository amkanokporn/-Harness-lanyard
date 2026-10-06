import React from 'react';
import { ValidationIssue } from '../types';
import { AlertTriangle, XCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface ValidationBannerProps {
  issues: ValidationIssue[];
}

export const ValidationBanner: React.FC<ValidationBannerProps> = ({ issues }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (!issues || issues.length === 0) return null;

  const errors = issues.filter((i) => i.type === 'error');
  const warnings = issues.filter((i) => i.type === 'warning');

  const hasErrors = errors.length > 0;

  return (
    <div
      id="validation-banner"
      className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
        hasErrors
          ? 'bg-red-50 border-red-200 text-red-950'
          : 'bg-amber-50 border-amber-200 text-amber-950'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {hasErrors ? (
            <XCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div>
            <h4 className="text-base font-bold text-blue-950">
              {hasErrors
                ? `พบข้อผิดพลาดในข้อมูล (${errors.length} รายการ)`
                : `ข้อควรระวังในการประมวลผล (${warnings.length} รายการ)`}
            </h4>
            <p className="text-sm text-slate-600 mt-0.5">
              {hasErrors
                ? 'ระบบหยุดการสร้าง PDF เพื่อป้องกันความผิดพลาดของข้อมูล กรุณาตรวจสอบรายละเอียดด้านล่าง'
                : 'ข้อมูลสามารถนำไปสร้างรายงานได้ แต่ควรตรวจสอบรายละเอียดบางจุด'}
            </p>
          </div>
        </div>

        {issues.length > 1 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs"
          >
            {isExpanded ? (
              <>
                ย่อรายการ <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                ดูทั้งหมด ({issues.length}) <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Issues list */}
      <div className={`mt-3.5 space-y-2 ${isExpanded || issues.length === 1 ? 'block' : 'hidden'}`}>
        {issues.map((issue, idx) => (
          <div
            key={idx}
            className={`text-sm p-3 rounded-xl flex items-start gap-2.5 ${
              issue.type === 'error'
                ? 'bg-red-100 text-red-900'
                : issue.type === 'warning'
                ? 'bg-amber-100 text-amber-900'
                : 'bg-blue-100 text-blue-900'
            }`}
          >
            <span className="font-bold shrink-0">
              {issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️'}
              {issue.row ? ` แถวที่ ${issue.row}:` : ''}
            </span>
            <span>{issue.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
