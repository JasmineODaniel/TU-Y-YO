import { openDB } from 'idb';

const DB_NAME = 'tuyyo_keys';
const STORE_NAME = 'keys';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });
}

export async function storePrivateKey(key) {
  const db = await getDB();
  await db.put(STORE_NAME, key, 'private_key');
}

export async function getPrivateKey() {
  const db = await getDB();
  return await db.get(STORE_NAME, 'private_key');
}

export async function storePublicKey(key) {
  const db = await getDB();
  await db.put(STORE_NAME, key, 'public_key');
}

export async function getPublicKey() {
  const db = await getDB();
  return await db.get(STORE_NAME, 'public_key');
}

export async function clearKeys() {
  const db = await getDB();
  await db.clear(STORE_NAME);
}
