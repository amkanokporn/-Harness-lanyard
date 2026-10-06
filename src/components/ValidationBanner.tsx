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
      className={`rounded-2xl border-2 p-4 transition-all shadow-sm ${
        hasErrors
          ? 'bg-red-50/90 border-red-300 text-red-950'
          : 'bg-yellow-50/90 border-yellow-400/60 text-blue-950'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {hasErrors ? (
            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
          )}
          <div>
            <h4 className="text-sm font-bold text-blue-950">
              {hasErrors
                ? `พบข้อผิดพลาดในข้อมูล (${errors.length} รายการ)`
                : `ข้อควรระวังในการประมวลผล (${warnings.length} รายการ)`}
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
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
            className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            {isExpanded ? (
              <>
                ย่อรายการ <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                ดูทั้งหมด ({issues.length}) <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Issues list */}
      <div className={`mt-3 space-y-1.5 ${isExpanded || issues.length === 1 ? 'block' : 'hidden'}`}>
        {issues.map((issue, idx) => (
          <div
            key={idx}
            className={`text-xs p-2 rounded-md flex items-start gap-2 ${
              issue.type === 'error'
                ? 'bg-red-100/70 text-red-800'
                : issue.type === 'warning'
                ? 'bg-amber-100/70 text-amber-800'
                : 'bg-blue-100/70 text-blue-800'
            }`}
          >
            <span className="font-semibold shrink-0">
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
