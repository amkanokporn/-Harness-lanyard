import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export interface GeneratePdfOptions {
  elementIds: string[]; // DOM IDs of template containers to export
  fileName?: string;
  onProgress?: (step: number, total: number, message: string) => void;
}

/**
 * Sanitizes CSS text to replace modern color functions (oklch, oklab, lch, lab, color-mix)
 * which cause html2canvas to fail with:
 * "Attempting to parse an unsupported color function 'oklch'"
 */
function sanitizeCssString(css: string): string {
  return css
    .replace(/oklch\([^)]*\)/gi, '#1e293b')
    .replace(/oklab\([^)]*\)/gi, '#1e293b')
    .replace(/lch\([^)]*\)/gi, '#1e293b')
    .replace(/lab\([^)]*\)/gi, '#1e293b')
    .replace(/color-mix\([^)]*\)/gi, '#1e293b');
}

/**
 * Generates an A4 Landscape PDF from specified HTML element containers.
 * Uses an isolated offscreen DOM container to ensure zero distortion,
 * no CSS transform/zoom interference, and no tab-visibility bugs.
 */
export async function generatePdfFromElements({
  elementIds,
  fileName = 'รายงานตรวจสอบเครื่องมืออุปกรณ์ก่อนการใช้งาน.pdf',
  onProgress,
}: GeneratePdfOptions): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const total = elementIds.length;
  let pageAdded = false;

  // Create an isolated, fixed offscreen stage for 100% reliable rendering
  const offscreenStage = document.createElement('div');
  offscreenStage.id = 'pdf-isolated-render-stage';
  offscreenStage.style.position = 'fixed';
  offscreenStage.style.top = '0';
  offscreenStage.style.left = '0';
  offscreenStage.style.width = '1122px';
  offscreenStage.style.height = '793px';
  offscreenStage.style.overflow = 'visible';
  offscreenStage.style.zIndex = '-99999';
  offscreenStage.style.background = '#ffffff';
  offscreenStage.style.transform = 'none';
  offscreenStage.style.display = 'block';
  offscreenStage.style.visibility = 'visible';
  offscreenStage.style.pointerEvents = 'none';
  document.body.appendChild(offscreenStage);

  try {
    for (let i = 0; i < total; i++) {
      const elId = elementIds[i];
      const sourceEl = document.getElementById(elId);

      if (!sourceEl) {
        console.warn(`Element with ID ${elId} not found`);
        continue;
      }

      if (onProgress) {
        onProgress(i + 1, total, `กำลังประมวลผลหน้าที่ ${i + 1} จาก ${total}...`);
      }

      // Clone node into offscreen stage to decouple from preview zoom or parent hidden styles
      offscreenStage.innerHTML = '';
      const clonedNode = sourceEl.cloneNode(true) as HTMLElement;
      clonedNode.style.display = 'block';
      clonedNode.style.transform = 'none';
      clonedNode.style.margin = '0';
      clonedNode.style.visibility = 'visible';
      clonedNode.style.width = '1122px';
      clonedNode.style.height = '793px';
      clonedNode.style.minHeight = '793px';
      clonedNode.style.maxHeight = '793px';
      clonedNode.style.boxSizing = 'border-box';
      offscreenStage.appendChild(clonedNode);

      // Wait for fonts to be ready
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Wait for images inside clonedNode to load and decode properly
      const imgs = Array.from(clonedNode.querySelectorAll('img'));
      await Promise.all(
        imgs.map(async (img) => {
          if (!img.complete) {
            await new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          }
          if (typeof img.decode === 'function') {
            await img.decode().catch(() => {});
          }
        })
      );

      // Pre-calculate exact proportional dimensions for all images to guarantee zero distortion in PDF.
      // html2canvas does not reliably implement CSS object-fit: contain on flex child images,
      // so locking explicit pixel width & height preserving natural aspect ratio ensures 100% distortion-free rendering.
      imgs.forEach((img) => {
        const naturalW = img.naturalWidth || 1;
        const naturalH = img.naturalHeight || 1;
        const aspect = naturalW / naturalH;

        const parent = img.parentElement;
        const parentW = parent ? parent.clientWidth : 20;
        const parentH = parent ? parent.clientHeight : 35;

        const comp = window.getComputedStyle(img);
        const maxW = parseFloat(comp.maxWidth) || parentW || 20;
        const maxH = parseFloat(comp.maxHeight) || parentH || 35;

        const availW = Math.max(4, Math.min(parentW > 0 ? parentW : maxW, maxW));
        const availH = Math.max(4, Math.min(parentH > 0 ? parentH : maxH, maxH));

        let fittedW = availW;
        let fittedH = fittedW / aspect;
        if (fittedH > availH) {
          fittedH = availH;
          fittedW = fittedH * aspect;
        }

        const finalW = Math.max(1, Math.round(fittedW));
        const finalH = Math.max(1, Math.round(fittedH));

        img.style.width = `${finalW}px`;
        img.style.height = `${finalH}px`;
        img.style.maxWidth = `${finalW}px`;
        img.style.maxHeight = `${finalH}px`;
        img.style.minWidth = '0';
        img.style.minHeight = '0';
        img.style.objectFit = 'fill';
        img.style.display = 'block';
        img.style.margin = 'auto';
        img.style.backgroundColor = 'transparent';
      });

      // Brief tick for final layout stabilization
      await new Promise((r) => setTimeout(r, 100));

      const canvas = await html2canvas(clonedNode, {
        scale: 2.5, // 2.5x scale produces high-DPI crisp vector-like text without memory exhaustion
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: false,
        logging: false,
        backgroundColor: '#ffffff',
        width: 1122,
        height: 793,
        windowWidth: 1122,
        windowHeight: 793,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          // Sanitize all <style> tags in cloned document to remove any oklch(...) generated by Tailwind v4
          const styleTags = clonedDoc.querySelectorAll('style');
          styleTags.forEach((styleTag) => {
            if (styleTag.textContent) {
              styleTag.textContent = sanitizeCssString(styleTag.textContent);
            }
          });

          // Also sanitize inline styles on all elements in clonedDoc
          const allNodes = clonedDoc.querySelectorAll('*');
          allNodes.forEach((node) => {
            const el = node as HTMLElement;
            if (el.style && el.style.cssText && /oklch|oklab|lch|lab|color-mix/i.test(el.style.cssText)) {
              el.style.cssText = sanitizeCssString(el.style.cssText);
            }
          });

          // Ensure all signature and checklist images in clonedDoc are crisp, visible, and transparent
          const clonedImgs = clonedDoc.querySelectorAll('img');
          clonedImgs.forEach((img) => {
            img.style.visibility = 'visible';
            img.style.opacity = '1';
            img.style.backgroundColor = 'transparent';
            img.removeAttribute('crossorigin');
          });
        },
      });

      // Use PNG for razor-sharp lines and text
      const imgData = canvas.toDataURL('image/png');

      if (pageAdded) {
        pdf.addPage('a4', 'landscape');
      }

      // A4 Landscape is 297 x 210 mm
      const pdfWidth = 297;
      const pdfHeight = 210;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pageAdded = true;
    }
  } finally {
    // Clean up offscreen stage
    if (offscreenStage.parentNode) {
      offscreenStage.parentNode.removeChild(offscreenStage);
    }
  }

  if (onProgress) {
    onProgress(total, total, 'สร้างเอกสาร PDF เรียบร้อยแล้ว');
  }

  pdf.save(fileName);
  return pdf.output('blob');
}


