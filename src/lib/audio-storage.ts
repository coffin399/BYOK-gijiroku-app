// IndexedDBで音声データを保存・取得するユーティリティ

const DB_NAME = 'gijiroku-audio-db';
const DB_VERSION = 1;
const STORE_NAME = 'audio-files';

interface AudioRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  duration: number;
  createdAt: Date;
}

// データベースを開く
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// 音声を保存
export async function saveAudio(id: string, blob: Blob, duration: number): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record: AudioRecord = {
      id,
      blob,
      mimeType: blob.type,
      duration,
      createdAt: new Date(),
    };

    const request = store.put(record);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// 音声を取得
export async function getAudio(id: string): Promise<AudioRecord | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

// 音声を削除
export async function deleteAudio(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// 全ての音声を削除
export async function clearAllAudio(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// 音声をMP3としてダウンロード（元の形式でダウンロード、NotebookLM用）
export async function downloadAudioAsFile(id: string, filename: string): Promise<void> {
  const record = await getAudio(id);
  if (!record) {
    throw new Error('音声データが見つかりません');
  }

  // ファイル拡張子を決定
  let ext = 'webm';
  if (record.mimeType.includes('mp3')) ext = 'mp3';
  else if (record.mimeType.includes('wav')) ext = 'wav';
  else if (record.mimeType.includes('ogg')) ext = 'ogg';

  const url = URL.createObjectURL(record.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// BlobからオブジェクトURLを作成（再生用）
export function createAudioURL(blob: Blob): string {
  return URL.createObjectURL(blob);
}

// オブジェクトURLを解放
export function revokeAudioURL(url: string): void {
  URL.revokeObjectURL(url);
}

