import { Inspector } from '../types';
import {
  cleanInspectorFullName,
  extractFirstNameOnly,
  convertToTransparentPng,
  rotateDataUrlToVertical,
} from './signatureUtils';
import { saveSignatureToVault } from './signatureStorage';

export interface BatchSignatureMatchResult {
  matchedCount: number;
  matchedInspectors: { inspector: Inspector; fileName: string }[];
  unmatchedFiles: { file: File; dataUrl: string; detectedName: string }[];
  updatedInspectors: Inspector[];
}

/**
 * Clean a filename to extract the probable person's name
 * e.g. "ลายเซ็น_นายชญานนท์ เชื้อคำ.png" -> "นายชญานนท์ เชื้อคำ"
 * "01_ชญานนท์.jpg" -> "ชญานนท์"
 */
export function extractProbableNameFromFileName(fileName: string): string {
  if (!fileName) return '';

  // Remove file extension
  let name = fileName.replace(/\.[a-zA-Z0-9]+$/i, '').trim();

  // Remove common prefixes
  name = name.replace(/^(ลายเซ็น|ลายมือชื่อ|signature|sig|img|image|scan|รูป|รูปภาพ)[_\-\s]*/i, '');
  name = name.replace(/^[0-9]+[_\-\s]+/, ''); // leading numbers e.g. "01_"
  name = name.replace(/[_\-\s]+(ลายเซ็น|signature|sig)$/i, '');

  return name.trim();
}

/**
 * Find the best matching inspector for a given filename or query string
 */
export function findMatchingInspector(
  query: string,
  inspectors: Inspector[]
): Inspector | null {
  if (!query || !inspectors || inspectors.length === 0) return null;

  const cleanQuery = cleanInspectorFullName(query).toLowerCase().replace(/\s+/g, '');
  const rawQuery = query.toLowerCase().replace(/\s+/g, '');

  // 1. Exact match with inspector name or ID
  for (const insp of inspectors) {
    const inspRaw = insp.name.toLowerCase().replace(/\s+/g, '');
    const inspClean = cleanInspectorFullName(insp.name).toLowerCase().replace(/\s+/g, '');
    const inspId = (insp.id || '').toLowerCase().replace(/\s+/g, '');

    if (rawQuery === inspRaw || cleanQuery === inspClean || rawQuery === inspId) {
      return insp;
    }
  }

  // 2. Check Aliases
  for (const insp of inspectors) {
    if (insp.aliases && insp.aliases.length > 0) {
      for (const alias of insp.aliases) {
        const aliasClean = cleanInspectorFullName(alias).toLowerCase().replace(/\s+/g, '');
        if (cleanQuery === aliasClean || rawQuery === aliasClean) {
          return insp;
        }
      }
    }
  }

  // 3. First Name Match (e.g. "ชญานนท์")
  const queryFirstName = extractFirstNameOnly(query).toLowerCase().trim();
  if (queryFirstName && queryFirstName.length >= 2) {
    const firstNameMatches = inspectors.filter((insp) => {
      const inspFirstName = extractFirstNameOnly(insp.name).toLowerCase().trim();
      return inspFirstName === queryFirstName;
    });

    if (firstNameMatches.length === 1) {
      return firstNameMatches[0];
    }
  }

  // 4. Substring Match
  for (const insp of inspectors) {
    const inspClean = cleanInspectorFullName(insp.name).toLowerCase().replace(/\s+/g, '');
    if (inspClean.length >= 3 && cleanQuery.length >= 3) {
      if (cleanQuery.includes(inspClean) || inspClean.includes(cleanQuery)) {
        return insp;
      }
    }
  }

  return null;
}

/**
 * Process multiple signature image files in batch,
 * convert to transparent PNGs, rotate vertically,
 * match against inspector list, and save to permanent vault.
 */
export async function processBatchSignatureFiles(
  files: File[],
  currentInspectors: Inspector[]
): Promise<BatchSignatureMatchResult> {
  let updatedInspectors = [...currentInspectors];
  const matchedInspectors: { inspector: Inspector; fileName: string }[] = [];
  const unmatchedFiles: { file: File; dataUrl: string; detectedName: string }[] = [];

  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      // Clean paper background and generate transparent horizontal PNG
      const cleanPng = await convertToTransparentPng(dataUrl);
      const verticalSig = await rotateDataUrlToVertical(cleanPng, -90);

      const probableName = extractProbableNameFromFileName(file.name);
      const matched = findMatchingInspector(probableName, updatedInspectors);

      if (matched) {
        const updatedInsp: Inspector = {
          ...matched,
          signatureDataUrl: cleanPng,
          verticalSignatureDataUrl: verticalSig,
          isCustomSignature: true,
          uploadedAt: new Date().toISOString(),
          originalFileName: file.name,
        };

        // Update in inspectors list
        updatedInspectors = updatedInspectors.map((i) =>
          i.id === matched.id ? updatedInsp : i
        );

        // Permanently persist in vault
        await saveSignatureToVault({
          id: updatedInsp.id,
          name: updatedInsp.name,
          cleanName: cleanInspectorFullName(updatedInsp.name),
          signatureDataUrl: cleanPng,
          verticalSignatureDataUrl: verticalSig,
          isCustomSignature: true,
          uploadedAt: updatedInsp.uploadedAt!,
          originalFileName: file.name,
          position: updatedInsp.position,
          department: updatedInsp.department,
        });

        matchedInspectors.push({ inspector: updatedInsp, fileName: file.name });
      } else {
        unmatchedFiles.push({
          file,
          dataUrl: cleanPng,
          detectedName: probableName || file.name,
        });
      }
    } catch (err) {
      console.warn('Failed to process signature file:', file.name, err);
    }
  }

  return {
    matchedCount: matchedInspectors.length,
    matchedInspectors,
    unmatchedFiles,
    updatedInspectors,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
