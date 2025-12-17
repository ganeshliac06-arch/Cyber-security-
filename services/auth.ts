import { deriveKey, generateSalt, hashPassword } from './crypto';
import * as DB from './db';
import { VaultMetadata } from '../types';

const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 30000; // 30 seconds for demo (normally would be 5-15 mins)

export const registerUser = async (password: string): Promise<CryptoKey> => {
  const salt = generateSalt();
  // We create a hash for quick auth verification (so we don't have to attempt decryption to verify password)
  const authHash = await hashPassword(password, salt);
  
  const metadata: VaultMetadata = {
    salt,
    authHash
  };
  
  DB.initVault(metadata);
  
  // Return the actual key used for encrypting vault data
  return deriveKey(password, salt);
};

export const loginUser = async (password: string): Promise<{ success: boolean; key?: CryptoKey; error?: string }> => {
  const securityState = DB.getSecurityState();
  const now = Date.now();

  // Check Lockout
  if (securityState.lockoutUntil > now) {
    const remaining = Math.ceil((securityState.lockoutUntil - now) / 1000);
    return { success: false, error: `Account locked. Try again in ${remaining} seconds.` };
  }

  const metadata = DB.getMetadata();
  if (!metadata) {
    return { success: false, error: 'Vault corrupted or missing.' };
  }

  // Verify Password
  const attemptHash = await hashPassword(password, metadata.salt);
  
  if (attemptHash === metadata.authHash) {
    // SUCCESS
    // Reset failed attempts but keep logs
    DB.updateSecurityState({
      ...securityState,
      count: 0,
      lockoutUntil: 0,
      logs: [...securityState.logs, { timestamp: now, success: true }]
    });
    
    const key = await deriveKey(password, metadata.salt);
    return { success: true, key };
  } else {
    // FAILURE
    const newCount = securityState.count + 1;
    let newLockout = 0;
    let errorMsg = 'Invalid password.';

    if (newCount >= MAX_ATTEMPTS) {
      newLockout = now + LOCKOUT_DURATION_MS;
      errorMsg = `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MS / 1000} seconds.`;
    }

    DB.updateSecurityState({
      ...securityState,
      count: newCount,
      lockoutUntil: newLockout,
      logs: [...securityState.logs, { timestamp: now, success: false }]
    });

    return { success: false, error: errorMsg };
  }
};

export const getLockoutStatus = (): { isLocked: boolean; remaining: number } => {
  const { lockoutUntil } = DB.getSecurityState();
  const now = Date.now();
  if (lockoutUntil > now) {
    return { isLocked: true, remaining: Math.ceil((lockoutUntil - now) / 1000) };
  }
  return { isLocked: false, remaining: 0 };
};
