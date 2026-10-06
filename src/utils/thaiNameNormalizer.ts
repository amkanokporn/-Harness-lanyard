/**
 * Thai Name Normalization, Grammatical Spelling Correction & Fuzzy Deduplication Module
 *
 * Implements:
 * 1. Rule-based Thai grammatical correction (fixing missing karun/thantakhat, incomplete vowels, common typos)
 * 2. Canonical roster dictionary for EGAT Power Plant safety inspectors
 * 3. Levenshtein string distance and Thai consonant-skeleton similarity algorithms
 * 4. Deduplication and merging of multiple misspelled/variant names into single canonical identities
 */

import { Inspector } from '../types';

export const THAI_NAME_PREFIX_REGEX =
  /^(นาย|นางสาว|นาง|น\.ส\.|นส\.|ด\.ช\.|ด\.ญ\.|คุณ|ดร\.|อาจารย์|อ\.|ผศ\.|รศ\.|ศ\.|นพ\.|พญ\.|นายแพทย์|แพทย์หญิง|ส\.อ\.|ส\.ท\.|ส\.ต\.|จ\.ส\.อ\.|จ\.ส\.ท\.|จ\.ส\.ต\.|ร\.ต\.|ร\.ท\.|ร\.อ\.|พ\.ต\.|พ\.ท\.|พ\.อ\.|พ\.ต\.ต\.|พ\.ต\.ท\.|พ\.ต\.อ\.|ด\.ต\.|ส\.ต\.ต\.|ส\.ต\.ท\.|ส\.ต\.อ\.|ว่าที่\s*ร\.ต\.|ว่าที่ร้อยตรี|Mr\.|Mrs\.|Miss|Ms\.|Dr\.)\s*/i;

export interface CanonicalRosterPerson {
  id: string;
  fullNameWithTitle: string; // "นายชญานนท์ เชื้อคำ"
  cleanFullName: string;     // "ชญานนท์ เชื้อคำ"
  firstName: string;         // "ชญานนท์"
  lastName: string;          // "เชื้อคำ"
  position: string;
  department: string;
  variants: string[];        // Common typos / sub-strings
}

/**
 * Master Reference Roster of Verified Canonical Thai Personnel Names
 */
export const CANONICAL_PLANT_ROSTER: CanonicalRosterPerson[] = [
  {
    id: 'insp-1',
    fullNameWithTitle: 'นายสมศักดิ์ วิริยะกิจ',
    cleanFullName: 'สมศักดิ์ วิริยะกิจ',
    firstName: 'สมศักดิ์',
    lastName: 'วิริยะกิจ',
    position: 'วิศวกรระดับ 6 / ผู้ตรวจสอบความปลอดภัย',
    department: 'แผนก หมผ - ธ. กอง กคว - ธ. โรงไฟฟ้าจะนะ',
    variants: ['สมศักดิ์', 'สมศักดิ', 'สมศักดิ์ วิริยะกิจ', 'สมศักดิ วิริยะกิจ', 'วิริยะกิจ'],
  },
  {
    id: 'insp-2',
    fullNameWithTitle: 'นายนพพร เวชเตง',
    cleanFullName: 'นพพร เวชเตง',
    firstName: 'นพพร',
    lastName: 'เวชเตง',
    position: 'ช่างชำนาญการ / ผู้ตรวจสอบ',
    department: 'โรงไฟฟ้าจะนะ',
    variants: ['นพพร', 'นภพร', 'นพพร เวชเตง', 'เวชเตง'],
  },
  {
    id: 'insp-3',
    fullNameWithTitle: 'ส.อ.กรกฎ แลบัว',
    cleanFullName: 'กรกฎ แลบัว',
    firstName: 'กรกฎ',
    lastName: 'แลบัว',
    position: 'ช่างชำนาญการ / ผู้ตรวจสอบ',
    department: 'โรงไฟฟ้าจะนะ',
    variants: ['กรกฎ', 'กรกฏ', 'ส.อ.กรกฎ', 'กรกฎ แลบัว', 'กรกฏ แลบัว', 'แลบัว'],
  },
  {
    id: 'insp-4',
    fullNameWithTitle: 'นายภานุพงศ์ ยามะสกุล',
    cleanFullName: 'ภานุพงศ์ ยามะสกุล',
    firstName: 'ภานุพงศ์',
    lastName: 'ยามะสกุล',
    position: 'พนักงานตรวจสอบอุปกรณ์',
    department: 'โรงไฟฟ้าจะนะ',
    variants: [
      'ภานุพงศ์',
      'ภาณุพงศ์',
      'ภานุพงษ์',
      'ภานุพงศ',
      'ภานุพงศ์ ยามะสกั',
      'ภานุพงศ์ ยามะสกุล',
      'ภาณุพงศ์ ยามะสกุล',
      'ยามะสกั',
      'ยามะสกุล',
    ],
  },
  {
    id: 'insp-5',
    fullNameWithTitle: 'นายชญานนท์ เชื้อคำ',
    cleanFullName: 'ชญานนท์ เชื้อคำ',
    firstName: 'ชญานนท์',
    lastName: 'เชื้อคำ',
    position: 'พนักงานตรวจสอบอุปกรณ์',
    department: 'โรงไฟฟ้าจะนะ',
    variants: [
      'ชญานนท์',
      'ชญานน',
      'ชญานนท',
      'ชญานนท์ เชื้อคำ',
      'ชญานน เชื้อคำ',
      'นายชญานน',
      'เชื้อคำ',
    ],
  },
  {
    id: 'insp-6',
    fullNameWithTitle: 'นายนันทวัฒน์ พลเมฆ',
    cleanFullName: 'นันทวัฒน์ พลเมฆ',
    firstName: 'นันทวัฒน์',
    lastName: 'พลเมฆ',
    position: 'พนักงานตรวจสอบอุปกรณ์',
    department: 'โรงไฟฟ้าจะนะ',
    variants: ['นันทวัฒน์', 'นันทวัฒน', 'นันทวัฒน์ พลเมฆ', 'พลเมฆ'],
  },
  {
    id: 'insp-7',
    fullNameWithTitle: 'นายสุรินทร์ สารอนินทร์',
    cleanFullName: 'สุรินทร์ สารอนินทร์',
    firstName: 'สุรินทร์',
    lastName: 'สารอนินทร์',
    position: 'พนักงานตรวจสอบอุปกรณ์',
    department: 'โรงไฟฟ้าจะนะ',
    variants: [
      'สุรินทร์',
      'สุรินทร',
      'สุรินทร์ สารอนินทร์',
      'สุรินทร สารอนินทร์',
      'สุรินทร์ สารอนินทร',
      'สารอนินทร์',
      'สารอนินทร',
    ],
  },
  {
    id: 'insp-8',
    fullNameWithTitle: 'นายทรงศักดิ์ หุ้นศรี',
    cleanFullName: 'ทรงศักดิ์ หุ้นศรี',
    firstName: 'ทรงศักดิ์',
    lastName: 'หุ้นศรี',
    position: 'พนักงานตรวจสอบอุปกรณ์',
    department: 'โรงไฟฟ้าจะนะ',
    variants: ['ทรงศักดิ์', 'ทรงศักดิ', 'ทรงศักดิ์ หุ้นศรี', 'ทรงศักดิ หุ้นศรี', 'หุ้นศรี'],
  },
  {
    id: 'insp-9',
    fullNameWithTitle: 'นายอานนท์ ภวรัญพงษ์',
    cleanFullName: 'อานนท์ ภวรัญพงษ์',
    firstName: 'อานนท์',
    lastName: 'ภวรัญพงษ์',
    position: 'พนักงานตรวจสอบอุปกรณ์',
    department: 'โรงไฟฟ้าจะนะ',
    variants: [
      'อานนท์',
      'อานน',
      'อานนท',
      'อานนท์ ภวรัญพงษ์',
      'อานน ภวรัญพงษ์',
      'อานนท์ ภวรัญพงษ',
      'ภวรัญพงษ์',
      'ภวรัญพงษ',
    ],
  },
  {
    id: 'insp-10',
    fullNameWithTitle: 'นายกิตติคุณ ลิ่วศิริวงศ์เจริญ',
    cleanFullName: 'กิตติคุณ ลิ่วศิริวงศ์เจริญ',
    firstName: 'กิตติคุณ',
    lastName: 'ลิ่วศิริวงศ์เจริญ',
    position: 'พนักงานตรวจสอบอุปกรณ์',
    department: 'โรงไฟฟ้าจะนะ',
    variants: ['กิตติคุณ', 'กิตติคูณ', 'กิตติคุณ ลิ่วศิริวงศ์เจริญ', 'ลิ่วศิริวงศ์เจริญ'],
  },
];

/**
 * Strips title prefixes (นาย, นางสาว, ส.อ., etc.) and returns clean Thai name
 */
export function stripThaiTitlePrefix(fullName: string): string {
  if (!fullName) return '';
  let clean = fullName
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  while (THAI_NAME_PREFIX_REGEX.test(clean)) {
    clean = clean.replace(THAI_NAME_PREFIX_REGEX, '').trim();
  }
  return clean.replace(/\s+/g, ' ');
}

/**
 * Applies general Thai grammatical rules to correct misspelled words in names:
 * 1. Missing Thanthakhat/Garan (ไม้ทัณฑฆาต ์) on silent trailing consonants
 * 2. Incomplete vowels like hanging mai-han-akat without final consonant (เช่น "สกั" -> "สกุล")
 * 3. Common consonant confusions (เช่น "กรกฏ" -> "กรกฎ")
 */
export function fixThaiNameGrammar(name: string): string {
  if (!name || typeof name !== 'string') return '';

  let s = name
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ');

  // 1. Incomplete/truncated word endings:
  // "สกั" at the end of word -> "สกุล" (as in "ยามะสกั" -> "ยามะสกุล")
  s = s.replace(/สกั(\s|$)/g, 'สกุล$1');

  // 2. Missing karun on common Thai name endings:
  // "นน" / "นนท" at end of name token -> "นนท์" (ชญานนท์, อานนท์, ชานนท์)
  s = s.replace(/([ก-ฮ])นน(\s|$)/g, '$1นนท์$2');
  s = s.replace(/([ก-ฮ])นนท(\s|$)/g, '$1นนท์$2');

  // "ศักดิ" / "ศักด" at end of token -> "ศักดิ์" (สมศักดิ์, ทรงศักดิ์, เกียรติศักดิ์)
  s = s.replace(/ศักดิ(\s|$)/g, 'ศักดิ์$1');
  s = s.replace(/ศักด(\s|$)/g, 'ศักดิ์$1');

  // "รินทร" / "รินท" -> "รินทร์" (สุรินทร์, สารอนินทร์, นรินทร์)
  s = s.replace(/รินทร(\s|$)/g, 'รินทร์$1');
  s = s.replace(/รินท(\s|$)/g, 'รินทร์$1');

  // "วัฒน" at end of token -> "วัฒน์" (นันทวัฒน์, ชัยวัฒน์)
  s = s.replace(/วัฒน(\s|$)/g, 'วัฒน์$1');

  // "พงศ" / "พงษ" at end of token -> "พงศ์" / "พงษ์"
  s = s.replace(/ภานุพงศ(\s|$)/g, 'ภานุพงศ์$1');
  s = s.replace(/ภาณุพงศ(\s|$)/g, 'ภานุพงศ์$1');
  s = s.replace(/ภานุพงษ์(\s|$)/g, 'ภานุพงศ์$1');
  s = s.replace(/ภานุพงษ(\s|$)/g, 'ภานุพงศ์$1');
  s = s.replace(/ภวรัญพงษ(\s|$)/g, 'ภวรัญพงษ์$1');

  // "สิทธิ" / "สิทธ" -> "สิทธิ์"
  s = s.replace(/สิทธิ(\s|$)/g, 'สิทธิ์$1');
  s = s.replace(/สิทธ(\s|$)/g, 'สิทธิ์$1');

  // "กรกฏ" -> "กรกฎ" (ชฎา)
  s = s.replace(/กรกฏ(\s|$)/g, 'กรกฎ$1');

  // "นภพร" -> "นพพร"
  s = s.replace(/นภพร(\s|$)/g, 'นพพร$1');

  // "กิตติคูณ" -> "กิตติคุณ"
  s = s.replace(/กิตติคูณ(\s|$)/g, 'กิตติคุณ$1');

  // "สารอนิน" -> "สารอนินทร์"
  s = s.replace(/สารอนิน(\s|$)/g, 'สารอนินทร์$1');

  // "หุ่นศรี" -> "หุ้นศรี"
  s = s.replace(/หุ่นศรี(\s|$)/g, 'หุ้นศรี$1');

  // "เวชเต็ง" -> "เวชเตง"
  s = s.replace(/เวชเต็ง(\s|$)/g, 'เวชเตง$1');

  // "ลิ่วศิริวงค์เจริญ" / "ลิ่วศิริวงเจริญ" -> "ลิ่วศิริวงศ์เจริญ"
  s = s.replace(/ลิ่วศิริวง[ค์|ค]?เจริญ(\s|$)/g, 'ลิ่วศิริวงศ์เจริญ$1');

  // "พนเมฆ" -> "พลเมฆ"
  s = s.replace(/พนเมฆ(\s|$)/g, 'พลเมฆ$1');

  // "วิริยกิต" / "วิริยกิตติ์" -> "วิริยะกิจ"
  s = s.replace(/วิริยกิต[ติ์]?(\s|$)/g, 'วิริยะกิจ$1');

  // "เชื้อคำ่" -> "เชื้อคำ"
  s = s.replace(/เชื้อคำ[่้]?(\s|$)/g, 'เชื้อคำ$1');

  return s;
}

/**
 * Extracts consonants only from a Thai string (ignoring vowels, tone marks, punctuation)
 * Used for deep structural/phonetic comparison.
 */
export function extractThaiConsonants(str: string): string {
  return str.replace(/[^ก-ฮ]/g, '');
}

/**
 * Computes standard Levenshtein edit distance
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * Calculates similarity between two Thai name strings (range 0.0 to 1.0)
 * Uses composite metric:
 * - Direct Levenshtein distance
 * - Consonant skeleton distance
 * - Shared starting letters (first consonant must match!)
 */
export function calculateThaiNameSimilarity(a: string, b: string): number {
  const normA = stripThaiTitlePrefix(fixThaiNameGrammar(a));
  const normB = stripThaiTitlePrefix(fixThaiNameGrammar(b));

  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  // Extract first names
  const tokenA = normA.split(/\s+/)[0] || '';
  const tokenB = normB.split(/\s+/)[0] || '';

  // First consonant check: Thai first names must share the same initial consonant
  const consA = extractThaiConsonants(tokenA);
  const consB = extractThaiConsonants(tokenB);

  if (consA.length === 0 || consB.length === 0) return 0;
  if (consA.charAt(0) !== consB.charAt(0)) {
    // If starting consonant doesn't match (e.g. ช vs อ in "ชญานนท์" vs "อานนท์"), definitely different people!
    return 0;
  }

  // Exact first name match (e.g. "ชญานนท์" vs "ชญานนท์ เชื้อคำ")
  if (tokenA === tokenB) return 0.95;

  // Token prefix match (e.g. "ชญานน" vs "ชญานนท์")
  if (tokenA.startsWith(tokenB) || tokenB.startsWith(tokenA)) {
    const minLen = Math.min(tokenA.length, tokenB.length);
    if (minLen >= 4) return 0.92;
  }

  // Consonant skeleton match
  const consDist = levenshtein(consA, consB);
  const maxConsLen = Math.max(consA.length, consB.length);
  const consSim = 1 - consDist / maxConsLen;

  // String edit distance on first name token
  const strDist = levenshtein(tokenA, tokenB);
  const maxStrLen = Math.max(tokenA.length, tokenB.length);
  const strSim = 1 - strDist / maxStrLen;

  return consSim * 0.6 + strSim * 0.4;
}

/**
 * Resolves any raw Thai inspector string to its verified canonical full name
 * 1. Checks plant reference roster for exact/variant matches
 * 2. Checks custom registered inspectors list
 * 3. Applies grammatical auto-correction for any Thai name
 */
export function getCanonicalThaiName(
  rawName: string,
  customInspectors: Inspector[] = []
): string {
  if (!rawName || typeof rawName !== 'string') return '';

  const cleanInput = stripThaiTitlePrefix(fixThaiNameGrammar(rawName));
  if (!cleanInput) return '';

  // 1. Search against CANONICAL_PLANT_ROSTER
  for (const person of CANONICAL_PLANT_ROSTER) {
    // Check against canonical names
    if (
      cleanInput === person.cleanFullName ||
      cleanInput === person.firstName ||
      cleanInput === stripThaiTitlePrefix(person.fullNameWithTitle)
    ) {
      return person.fullNameWithTitle;
    }

    // Check against variants
    for (const v of person.variants) {
      const cleanV = stripThaiTitlePrefix(fixThaiNameGrammar(v));
      if (cleanInput === cleanV) {
        return person.fullNameWithTitle;
      }
    }

    // Fuzzy similarity match (threshold >= 0.88 with identical initial consonant)
    const sim = calculateThaiNameSimilarity(cleanInput, person.cleanFullName);
    if (sim >= 0.88) {
      return person.fullNameWithTitle;
    }
  }

  // 2. Search against customInspectors
  for (const insp of customInspectors) {
    const cleanInsp = stripThaiTitlePrefix(fixThaiNameGrammar(insp.name));
    if (cleanInput === cleanInsp) {
      return insp.name;
    }
    const sim = calculateThaiNameSimilarity(cleanInput, cleanInsp);
    if (sim >= 0.88) {
      return insp.name;
    }
  }

  // 3. Fallback: Return grammatically corrected version
  return fixThaiNameGrammar(rawName.trim());
}

/**
 * Deduplicates and merges an array of Inspector objects into a single clean list:
 * - Detects duplicate inspectors caused by typos (e.g. "ชญานน", "ชญานนท์", "นายชญานนท์ เชื้อคำ")
 * - Unifies them into ONE single canonical Inspector
 * - Preserves the best available signature data URLs
 * - Merges without duplicates
 */
export function mergeAndDeduplicateInspectors(inspectors: Inspector[]): Inspector[] {
  const mergedMap = new Map<string, Inspector>();

  for (const insp of inspectors) {
    if (!insp || !insp.name) continue;

    const canonicalName = getCanonicalThaiName(insp.name, inspectors);
    const key = stripThaiTitlePrefix(canonicalName).toLowerCase();

    const existing = mergedMap.get(key);
    const rawAlias = insp.name.trim();

    if (!existing) {
      const initialAliases = new Set<string>(insp.aliases || []);
      if (rawAlias && rawAlias !== canonicalName) {
        initialAliases.add(rawAlias);
      }
      mergedMap.set(key, {
        ...insp,
        name: canonicalName,
        aliases: Array.from(initialAliases),
      });
    } else {
      // Merge: prefer inspector with signatures or complete full name
      const hasBetterSig =
        (!existing.signatureDataUrl && Boolean(insp.signatureDataUrl)) ||
        (!existing.verticalSignatureDataUrl && Boolean(insp.verticalSignatureDataUrl));

      const isLongerOfficialName = insp.name.length > existing.name.length;
      const mergedAliases = new Set<string>([
        ...(existing.aliases || []),
        ...(insp.aliases || []),
      ]);
      if (rawAlias && rawAlias !== canonicalName) {
        mergedAliases.add(rawAlias);
      }
      if (existing.name && existing.name !== canonicalName) {
        mergedAliases.add(existing.name);
      }

      mergedMap.set(key, {
        ...existing,
        name: isLongerOfficialName ? canonicalName : existing.name,
        signatureDataUrl: existing.signatureDataUrl || insp.signatureDataUrl,
        verticalSignatureDataUrl: existing.verticalSignatureDataUrl || insp.verticalSignatureDataUrl,
        position: existing.position || insp.position,
        department: existing.department || insp.department,
        aliases: Array.from(mergedAliases),
      });
    }
  }

  return Array.from(mergedMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

export interface NameMergeAuditItem {
  raw: string;
  canonical: string;
  count: number;
  reason: string;
}

/**
 * Clusters all records, fixes grammatical typos in inspector names,
 * updates each record to reference the single unified canonical name,
 * and deduplicates the inspectors roster.
 */
export function clusterAndNormalizeRecords(
  records: any[],
  inspectors: Inspector[] = []
): {
  normalizedRecords: any[];
  deduplicatedInspectors: Inspector[];
  auditLogs: NameMergeAuditItem[];
} {
  const auditMap = new Map<string, NameMergeAuditItem>();

  const normalizedRecords = (records || []).map((rec) => {
    const rawName = (rec.inspectorName || '').trim();
    if (!rawName) return rec;

    const canonical = getCanonicalThaiName(rawName, inspectors);
    if (canonical && canonical !== rawName) {
      const auditKey = `${rawName}===>${canonical}`;
      if (!auditMap.has(auditKey)) {
        let reason = 'แก้ไขตัวสะกดตามหลักไวยากรณ์และรวมชื่อ';
        if (rawName.includes('สกั')) reason = 'เติมตัวสะกดสระ/พยัญชนะที่ขาดหาย (สกั ➔ สกุล)';
        else if (rawName.includes('กฏ')) reason = 'แก้พยัญชนะสับสน (กฏ ➔ กฎ)';
        else if (rawName.includes('นน') && !rawName.includes('นนท์')) reason = 'เติมไม้ทัณฑฆาต (นน ➔ นนท์)';
        else if (rawName.includes('ศักดิ') && !rawName.includes('ศักดิ์')) reason = 'เติมไม้ทัณฑฆาต (ศักดิ ➔ ศักดิ์)';
        else if (rawName.includes('รินทร') && !rawName.includes('รินทร์')) reason = 'เติมไม้ทัณฑฆาต (รินทร ➔ รินทร์)';
        else if (rawName.includes('นภพร')) reason = 'แก้ตัวสะกดคล้ายคลึง (นภพร ➔ นพพร)';
        else if (rawName.includes('คูณ')) reason = 'แก้สระเสียงสับสน (คูณ ➔ คุณ)';

        auditMap.set(auditKey, {
          raw: rawName,
          canonical,
          count: 0,
          reason,
        });
      }
      auditMap.get(auditKey)!.count++;
      return {
        ...rec,
        inspectorName: canonical,
      };
    }
    return rec;
  });

  const deduplicatedInspectors = mergeAndDeduplicateInspectors(inspectors);

  return {
    normalizedRecords,
    deduplicatedInspectors,
    auditLogs: Array.from(auditMap.values()),
  };
}

/**
 * Filter inspectors by user query with character-similarity and fuzzy matching
 */
export function fuzzyFilterInspectors(inspectors: Inspector[], query: string): Inspector[] {
  if (!query || !query.trim()) return inspectors;

  const q = query.trim().toLowerCase();
  const qClean = stripThaiTitlePrefix(fixThaiNameGrammar(q)).toLowerCase();

  return inspectors.filter((insp) => {
    const name = insp.name.toLowerCase();
    const cleanName = stripThaiTitlePrefix(fixThaiNameGrammar(name)).toLowerCase();

    // 1. Direct contains
    if (name.includes(q) || cleanName.includes(qClean)) return true;

    // 2. Check aliases
    if (insp.aliases && insp.aliases.some((a) => a.toLowerCase().includes(q))) {
      return true;
    }

    // 3. Department or Position
    if (
      (insp.position && insp.position.toLowerCase().includes(q)) ||
      (insp.department && insp.department.toLowerCase().includes(q))
    ) {
      return true;
    }

    // 4. Similarity matching
    const sim = calculateThaiNameSimilarity(q, insp.name);
    return sim >= 0.75;
  });
}

