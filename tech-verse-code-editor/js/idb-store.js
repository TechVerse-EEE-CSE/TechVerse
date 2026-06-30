// ══════════════════════════════════════
//  IDB STORE — js/idb-store.js
//  হালকা IndexedDB key-value wrapper (কোনো বাহিরের লাইব্রেরি লাগে না)
//  localStorage এর বদলে এটা ব্যবহার করা হয় বড় ডেটা/quota সমস্যা এড়াতে
// ══════════════════════════════════════

const IDB_NAME    = 'tv_promax_db';
const IDB_VERSION = 1;
const IDB_STORE   = 'kv';

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
  return _dbPromise;
}

const IDBStore = {
  // ── একটা key এর value নিয়ে আসা ──
  async get(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  },

  // ── key/value সেভ করা ──
  async set(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => reject(tx.error);
    });
  },

  // ── key মুছে ফেলা ──
  async remove(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => reject(tx.error);
    });
  },

  // ── পুরো স্টোর খালি করা (Clear All Data) ──
  async clear() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => reject(tx.error);
    });
  },

  // ── পুরনো localStorage ডেটা থাকলে একবারই IndexedDB তে নিয়ে আসা ──
  // (নতুন ইউজারদের জন্য কিছুই করবে না, পুরনো ইউজারদের ডেটা হারাবে না)
  async migrateFromLocalStorage(keyMap) {
    for (const lsKey in keyMap) {
      const idbKey = keyMap[lsKey];
      try {
        const raw = localStorage.getItem(lsKey);
        if (raw === null) continue;
        const existing = await IDBStore.get(idbKey);
        if (existing === undefined) {
          let parsed;
          try { parsed = JSON.parse(raw); } catch { parsed = raw; }
          await IDBStore.set(idbKey, parsed);
        }
        localStorage.removeItem(lsKey);
      } catch (err) {
        console.warn('IndexedDB migration skipped for', lsKey, err);
      }
    }
  }
};

window.IDBStore = IDBStore;
