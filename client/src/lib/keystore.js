/**
 * WhisperBox Key Store
 * 
 * Secure client-side storage for CryptoKey objects using IndexedDB.
 * 
 * Why IndexedDB instead of localStorage?
 * - IndexedDB can store CryptoKey objects natively (structured clone)
 * - No serialization to plaintext strings needed
 * - CryptoKey objects marked as non-extractable stay non-extractable
 * - Same-origin policy protects the database
 */

const DB_NAME = 'whisperbox-keystore';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

/**
 * Open (or create) the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store the unwrapped RSA private key in IndexedDB.
 * The key is stored as a native CryptoKey object — never serialized to text.
 * 
 * @param {CryptoKey} privateKey - The unwrapped RSA-OAEP private key
 */
export async function storePrivateKey(privateKey) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(privateKey, 'privateKey');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Retrieve the RSA private key from IndexedDB.
 * 
 * @returns {Promise<CryptoKey|null>} The private key, or null if not found
 */
export async function getPrivateKey() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('privateKey');
    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Store the user's public key in IndexedDB for easy access.
 * 
 * @param {CryptoKey} publicKey - The RSA-OAEP public key
 */
export async function storePublicKey(publicKey) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(publicKey, 'publicKey');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Retrieve the user's public key from IndexedDB.
 * 
 * @returns {Promise<CryptoKey|null>}
 */
export async function getPublicKey() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('publicKey');
    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Clear all keys from IndexedDB. Called on logout.
 */
export async function clearKeys() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
