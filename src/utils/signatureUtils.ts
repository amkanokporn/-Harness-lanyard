import { Inspector } from '../types';

/**
 * Signature Utility Module
 * Handles creation of authentic Thai digital cursive handwritten signatures
 * from inspector full name / clean name,
 * 90-degree vertical rotation for tall narrow day-column cells,
 * and binary conversions for Microsoft Word (DOCX) ImageRun and PDF Canvas.
 */

/**
 * Removes Thai and English titles, ranks, and prefixes from a full name,
 * returning the clean full name (e.g. "นายชญานนท์ เชื้อคำ" -> "ชญานนท์ เชื้อคำ").
 */
export function cleanInspectorFullName(fullName: string): string {
  if (!fullName) return 'ผู้ตรวจสอบ';

  // 1. Remove leading/trailing whitespaces and common parentheses/brackets
  let clean = fullName.replace(/\(.*?\)|\[.*?\]/g, '').trim();

  // 2. Remove common Thai and English titles / rank prefixes
  const prefixRegex = /^(นาย|นางสาว|นาง|น\.ส\.|นส\.|ด\.ช\.|ด\.ญ\.|คุณ|ดร\.|อาจารย์|อ\.|ผศ\.|รศ\.|ศ\.|นพ\.|พญ\.|นายแพทย์|แพทย์หญิง|ส\.อ\.|ส\.ท\.|ส\.ต\.|จ\.ส\.อ\.|จ\.ส\.ท\.|จ\.ส\.ต\.|ร\.ต\.|ร\.ท\.|ร\.อ\.|พ\.ต\.|พ\.ท\.|พ\.อ\.|พ\.ต\.ต\.|พ\.ต\.ท\.|พ\.ต\.อ\.|ด\.ต\.|ส\.ต\.ต\.|ส\.ต\.ท\.|ส\.ต\.อ\.|ว่าที่\s*ร\.ต\.|ว่าที่ร้อยตรี|Mr\.|Mrs\.|Miss|Ms\.|Dr\.)\s*/i;

  while (prefixRegex.test(clean)) {
    clean = clean.replace(prefixRegex, '').trim();
  }

  return clean.replace(/\s+/g, ' ') || fullName.trim() || 'ผู้ตรวจสอบ';
}

/**
 * Extracts ONLY the first name from a full name string, removing any Thai/English titles,
 * prefixes and removing any surname.
 */
export function extractFirstNameOnly(fullName: string): string {
  const clean = cleanInspectorFullName(fullName);
  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length > 0) {
    return tokens[0];
  }
  return clean || 'ผู้ตรวจสอบ';
}

// Global In-Memory Cache for Generated Signatures to ensure 0ms instant re-renders
const SIGNATURE_PNG_CACHE = new Map<string, { horizontal: string; vertical: string }>();

/**
 * Generates an authentic Thai cursive handwritten digital signature rendered onto a transparent HTML5 canvas.
 * Renders full name styling with rich cursive strokes, flowing baseline underline, and flourishes.
 * Returns both horizontal (for summary boxes) and vertical rotated -90deg (for day columns).
 * Cached in memory for instant high-performance rendering.
 */
export function generateDigitalSignaturePng(
  fullName: string,
  seedStr?: string
): { horizontal: string; vertical: string } {
  const cacheKey = `${fullName || 'ผู้ตรวจสอบ'}:::${seedStr || ''}`;
  const cached = SIGNATURE_PNG_CACHE.get(cacheKey);
  if (cached) return cached;

  const cleanName = cleanInspectorFullName(fullName);
  const firstName = extractFirstNameOnly(fullName);

  // Deterministic seed for reproducible styling per person
  const seedKey = seedStr || fullName;
  const seed = seedKey
    .split('')
    .reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1) * 31, 137);

  const pseudoRandom = (offset: number) => {
    const x = Math.sin(seed + offset * 79.19) * 10000;
    return x - Math.floor(x);
  };

  // 1. Draw Horizontal Signature Canvas (560 x 180 for ultra crisp high-DPI rendering)
  const hCanvas = document.createElement('canvas');
  hCanvas.width = 560;
  hCanvas.height = 180;
  const hCtx = hCanvas.getContext('2d');

  if (hCtx) {
    hCtx.clearRect(0, 0, 560, 180);
    hCtx.lineCap = 'round';
    hCtx.lineJoin = 'round';

    // Ballpoint / Fountain pen dark blue ink palette
    const inkColors = [
      '#1e3a8a', // classic dark blue
      '#1e40af', // rich royal blue
      '#0f2b6e', // navy ink
      '#172554', // deep midnight ink
      '#1d4ed8', // blue ink
    ];
    const inkColor = inkColors[Math.floor(pseudoRandom(1) * inkColors.length)];

    // Slight natural handwriting slant (-2 to -4.5 degrees)
    const slantDeg = -2.5 - pseudoRandom(2) * 2.5;
    const slantRad = (slantDeg * Math.PI) / 180;

    hCtx.save();
    hCtx.translate(280, 90);
    hCtx.rotate(slantRad);
    hCtx.translate(-280, -90);

    // Font styling for Thai cursive handwriting
    const fontFamilies = [
      '"Charm", "Charmonman", "Sriracha", "Mali", "Brush Script MT", "Segoe Script", cursive, sans-serif',
      '"Charmonman", "Charm", "Sriracha", "Mali", "Brush Script MT", "Segoe Script", cursive, sans-serif',
      '"Sriracha", "Charm", "Charmonman", "Mali", "Brush Script MT", "Segoe Script", cursive, sans-serif',
    ];
    const fontChoice = fontFamilies[Math.floor(pseudoRandom(3) * fontFamilies.length)];

    // For horizontal signature: display full clean name if reasonable, or first name + initial
    let displayText = cleanName;
    if (displayText.length > 20) {
      const tokens = displayText.split(' ');
      if (tokens.length > 1) {
        displayText = `${tokens[0]} ${tokens[1].charAt(0)}.`;
      }
    }

    // Dynamic font size based on text length
    let fontSize = 52;
    if (displayText.length > 8) fontSize = 44;
    if (displayText.length > 12) fontSize = 38;
    if (displayText.length > 16) fontSize = 32;

    hCtx.font = `italic bold ${fontSize}px ${fontChoice}`;
    hCtx.fillStyle = inkColor;
    hCtx.strokeStyle = inkColor;

    // Measure text to center and align embellishments
    const textMetrics = hCtx.measureText(displayText);
    const textWidth = Math.min(textMetrics.width, 420);
    const startX = Math.max(35, (560 - textWidth) / 2 - 20);
    const textY = 94;

    // 1. Initial Entry Loop/Flourish (smooth ink lead-in)
    hCtx.beginPath();
    hCtx.lineWidth = 3.8;
    const entryStartX = startX - 22 - pseudoRandom(4) * 10;
    const entryStartY = textY + 12 + (pseudoRandom(5) - 0.5) * 8;
    hCtx.moveTo(entryStartX, entryStartY);
    hCtx.quadraticCurveTo(
      entryStartX + 14,
      textY - 22 + pseudoRandom(6) * 8,
      startX - 3,
      textY - 4
    );
    hCtx.stroke();

    // 2. Render Cursive Name
    hCtx.fillText(displayText, startX, textY);

    // 3. Flowing signature baseline underline swoop (หางตวัดลายเซ็นเต็มชื่อ)
    const underlineStartX = startX - 14;
    const underlineEndX = startX + textWidth + 38 + pseudoRandom(7) * 20;
    const midX = (underlineStartX + underlineEndX) / 2;

    hCtx.beginPath();
    hCtx.lineWidth = 4.2;
    hCtx.moveTo(underlineStartX, textY + 18);
    hCtx.bezierCurveTo(
      midX - 30 + pseudoRandom(8) * 25,
      textY + 34 + pseudoRandom(9) * 8,
      midX + 45 + pseudoRandom(10) * 25,
      textY + 8 + pseudoRandom(11) * 8,
      underlineEndX,
      textY + 16 + (pseudoRandom(12) - 0.5) * 10
    );
    hCtx.stroke();

    // 4. Stylish end flick / flourish
    hCtx.beginPath();
    hCtx.lineWidth = 3.4;
    const flickStartX = underlineEndX - 6;
    const flickStartY = textY + 16;
    hCtx.moveTo(flickStartX, flickStartY);
    hCtx.quadraticCurveTo(
      flickStartX + 16 + pseudoRandom(13) * 8,
      flickStartY - 22 - pseudoRandom(14) * 10,
      flickStartX + 26 + pseudoRandom(15) * 10,
      flickStartY - 34 - pseudoRandom(16) * 12
    );
    hCtx.stroke();

    hCtx.restore();
  }

  // Trim empty margins and guarantee 100% transparent PNG
  const horizontalDataUrl = trimAndMakeTransparentPng(hCanvas, { padding: 8 });

  // 2. Draw Vertical Rotated Signature (-90 degrees: rotated up, reading bottom to top for day columns)
  // For vertical day cells, we use the first name or clean name so it fits the tall narrow cell with full letters
  const vSourceCanvas = document.createElement('canvas');
  vSourceCanvas.width = 480;
  vSourceCanvas.height = 160;
  const vsCtx = vSourceCanvas.getContext('2d');

  if (vsCtx) {
    vsCtx.clearRect(0, 0, 480, 160);
    vsCtx.lineCap = 'round';
    vsCtx.lineJoin = 'round';

    const inkColors = ['#1e3a8a', '#1e40af', '#0f2b6e', '#172554', '#1d4ed8'];
    const inkColor = inkColors[Math.floor(pseudoRandom(1) * inkColors.length)];

    const slantDeg = -2.5 - pseudoRandom(2) * 2.5;
    const slantRad = (slantDeg * Math.PI) / 180;

    vsCtx.save();
    vsCtx.translate(240, 80);
    vsCtx.rotate(slantRad);
    vsCtx.translate(-240, -80);

    const fontFamilies = [
      '"Charm", "Charmonman", "Sriracha", "Mali", "Brush Script MT", "Segoe Script", cursive, sans-serif',
      '"Charmonman", "Charm", "Sriracha", "Mali", "Brush Script MT", "Segoe Script", cursive, sans-serif',
      '"Sriracha", "Charm", "Charmonman", "Mali", "Brush Script MT", "Segoe Script", cursive, sans-serif',
    ];
    const fontChoice = fontFamilies[Math.floor(pseudoRandom(3) * fontFamilies.length)];

    let fontSize = 52;
    if (firstName.length > 7) fontSize = 44;
    if (firstName.length > 10) fontSize = 38;

    vsCtx.font = `italic bold ${fontSize}px ${fontChoice}`;
    vsCtx.fillStyle = inkColor;
    vsCtx.strokeStyle = inkColor;

    const textMetrics = vsCtx.measureText(firstName);
    const textWidth = Math.min(textMetrics.width, 340);
    const startX = Math.max(30, (480 - textWidth) / 2 - 18);
    const textY = 82;

    // Entry swoop
    vsCtx.beginPath();
    vsCtx.lineWidth = 3.6;
    const entryStartX = startX - 20 - pseudoRandom(4) * 8;
    const entryStartY = textY + 10;
    vsCtx.moveTo(entryStartX, entryStartY);
    vsCtx.quadraticCurveTo(entryStartX + 12, textY - 18, startX - 2, textY - 3);
    vsCtx.stroke();

    // Render First Name
    vsCtx.fillText(firstName, startX, textY);

    // Baseline underline
    const underlineStartX = startX - 10;
    const underlineEndX = startX + textWidth + 32 + pseudoRandom(7) * 16;
    const midX = (underlineStartX + underlineEndX) / 2;

    vsCtx.beginPath();
    vsCtx.lineWidth = 4.0;
    vsCtx.moveTo(underlineStartX, textY + 18);
    vsCtx.bezierCurveTo(
      midX - 24,
      textY + 30,
      midX + 35,
      textY + 6,
      underlineEndX,
      textY + 14
    );
    vsCtx.stroke();

    // Flick
    vsCtx.beginPath();
    vsCtx.lineWidth = 3.2;
    vsCtx.moveTo(underlineEndX - 4, textY + 14);
    vsCtx.quadraticCurveTo(
      underlineEndX + 14,
      textY - 18,
      underlineEndX + 22,
      textY - 28
    );
    vsCtx.stroke();

    vsCtx.restore();
  }

  const vCanvas = document.createElement('canvas');
  vCanvas.width = 160;
  vCanvas.height = 480;
  const vCtx = vCanvas.getContext('2d');

  if (vCtx) {
    vCtx.clearRect(0, 0, 160, 480);
    vCtx.translate(80, 240);
    vCtx.rotate((-90 * Math.PI) / 180); // Rotate 90 degrees counter-clockwise
    vCtx.drawImage(vSourceCanvas, -240, -80);
  }

  // Trim empty margins and guarantee 100% transparent PNG
  const verticalDataUrl = trimAndMakeTransparentPng(vCanvas, { padding: 4 });

  const result = {
    horizontal: horizontalDataUrl,
    vertical: verticalDataUrl,
  };

  SIGNATURE_PNG_CACHE.set(cacheKey, result);
  return result;
}

/**
 * Crops transparent margins and removes white/light paper background if needed,
 * outputting a clean high-resolution .PNG with transparent background.
 */
export function trimAndMakeTransparentPng(
  sourceCanvas: HTMLCanvasElement,
  options?: { padding?: number; removeLightBackground?: boolean }
): string {
  const { padding = 6, removeLightBackground = false } = options || {};
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || width === 0 || height === 0) {
    return sourceCanvas.toDataURL('image/png');
  }

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 1. If removeLightBackground requested, sample corners to detect paper background luminance
  let bgBrightness = 255;
  if (removeLightBackground) {
    const sampleBrightness: number[] = [];
    const cornerSize = Math.max(3, Math.min(15, Math.floor(Math.min(width, height) / 8)));

    // Sample top-left, top-right, bottom-left, bottom-right corners
    const checkCoords = [
      { x0: 0, y0: 0 },
      { x0: width - cornerSize, y0: 0 },
      { x0: 0, y0: height - cornerSize },
      { x0: width - cornerSize, y0: height - cornerSize },
    ];

    for (const c of checkCoords) {
      for (let cy = 0; cy < cornerSize; cy++) {
        for (let cx = 0; cx < cornerSize; cx++) {
          const px = Math.min(width - 1, Math.max(0, c.x0 + cx));
          const py = Math.min(height - 1, Math.max(0, c.y0 + cy));
          const idx = (py * width + px) * 4;
          const a = data[idx + 3];
          if (a > 20) {
            const b = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
            sampleBrightness.push(b);
          }
        }
      }
    }

    if (sampleBrightness.length > 0) {
      sampleBrightness.sort((a, b) => a - b);
      // Pick upper quartile as representative paper brightness
      bgBrightness = sampleBrightness[Math.floor(sampleBrightness.length * 0.75)] || 255;
    }
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let foundInk = false;

  const bgThreshold = Math.max(190, bgBrightness - 25);
  const transitionThreshold = Math.max(130, bgThreshold - 60);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      let a = data[idx + 3];

      if (removeLightBackground) {
        const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        if (brightness >= bgThreshold) {
          // Paper background -> completely transparent
          a = 0;
        } else if (brightness >= transitionThreshold) {
          // Smooth antialiasing between paper and ink
          const factor = (brightness - transitionThreshold) / (bgThreshold - transitionThreshold);
          const alphaFactor = Math.max(0, Math.min(1, 1 - Math.pow(factor, 1.4)));
          a = Math.round(a * alphaFactor);
        } else {
          // Rich ink stroke: increase contrast
          data[idx] = Math.max(0, Math.round(r * 0.85));
          data[idx + 1] = Math.max(0, Math.round(g * 0.85));
          data[idx + 2] = Math.max(0, Math.round(b * 0.85));
        }
        data[idx + 3] = a;
      }

      if (a > 20) {
        foundInk = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (removeLightBackground) {
    ctx.putImageData(imgData, 0, 0);
  }

  if (!foundInk || maxX < minX || maxY < minY) {
    return sourceCanvas.toDataURL('image/png');
  }

  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropW = Math.min(width - cropX, maxX - minX + padding * 2);
  const cropH = Math.min(height - cropY, maxY - minY + padding * 2);

  if (cropW <= 2 || cropH <= 2) {
    return sourceCanvas.toDataURL('image/png');
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = cropW;
  outCanvas.height = cropH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) {
    return sourceCanvas.toDataURL('image/png');
  }

  outCtx.clearRect(0, 0, cropW, cropH);
  outCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return outCanvas.toDataURL('image/png');
}

/**
 * Converts any image Data URL (JPG, WebP, opaque PNG, or drawn signature)
 * to a clean, transparent-background .PNG image without paper artifacts.
 */
export async function convertToTransparentPng(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return dataUrl || '';

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w === 0 || h === 0) {
          resolve(dataUrl);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const transparentPng = trimAndMakeTransparentPng(canvas, {
          padding: 8,
          removeLightBackground: true,
        });
        resolve(transparentPng);
      } catch (e) {
        console.warn('convertToTransparentPng error:', e);
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Ensures an Inspector object has 100% valid non-empty horizontal and vertical signature data URLs.
 * If missing, corrupt, or empty, automatically generates authentic Thai cursive ink signatures from their first name.
 */
export function ensureInspectorSignatures(inspector: Inspector): Inspector {
  let sig = inspector.signatureDataUrl;
  let vertSig = inspector.verticalSignatureDataUrl;

  const isValidDataUrl = (str?: string) =>
    Boolean(str && typeof str === 'string' && str.startsWith('data:image/'));

  if (!isValidDataUrl(sig) || !isValidDataUrl(vertSig)) {
    const generated = generateDigitalSignaturePng(inspector.name || 'ผู้ตรวจสอบ', inspector.id || inspector.name);
    if (!isValidDataUrl(sig)) sig = generated.horizontal;
    if (!isValidDataUrl(vertSig)) vertSig = generated.vertical;
  }

  return {
    ...inspector,
    signatureDataUrl: sig,
    verticalSignatureDataUrl: vertSig,
  };
}

/**
 * Converts a base64 DataURL (image/png, image/jpeg, etc.) into a Uint8Array
 * for docx ImageRun embedding.
 */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  if (!dataUrl || !dataUrl.includes(',')) return null;
  try {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    console.warn('Failed to convert dataUrl to Uint8Array', err);
    return null;
  }
}

/**
 * Converts a signature DataURL into a Uint8Array specifically for Microsoft Word (DOCX).
 * Pre-fills the canvas with a solid white (#ffffff) background.
 * CRITICAL FIX: Microsoft Word's Windows Print-to-PDF / Save-as-PDF engine drops alpha transparency
 * inside table cells and renders transparent RGBA(0,0,0,0) as SOLID BLACK rectangles!
 * By rendering onto a solid white background, Word displays the signature seamlessly on the white table cell
 * AND exports to PDF with a clean white background, completely eliminating the black boxes.
 */
export async function convertSignatureForDocx(dataUrl: string): Promise<Uint8Array | null> {
  if (!dataUrl || !dataUrl.includes(',')) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width || 120;
        const h = img.naturalHeight || img.height || 60;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrlToUint8Array(dataUrl));
          return;
        }

        // Fill solid white background (#ffffff)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const whitePngDataUrl = canvas.toDataURL('image/png');
        resolve(dataUrlToUint8Array(whitePngDataUrl));
      } catch (err) {
        console.warn('convertSignatureForDocx error:', err);
        resolve(dataUrlToUint8Array(dataUrl));
      }
    };
    img.onerror = () => {
      resolve(dataUrlToUint8Array(dataUrl));
    };
    img.src = dataUrl;
  });
}

/**
 * Takes any image Data URL (uploaded or drawn) and creates a 90-degree rotated
 * vertical PNG Data URL with 100% transparent background.
 */
export async function rotateDataUrlToVertical(
  dataUrl: string,
  angle: number = -90 // -90 deg rotates upwards (counter-clockwise)
): Promise<string> {
  if (!dataUrl) return '';

  const cleanPng = await convertToTransparentPng(dataUrl);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width;
        const naturalH = img.naturalHeight || img.height;
        if (naturalW === 0 || naturalH === 0) {
          resolve(cleanPng);
          return;
        }

        const canvas = document.createElement('canvas');
        const rads = (angle * Math.PI) / 180;
        const isRotated90 = Math.abs(angle % 180) === 90;

        canvas.width = isRotated90 ? naturalH : naturalW;
        canvas.height = isRotated90 ? naturalW : naturalH;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(cleanPng);
          return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rads);
        ctx.drawImage(img, -naturalW / 2, -naturalH / 2);

        // Trim empty padding and guarantee transparent PNG
        const verticalPng = trimAndMakeTransparentPng(canvas, {
          padding: 4,
          removeLightBackground: true,
        });
        resolve(verticalPng);
      } catch (e) {
        console.warn('Canvas rotation error:', e);
        resolve(cleanPng);
      }
    };
    img.onerror = () => {
      resolve(cleanPng);
    };
    img.src = cleanPng;
  });
}
