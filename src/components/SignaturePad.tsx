import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Check, PenLine } from 'lucide-react';
import { trimAndMakeTransparentPng } from '../utils/signatureUtils';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel?: () => void;
  initialSignature?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onCancel, initialSignature }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI setup
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a'; // Deep navy/black ink
    ctx.lineWidth = 2.5;

    // Load initial signature if exists
    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasContent(true);
      };
      img.src = initialSignature;
    }
  }, [initialSignature]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasContent(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasContent(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const transparentPng = trimAndMakeTransparentPng(canvas, { padding: 6 });
    onSave(transparentPng);
  };

  return (
    <div id="signature-pad-container" className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
        <span className="flex items-center gap-1.5">
          <PenLine className="w-3.5 h-3.5 text-blue-600" />
          ลากเมาส์หรือใช้นิ้วสัมผัสเพื่อเซ็นชื่อในกรอบด้านล่าง
        </span>
        <button
          type="button"
          id="btn-clear-signature"
          onClick={handleClear}
          className="flex items-center gap-1 text-slate-500 hover:text-red-600 transition-colors cursor-pointer text-xs"
        >
          <RotateCcw className="w-3 h-3" />
          ล้างกระดาน
        </button>
      </div>

      <div className="border-2 border-dashed border-slate-300 rounded-lg bg-white overflow-hidden relative shadow-inner">
        <canvas
          ref={canvasRef}
          className="w-full h-36 cursor-crosshair touch-none block"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-sm">
            ลงลายมือชื่อที่นี่
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            id="btn-cancel-signature"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          >
            ยกเลิก
          </button>
        )}
        <button
          type="button"
          id="btn-confirm-signature"
          disabled={!hasContent}
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md shadow-sm transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          บันทึกลายเซ็น
        </button>
      </div>
    </div>
  );
};
