/**
 * WhisperBox Crypto Module
 * 
 * Handles all client-side cryptographic operations using the Web Crypto API.
 * 
 * Encryption scheme:
 * - RSA-OAEP 4096-bit for asymmetric key exchange
 * - AES-GCM 256-bit for symmetric message encryption
 * - PBKDF2 + AES-KW for private key wrapping (password-based)
 * 
 * The server NEVER sees plaintext — all encryption/decryption happens here.
 */

// ─── Utility: ArrayBuffer ↔ Base64 ──────────────────────────────────

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ─── Key Generation ─────────────────────────────────────────────────

/**
 * Generate an RSA-OAEP keypair for asymmetric encryption.
 * The public key encrypts per-message AES keys.
 * The private key decrypts them.
 * 
 * @returns {Promise<CryptoKeyPair>} { publicKey, privateKey }
 */
export async function generateKeyPair() {
  return await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256',
    },
    true, // extractable — needed so we can wrap/export
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/**
 * Generate a random 128-bit salt for PBKDF2.
 * @returns {string} Base64-encoded salt
 */
export function generatePBKDF2Salt() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return arrayBufferToBase64(salt.buffer);
}

// ─── Key Wrapping (Password → AES-KW → Wrap Private Key) ───────────

/**
 * Derive an AES-KW wrapping key from the user's password + salt.
 * This key is used to wrap/unwrap the RSA private key.
 * 
 * @param {string} password - User's plaintext password
 * @param {string} saltBase64 - Base64-encoded PBKDF2 salt
 * @returns {Promise<CryptoKey>} AES-KW wrapping key
 */
export async function deriveWrappingKey(password, saltBase64) {
  const encoder = new TextEncoder();
  const salt = base64ToArrayBuffer(saltBase64);

  // Import password as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key using PBKDF2 (AES-KW has 8-byte length constraints)
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Wrap (encrypt) the RSA private key with the AES-KW wrapping key.
 * The wrapped blob is safe to store on the server.
 * 
 * @param {CryptoKey} privateKey - RSA-OAEP private key
 * @param {CryptoKey} wrappingKey - AES-KW key derived from password
 * @returns {Promise<string>} Base64-encoded wrapped private key
 */
export async function wrapPrivateKey(privateKey, wrappingKey) {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    wrappingKey,
    exported
  );
  
  // Combine IV and Encrypted data
  const combined = new Uint8Array(12 + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), 12);
  
  return arrayBufferToBase64(combined.buffer);
}

/**
 * Unwrap (decrypt) the RSA private key from the server-stored blob.
 * Called on login to restore the private key into memory.
 * 
 * @param {string} wrappedKeyBase64 - Base64-encoded wrapped private key
 * @param {CryptoKey} wrappingKey - AES-KW key derived from password
 * @returns {Promise<CryptoKey>} RSA-OAEP private key (non-extractable)
 */
export async function unwrapPrivateKey(wrappedKeyBase64, wrappingKey) {
  const combined = new Uint8Array(base64ToArrayBuffer(wrappedKeyBase64));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    wrappingKey,
    encrypted
  );
  
  return await crypto.subtle.importKey(
    'pkcs8',
    decrypted,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['decrypt']
  );
}

// ─── Public Key Export/Import ───────────────────────────────────────

/**
 * Export an RSA-OAEP public key to base64 (SPKI format).
 * This is sent to the server for other users to encrypt messages to us.
 * 
 * @param {CryptoKey} publicKey 
 * @returns {Promise<string>} Base64-encoded public key
 */
export async function exportPublicKey(publicKey) {
  const exported = await crypto.subtle.exportKey('spki', publicKey);
  return arrayBufferToBase64(exported);
}

/**
 * Import a base64-encoded RSA-OAEP public key (from the server).
 * Used to encrypt per-message AES keys for the recipient.
 * 
 * @param {string} base64Key 
 * @returns {Promise<CryptoKey>}
 */
export async function importPublicKey(base64Key) {
  const keyData = base64ToArrayBuffer(base64Key);
  return await crypto.subtle.importKey(
    'spki',
    keyData,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
}

// ─── Message Encryption ─────────────────────────────────────────────

/**
 * Encrypt a plaintext message for a recipient.
 * 
 * 1. Generate random AES-GCM 256-bit key
 * 2. Generate random 96-bit IV
 * 3. Encrypt plaintext with AES-GCM
 * 4. Encrypt AES key with recipient's RSA public key
 * 5. Encrypt AES key with sender's RSA public key (so sender can read their own messages)
 * 
 * @param {string} plaintext - The message text
 * @param {CryptoKey} recipientPublicKey - Recipient's RSA-OAEP public key
 * @param {CryptoKey} senderPublicKey - Sender's own RSA-OAEP public key
 * @returns {Promise<{ciphertext: string, iv: string, encryptedKey: string, encryptedKeyForSelf: string}>}
 */
export async function encryptMessage(plaintext, recipientPublicKey, senderPublicKey) {
  const encoder = new TextEncoder();

  // 1. Generate random AES-GCM key
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable — we need to wrap it with RSA
    ['encrypt', 'decrypt']
  );

  // 2. Generate random 96-bit IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt plaintext with AES-GCM
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    aesKey,
    encoder.encode(plaintext)
  );

  // 4. Export AES key as raw bytes for RSA encryption
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);

  // 5. Encrypt AES key with recipient's public key
  const encryptedKeyBuffer = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    recipientPublicKey,
    rawAesKey
  );

  // 6. Encrypt AES key with sender's own public key
  const encryptedKeyForSelfBuffer = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    senderPublicKey,
    rawAesKey
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer),
    encryptedKey: arrayBufferToBase64(encryptedKeyBuffer),
    encryptedKeyForSelf: arrayBufferToBase64(encryptedKeyForSelfBuffer),
  };
}

/**
 * Decrypt an encrypted message payload.
 * 
 * 1. Decrypt the per-message AES key using our RSA private key
 * 2. Import the raw AES key
 * 3. Decrypt the ciphertext with AES-GCM
 * 
 * @param {Object} payload - { ciphertext, iv, encryptedKey, encryptedKeyForSelf }
 * @param {CryptoKey} privateKey - Our RSA-OAEP private key
 * @param {boolean} isSender - If true, use encryptedKeyForSelf instead of encryptedKey
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptMessage(payload, privateKey, isSender) {
  const decoder = new TextDecoder();

  // 1. Choose the right encrypted key based on whether we're sender or recipient
  const encryptedKeyB64 = isSender ? payload.encryptedKeyForSelf : payload.encryptedKey;
  const encryptedKeyBuffer = base64ToArrayBuffer(encryptedKeyB64);

  // 2. Decrypt the AES key with our RSA private key
  const rawAesKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    encryptedKeyBuffer
  );

  // 3. Import the raw AES key
  const aesKey = await crypto.subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // 4. Decrypt the ciphertext
  const iv = base64ToArrayBuffer(payload.iv);
  const ciphertext = base64ToArrayBuffer(payload.ciphertext);
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    aesKey,
    ciphertext
  );

  return decoder.decode(plaintextBuffer);
}
