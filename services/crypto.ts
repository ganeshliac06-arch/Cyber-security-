// This service handles all low-level cryptographic operations.
// It uses the browser's native Web Crypto API for performance and security.

// Helper to convert ArrayBuffer to Base64 string
export const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Helper to convert Base64 string to ArrayBuffer
export const base64ToBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Generate a random salt
export const generateSalt = (): string => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return bufferToBase64(salt.buffer);
};

// Import the password as a CryptoKey for derivation
const importPassword = async (password: string): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  return window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
};

// Derive a symmetric encryption key from the password using PBKDF2
// This aligns with secure coding practices: never use the raw password as a key.
export const deriveKey = async (password: string, saltBase64: string): Promise<CryptoKey> => {
  const salt = base64ToBuffer(saltBase64);
  const keyMaterial = await importPassword(password);
  
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000, // High iteration count protects against brute-force
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // Key is not extractable
    ['encrypt', 'decrypt']
  );
};

// Create a hash of the password for authentication verification
// We use a separate derivation or simple hash to verify the password without needing to decrypt data first.
export const hashPassword = async (password: string, saltBase64: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + saltBase64); // Simple pepper strategy
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return bufferToBase64(hashBuffer);
};

// Encrypt data using AES-GCM
// AES-GCM provides both confidentiality and integrity (authenticated encryption).
export const encryptData = async (text: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv.buffer),
  };
};

// Decrypt data using AES-GCM
export const decryptData = async (ciphertextBase64: string, ivBase64: string, key: CryptoKey): Promise<string> => {
  const ciphertext = base64ToBuffer(ciphertextBase64);
  const iv = base64ToBuffer(ivBase64);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (e) {
    throw new Error('Decryption failed. Data may be corrupted or key is incorrect.');
  }
};
