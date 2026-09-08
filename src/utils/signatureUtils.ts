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

/**
 * Generates an authentic Thai cursive handwritten digital signature rendered onto a transparent HTML5 canvas.
 * Renders full name styling with rich cursive strokes, flowing baseline underline, and flourishes.
 * Returns both horizontal (for summary boxes) and vertical rotated -90deg (for day columns).
 */
export function generateDigitalSignaturePng(
  fullName: string,
  seedStr?: string
): { horizontal: string; vertical: string } {
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

  const horizontalDataUrl = hCanvas.toDataURL('image/png');

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

  const verticalDataUrl = vCanvas.toDataURL('image/png');

  return {
    horizontal: horizontalDataUrl,
    vertical: verticalDataUrl,
  };
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
 * Takes any image Data URL (uploaded or drawn) and creates a 90-degree rotated
 * vertical PNG Data URL.
 */
export async function rotateDataUrlToVertical(
  dataUrl: string,
  angle: number = -90 // -90 deg rotates upwards (counter-clockwise)
): Promise<string> {
  if (!dataUrl) return '';

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const rads = (angle * Math.PI) / 180;
        const isRotated90 = Math.abs(angle % 180) === 90;

        canvas.width = isRotated90 ? img.height : img.width;
        canvas.height = isRotated90 ? img.width : img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rads);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('Canvas rotation error:', e);
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
}
