export interface PasswordEntry {
  id: string;
  site: string;
  username: string;
  encryptedPassword: string; // Base64 encoded ciphertext
  iv: string; // Base64 encoded IV
  createdAt: number;
}

export interface DecryptedEntry extends Omit<PasswordEntry, 'encryptedPassword' | 'iv'> {
  password: string;
}

export interface VaultMetadata {
  salt: string; // Base64 salt for key derivation
  authHash: string; // SHA-256 hash of password for validation (Base64)
}

export interface AuthState {
  isAuthenticated: boolean;
  isLocked: boolean;
  lockoutTimeRemaining: number; // Seconds
}
