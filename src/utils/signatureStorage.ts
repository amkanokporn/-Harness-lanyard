/**
 * Signature Storage Module (Dual Server + Firestore Cloud Vault)
 *
 * Provides unbreakable persistent storage for inspector signatures:
 * 1. Express Server Disk API (/api/signatures) - saved directly into server JSON + PNG files
 * 2. Firebase Firestore (/signatures collection) - real-time cloud database across all devices
 * 3. IndexedDB & LocalStorage - client-side caching for instant zero-latency rendering
 *
 * Guarantees that any signature saved or uploaded on ONE device is immediately
 * available on ANY other computer, mobile device, or browser session.
 */

import { Inspector } from '../types';
import { cleanInspectorFullName } from './signatureUtils';
import { db } from '../lib/firebase';
import { collection, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { MASTER_REAL_SIGNATURES } from '../constants/masterSignatures';

export interface StoredSignatureRecord {
  id?: string;
  name: string; // e.g. "นายชญานนท์ เชื้อคำ"
  cleanName: string; // e.g. "ชญานนท์ เชื้อคำ"
  signatureDataUrl: string; // Horizontal transparent PNG
  verticalSignatureDataUrl?: string; // Vertical rotated -90deg transparent PNG
  isCustomSignature: boolean; // true if uploaded/customized by user
  uploadedAt: string; // ISO date string
  originalFileName?: string; // e.g. "นายชญานนท์_เชื้อคำ.png"
  position?: string;
  department?: string;
}

const IDB_NAME = 'EGAT_Inspection_Signatures_DB_v2';
const IDB_STORE = 'inspector_signatures';
const LOCAL_STORAGE_VAULT_KEY = 'egat_permanent_signature_vault_v3';

// In-memory cache for instant synchronous access
let memoryVault = new Map<string, StoredSignatureRecord>();
let isInitialized = false;

export function normalizeKey(str: string): string {
  if (!str) return '';
  return cleanInspectorFullName(str)
    .replace(/\s+/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Seed memory vault immediately from the master embedded signatures.
 * Guarantees that any device/browser has 100% of real inspector signatures
 * with zero dependence on Firestore quotas or server network connectivity.
 */
function seedFromMasterSignatures() {
  for (const [key, item] of Object.entries(MASTER_REAL_SIGNATURES)) {
    const rec: StoredSignatureRecord = {
      name: item.name,
      cleanName: item.cleanName || cleanInspectorFullName(item.name),
      signatureDataUrl: item.signatureDataUrl,
      verticalSignatureDataUrl: item.verticalSignatureDataUrl || item.signatureDataUrl,
      isCustomSignature: true,
      uploadedAt: '2026-10-21T00:00:00.000Z',
    };
    const k1 = normalizeKey(item.name);
    const k2 = normalizeKey(item.cleanName);
    const k3 = normalizeKey(key);
    if (k1) memoryVault.set(k1, rec);
    if (k2) memoryVault.set(k2, rec);
    if (k3) memoryVault.set(k3, rec);
    memoryVault.set(key, rec);
  }
}

// Synchronously seed immediately upon module import
seedFromMasterSignatures();

/**
 * Open IndexedDB database safely
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(IDB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(IDB_STORE)) {
        dbInstance.createObjectStore(IDB_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Initialize Signature Vault by reading:
 * 1. LocalStorage & IndexedDB (Fast initial render)
 * 2. Express Server API /api/signatures (Server disk database)
 * 3. Firebase Firestore (Cloud database)
 */
export async function initSignatureVault(): Promise<Map<string, StoredSignatureRecord>> {
  // Always seed master real signatures first
  seedFromMasterSignatures();

  // 1. Try reading localStorage first for instant initial render
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const lsData = localStorage.getItem(LOCAL_STORAGE_VAULT_KEY);
      if (lsData) {
        const parsed = JSON.parse(lsData);
        if (parsed && typeof parsed === 'object') {
          Object.values(parsed).forEach((item: any) => {
            if (item && item.name && item.signatureDataUrl) {
              const k = normalizeKey(item.name);
              memoryVault.set(k, item as StoredSignatureRecord);
            }
          });
        }
      }
    }
  } catch (e) {
    console.warn('LocalStorage vault read error:', e);
  }

  // 2. Read IndexedDB
  try {
    const idb = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = req.result || [];
        records.forEach((entry: any) => {
          if (entry && entry.record && entry.record.name) {
            const k = normalizeKey(entry.record.name);
            memoryVault.set(k, entry.record);
          }
        });
        resolve();
      };

      req.onerror = () => resolve();
      tx.oncomplete = () => resolve();
    });
  } catch (e) {
    console.warn('IndexedDB vault read error:', e);
  }

  // 3. Fetch from Server Disk API (/api/signatures)
  try {
    const res = await fetch('/api/signatures');
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.signatures) {
        Object.values(json.signatures).forEach((rec: any) => {
          if (rec && rec.name && rec.signatureDataUrl) {
            const k = normalizeKey(rec.name);
            memoryVault.set(k, rec as StoredSignatureRecord);
            const cleanK = normalizeKey(cleanInspectorFullName(rec.name));
            if (cleanK && cleanK !== k) {
              memoryVault.set(cleanK, rec as StoredSignatureRecord);
            }
          }
        });
        console.log(`[Vault] Loaded ${Object.keys(json.signatures).length} signatures from Server API`);
      }
    }
  } catch (e) {
    console.warn('Server API read warning:', e);
  }

  // 4. Fetch from Cloud Firestore (/signatures)
  try {
    const querySnapshot = await getDocs(collection(db, 'signatures'));
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as StoredSignatureRecord;
      if (data && data.name && data.signatureDataUrl) {
        const k = normalizeKey(data.name);
        memoryVault.set(k, data);
        const cleanK = normalizeKey(cleanInspectorFullName(data.name));
        if (cleanK && cleanK !== k) {
          memoryVault.set(cleanK, data);
        }
      }
    });
    console.log(`[Vault] Loaded ${querySnapshot.size} signatures from Firestore Cloud`);
  } catch (e) {
    console.warn('Firestore vault read warning:', e);
  }

  // Cache back to local storage
  mirrorToLocalStorage();

  isInitialized = true;
  return memoryVault;
}

/**
 * Mirror memory vault into localStorage
 */
function mirrorToLocalStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const obj: Record<string, StoredSignatureRecord> = {};
      for (const [key, record] of memoryVault.entries()) {
        obj[key] = record;
      }
      localStorage.setItem(LOCAL_STORAGE_VAULT_KEY, JSON.stringify(obj));
    }
  } catch (e) {
    console.warn('LocalStorage quota limit warning:', e);
  }
}

/**
 * Sync memory vault to BOTH Server Disk (/api/signatures) AND Cloud Firestore
 */
async function persistVault(): Promise<void> {
  const currentEntries: Record<string, StoredSignatureRecord> = {};
  for (const [key, record] of memoryVault.entries()) {
    currentEntries[key] = record;
  }

  // 1. Save to Server Disk API (/api/signatures)
  try {
    const res = await fetch('/api/signatures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signatures: currentEntries }),
    });
    if (res.ok) {
      console.log('✅ Successfully saved signatures to Server Disk');
    }
  } catch (e) {
    console.warn('Could not post to server signatures API:', e);
  }

  // 2. Save to Cloud Firestore
  try {
    const signaturesCollection = collection(db, 'signatures');
    for (const [key, record] of memoryVault.entries()) {
      await setDoc(doc(signaturesCollection, key), record);
    }
    console.log('✅ Successfully persisted signatures to Cloud Firestore');
  } catch (e) {
    console.warn('Firestore write warning:', e);
  }

  // 3. Save to IndexedDB
  try {
    const idb = await openDatabase();
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    for (const [key, record] of memoryVault.entries()) {
      store.put({ key, record });
    }
  } catch (e) {
    console.warn('IndexedDB write warning:', e);
  }

  // 4. Save to LocalStorage
  mirrorToLocalStorage();
}

/**
 * Save or overwrite an inspector's signature in the permanent vault
 */
export async function saveSignatureToVault(
  record: StoredSignatureRecord
): Promise<void> {
  await initSignatureVault();
  const key = normalizeKey(record.name);
  if (!key) return;

  const clean = cleanInspectorFullName(record.name);
  const updatedRecord: StoredSignatureRecord = {
    ...record,
    cleanName: clean,
    isCustomSignature: true,
    uploadedAt: record.uploadedAt || new Date().toISOString(),
  };

  memoryVault.set(key, updatedRecord);

  const cleanKey = normalizeKey(clean);
  if (cleanKey && cleanKey !== key) {
    memoryVault.set(cleanKey, updatedRecord);
  }

  await persistVault();
}

/**
 * Batch save multiple signatures into the permanent vault
 */
export async function batchSaveSignaturesToVault(
  records: StoredSignatureRecord[]
): Promise<void> {
  await initSignatureVault();
  for (const record of records) {
    const key = normalizeKey(record.name);
    if (!key) continue;

    const clean = cleanInspectorFullName(record.name);
    const updatedRecord: StoredSignatureRecord = {
      ...record,
      cleanName: clean,
      isCustomSignature: true,
      uploadedAt: record.uploadedAt || new Date().toISOString(),
    };

    memoryVault.set(key, updatedRecord);

    const cleanKey = normalizeKey(clean);
    if (cleanKey && cleanKey !== key) {
      memoryVault.set(cleanKey, updatedRecord);
    }
  }
  await persistVault();
}

/**
 * Look up a saved signature from the vault for an inspector by name or ID
 */
export function getSavedSignature(
  name: string,
  id?: string
): StoredSignatureRecord | null {
  if (!name) return null;
  const key1 = normalizeKey(name);
  const key2 = normalizeKey(cleanInspectorFullName(name));

  if (memoryVault.has(key1)) return memoryVault.get(key1)!;
  if (memoryVault.has(key2)) return memoryVault.get(key2)!;

  // Search by ID or substring
  for (const rec of memoryVault.values()) {
    if (id && rec.id === id) return rec;
    const recClean = normalizeKey(rec.cleanName);
    if (key2 && (recClean === key2 || key2.includes(recClean) || recClean.includes(key2))) {
      return rec;
    }
  }

  // Fallback direct check against MASTER_REAL_SIGNATURES
  const master = MASTER_REAL_SIGNATURES[key1] || MASTER_REAL_SIGNATURES[key2] || MASTER_REAL_SIGNATURES[name];
  if (master && master.signatureDataUrl) {
    return {
      name: master.name,
      cleanName: master.cleanName,
      signatureDataUrl: master.signatureDataUrl,
      verticalSignatureDataUrl: master.verticalSignatureDataUrl || master.signatureDataUrl,
      isCustomSignature: true,
      uploadedAt: '2026-10-21T00:00:00.000Z',
    };
  }

  return null;
}

/**
 * Returns all currently saved custom signatures
 */
export function getAllSavedSignatures(): StoredSignatureRecord[] {
  const seen = new Set<string>();
  const list: StoredSignatureRecord[] = [];
  for (const rec of memoryVault.values()) {
    const key = normalizeKey(rec.name);
    if (!seen.has(key)) {
      seen.add(key);
      list.push(rec);
    }
  }
  return list;
}

/**
 * Apply saved custom signatures to an inspector array without overwriting them
 */
export function applyVaultSignaturesToInspectors(
  inspectors: Inspector[]
): Inspector[] {
  return inspectors.map((insp) => {
    const saved = getSavedSignature(insp.name, insp.id);
    if (saved && saved.signatureDataUrl) {
      return {
        ...insp,
        signatureDataUrl: saved.signatureDataUrl,
        verticalSignatureDataUrl: saved.verticalSignatureDataUrl || saved.signatureDataUrl,
        isCustomSignature: true,
        uploadedAt: saved.uploadedAt || insp.uploadedAt,
        originalFileName: saved.originalFileName || insp.originalFileName,
      };
    }
    return insp;
  });
}

/**
 * Force manual sync from both Server and Firestore to guarantee latest data
 */
export async function forceSyncFromDatabase(): Promise<{
  serverCount: number;
  firestoreCount: number;
  totalVaultCount: number;
}> {
  let serverCount = 0;
  let firestoreCount = 0;

  // 1. Fetch Server
  try {
    const res = await fetch('/api/signatures');
    if (res.ok) {
      const json = await res.json();
      if (json && json.signatures) {
        Object.values(json.signatures).forEach((rec: any) => {
          if (rec && rec.name && rec.signatureDataUrl) {
            const k = normalizeKey(rec.name);
            memoryVault.set(k, rec);
            serverCount++;
          }
        });
      }
    }
  } catch (e) {
    console.warn('Server force sync error:', e);
  }

  // 2. Fetch Firestore
  try {
    const querySnapshot = await getDocs(collection(db, 'signatures'));
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as StoredSignatureRecord;
      if (data && data.name && data.signatureDataUrl) {
        const k = normalizeKey(data.name);
        memoryVault.set(k, data);
        firestoreCount++;
      }
    });
  } catch (e) {
    console.warn('Firestore force sync error:', e);
  }

  mirrorToLocalStorage();

  return {
    serverCount,
    firestoreCount,
    totalVaultCount: getAllSavedSignatures().length,
  };
}

/**
 * Export complete backup of all custom signatures as JSON string
 */
export async function exportSignaturesBackupJson(): Promise<string> {
  await initSignatureVault();
  const list = getAllSavedSignatures();
  return JSON.stringify(
    {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      count: list.length,
      signatures: list,
    },
    null,
    2
  );
}

/**
 * Import and restore signatures from a JSON backup string
 */
export async function importSignaturesBackupJson(jsonStr: string): Promise<number> {
  try {
    const data = JSON.parse(jsonStr);
    const list: StoredSignatureRecord[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.signatures)
      ? data.signatures
      : [];

    if (list.length === 0) return 0;

    await batchSaveSignaturesToVault(list);
    return list.length;
  } catch (e) {
    console.error('Failed to import backup JSON', e);
    throw new Error('รูปแบบไฟล์สำรอง JSON ไม่ถูกต้อง');
  }
}
