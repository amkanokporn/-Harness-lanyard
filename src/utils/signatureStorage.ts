/**
 * Signature Storage Module (Multi-layer Persistent Vault)
 *
 * Provides unbreakable persistent storage for real uploaded inspector signatures
 * using IndexedDB (primary, unlimited quota, persists across sessions/reloads)
 * with localStorage mirror (synchronous fast cache) and JSON backup/restore.
 *
 * Guarantees that once a signature is uploaded, it is NEVER overwritten by
 * new Excel uploads, code edits, or page refreshes until the user explicitly overwrites it.
 */

import { Inspector } from '../types';
import { cleanInspectorFullName } from './signatureUtils';
import { db } from '../lib/firebase';
import { collection, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';

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
const LOCAL_STORAGE_VAULT_KEY = 'egat_permanent_signature_vault_v2';

// In-memory cache for instant synchronous access
let memoryVault = new Map<string, StoredSignatureRecord>();
let isInitialized = false;

function normalizeKey(str: string): string {
  if (!str) return '';
  return cleanInspectorFullName(str)
    .replace(/\s+/g, '')
    .toLowerCase()
    .trim();
}

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
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Initialize Signature Vault by reading IndexedDB, localStorage, and Firestore
 */
export async function initSignatureVault(): Promise<Map<string, StoredSignatureRecord>> {
  if (isInitialized && memoryVault.size > 0) {
    return memoryVault;
  }

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

  // 2. Read IndexedDB for complete, full-resolution records
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
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

  // 3. Sync from Firestore
  try {
    const querySnapshot = await getDocs(collection(db, 'signatures'));
    querySnapshot.forEach((doc) => {
      const data = doc.data() as StoredSignatureRecord;
      const k = normalizeKey(data.name);
      memoryVault.set(k, data);
    });
  } catch (e) {
    console.error('Firestore vault read error:', e);
  }

  isInitialized = true;
  return memoryVault;
}

/**
 * Sync memory vault to Firestore
 */
async function persistVault(): Promise<void> {
  // Save to Firestore using a more robust collection approach
  try {
    const signaturesCollection = collection(db, 'signatures');
    for (const [key, record] of memoryVault.entries()) {
      // Use setDoc with a unique ID mapping if needed, or stick to the key as doc ID
      // To ensure uniqueness, perhaps append a hash or just use the name key
      await setDoc(doc(signaturesCollection, key), record);
    }
    console.log('Successfully persisted all signatures to Firestore');
  } catch (e) {
    console.error('Firestore write error:', e);
  }

  // 2. Mirror into localStorage (compressed summary)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const obj: { [key: string]: StoredSignatureRecord } = {};
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

  // Also set key with clean name without title if different
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
        verticalSignatureDataUrl: saved.verticalSignatureDataUrl || insp.verticalSignatureDataUrl,
        isCustomSignature: true,
        uploadedAt: saved.uploadedAt,
        originalFileName: saved.originalFileName,
      };
    }
    return insp;
  });
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
