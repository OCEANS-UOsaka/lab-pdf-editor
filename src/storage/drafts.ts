// 下書きの自動保存（IndexedDB）。キーは元 PDF の SHA-256。リロードや誤って閉じてもコメントが残る。
import type { Comment } from '../model/types';

const DB_NAME = 'lab-pdf-editor';
const STORE = 'drafts';
const VERSION = 1;

export interface Draft {
  fileName: string;
  comments: Comment[];
  updatedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = op(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

export function loadDraft(key: string): Promise<Draft | undefined> {
  return run('readonly', (store) => store.get(key) as IDBRequest<Draft | undefined>);
}

export function saveDraft(key: string, draft: Draft): Promise<void> {
  return run('readwrite', (store) => store.put(draft, key)).then(() => undefined);
}

export function deleteDraft(key: string): Promise<void> {
  return run('readwrite', (store) => store.delete(key)).then(() => undefined);
}
