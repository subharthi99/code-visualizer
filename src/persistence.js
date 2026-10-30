const DB_NAME = 'code-visualizer-v1';
let database;

export async function openDatabase() {
  database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Browser storage is unavailable. Enable site storage to save your work.'));
    request.onblocked = () => reject(new Error('Close other workspace tabs to finish opening storage.'));
  });
  database.onversionchange = () => database.close();
}

export function readRecords() {
  return new Promise((resolve, reject) => {
    const request = database.transaction('records').objectStore('records').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Resolve only on commit, never on a single successful request inside the transaction.
export function writeRecords(records, { clear = false, onlyNew = false, expectedUpdatedAt } = {}) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('records', 'readwrite');
    const store = transaction.objectStore('records');
    if (clear) store.clear();
    for (const record of records) {
      if (onlyNew || expectedUpdatedAt !== undefined) {
        const request = store.get(record.id);
        request.onsuccess = () => {
          if (onlyNew) { if (!request.result) store.put(record); }
          else if (request.result?.updatedAt !== expectedUpdatedAt) transaction.abort();
          else store.put(record);
        };
      } else store.put(record);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('This record changed in another tab. Export your work, then reload before editing further.'));
  });
}
