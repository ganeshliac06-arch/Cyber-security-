import { PasswordEntry, VaultMetadata } from '../types';

// Keys for localStorage
const DB_KEYS = {
  METADATA: 'secure_vault_metadata',
  ENTRIES: 'secure_vault_entries',
  ATTEMPTS: 'secure_vault_attempts',
};

// Initial state helpers
export const hasVault = (): boolean => {
  return !!localStorage.getItem(DB_KEYS.METADATA);
};

export const initVault = (metadata: VaultMetadata) => {
  localStorage.setItem(DB_KEYS.METADATA, JSON.stringify(metadata));
  localStorage.setItem(DB_KEYS.ENTRIES, JSON.stringify([]));
  localStorage.setItem(DB_KEYS.ATTEMPTS, JSON.stringify({ count: 0, lockoutUntil: 0, logs: [] }));
};

export const getMetadata = (): VaultMetadata | null => {
  const data = localStorage.getItem(DB_KEYS.METADATA);
  return data ? JSON.parse(data) : null;
};

export const getEntries = (): PasswordEntry[] => {
  const data = localStorage.getItem(DB_KEYS.ENTRIES);
  return data ? JSON.parse(data) : [];
};

export const saveEntry = (entry: PasswordEntry) => {
  const entries = getEntries();
  entries.push(entry);
  localStorage.setItem(DB_KEYS.ENTRIES, JSON.stringify(entries));
};

export const deleteEntry = (id: string) => {
  const entries = getEntries();
  const newEntries = entries.filter(e => e.id !== id);
  localStorage.setItem(DB_KEYS.ENTRIES, JSON.stringify(newEntries));
};

export const resetVault = () => {
  localStorage.removeItem(DB_KEYS.METADATA);
  localStorage.removeItem(DB_KEYS.ENTRIES);
  localStorage.removeItem(DB_KEYS.ATTEMPTS);
};

// Access attempt logging simulates a security audit log
export interface LoginAttemptLog {
  timestamp: number;
  success: boolean;
}

export interface SecurityState {
  count: number;
  lockoutUntil: number;
  logs: LoginAttemptLog[];
}

export const getSecurityState = (): SecurityState => {
  const data = localStorage.getItem(DB_KEYS.ATTEMPTS);
  return data ? JSON.parse(data) : { count: 0, lockoutUntil: 0, logs: [] };
};

export const updateSecurityState = (state: SecurityState) => {
  localStorage.setItem(DB_KEYS.ATTEMPTS, JSON.stringify(state));
};
