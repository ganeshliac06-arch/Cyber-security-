import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Unlock, Plus, Trash2, Eye, EyeOff, ShieldCheck, AlertTriangle, Key, Globe, User, LogOut } from 'lucide-react';
import * as Auth from './services/auth';
import * as DB from './services/db';
import * as Crypto from './services/crypto';
import { PasswordEntry } from './types';
import Button from './components/Button';
import Input from './components/Input';

enum ViewState {
  LOADING,
  ONBOARDING,
  LOGIN,
  VAULT
}

const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>(ViewState.LOADING);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  
  // Auth Form State
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string>('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState<number>(0);

  // Vault State
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});

  // Add Entry Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEntrySite, setNewEntrySite] = useState('');
  const [newEntryUsername, setNewEntryUsername] = useState('');
  const [newEntryPassword, setNewEntryPassword] = useState('');

  // Initial Check
  useEffect(() => {
    const hasVault = DB.hasVault();
    if (hasVault) {
      setViewState(ViewState.LOGIN);
      const status = Auth.getLockoutStatus();
      if (status.isLocked) {
        setLockoutTimer(status.remaining);
      }
    } else {
      setViewState(ViewState.ONBOARDING);
    }
  }, []);

  // Lockout Timer Effect
  useEffect(() => {
    if (lockoutTimer > 0) {
      const interval = setInterval(() => {
        setLockoutTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutTimer]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      setAuthError('Passwords do not match.');
      return;
    }

    setIsAuthLoading(true);
    try {
      // Small delay to simulate work and prevent timing attacks (conceptually)
      await new Promise(r => setTimeout(r, 800)); 
      const key = await Auth.registerUser(passwordInput);
      setMasterKey(key);
      setViewState(ViewState.VAULT);
      setEntries([]);
      setPasswordInput('');
    } catch (err) {
      setAuthError('Failed to create vault.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    try {
      await new Promise(r => setTimeout(r, 500)); // UI polish
      const result = await Auth.loginUser(passwordInput);
      
      if (result.success && result.key) {
        setMasterKey(result.key);
        setEntries(DB.getEntries());
        setViewState(ViewState.VAULT);
        setPasswordInput('');
      } else {
        setAuthError(result.error || 'Login failed');
        if (result.error?.includes('locked')) {
           const status = Auth.getLockoutStatus();
           setLockoutTimer(status.remaining);
        }
      }
    } catch (err) {
      setAuthError('An unexpected error occurred.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setMasterKey(null);
    setEntries([]);
    setRevealedIds(new Set());
    setDecryptedValues({});
    setViewState(ViewState.LOGIN);
    setPasswordInput('');
    setAuthError('');
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterKey) return;

    try {
      const { ciphertext, iv } = await Crypto.encryptData(newEntryPassword, masterKey);
      
      const newEntry: PasswordEntry = {
        id: crypto.randomUUID(),
        site: newEntrySite,
        username: newEntryUsername,
        encryptedPassword: ciphertext,
        iv: iv,
        createdAt: Date.now()
      };

      DB.saveEntry(newEntry);
      setEntries(prev => [...prev, newEntry]);
      
      // Reset Form
      setNewEntrySite('');
      setNewEntryUsername('');
      setNewEntryPassword('');
      setIsAddModalOpen(false);
    } catch (err) {
      console.error("Encryption failed", err);
      alert("Failed to save password.");
    }
  };

  const handleDeleteEntry = (id: string) => {
    if (window.confirm("Are you sure you want to delete this password?")) {
      DB.deleteEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
      
      // Cleanup decrypted cache
      const newDecrypted = { ...decryptedValues };
      delete newDecrypted[id];
      setDecryptedValues(newDecrypted);
    }
  };

  const toggleReveal = async (entry: PasswordEntry) => {
    if (revealedIds.has(entry.id)) {
      const newSet = new Set(revealedIds);
      newSet.delete(entry.id);
      setRevealedIds(newSet);
    } else {
      if (!masterKey) return;
      
      // Decrypt on demand
      if (!decryptedValues[entry.id]) {
        try {
          const plaintext = await Crypto.decryptData(entry.encryptedPassword, entry.iv, masterKey);
          setDecryptedValues(prev => ({ ...prev, [entry.id]: plaintext }));
        } catch (err) {
          console.error("Decryption failed", err);
          alert("Failed to decrypt. Data might be corrupted.");
          return;
        }
      }
      
      const newSet = new Set(revealedIds);
      newSet.add(entry.id);
      setRevealedIds(newSet);
    }
  };

  const resetVault = () => {
    if(window.confirm("This will permanently delete all your passwords. This action cannot be undone. Are you sure?")) {
      DB.resetVault();
      window.location.reload();
    }
  };

  if (viewState === ViewState.LOADING) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-200">Loading SecureVault...</div>;
  }

  // --- ONBOARDING VIEW ---
  if (viewState === ViewState.ONBOARDING) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl p-8 border border-slate-700">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-indigo-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to SecureVault</h1>
            <p className="text-slate-400">Create a master password to initialize your encrypted vault.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-6">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
              <h3 className="text-blue-400 font-medium flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4" /> Security Notice
              </h3>
              <p className="text-sm text-blue-300/80">
                Your master password is never stored. It is hashed for verification and used to derive your encryption key. 
                <br/><strong className="text-blue-200">If you lose it, your data is lost forever.</strong>
              </p>
            </div>

            <Input 
              label="Master Password" 
              type="password" 
              value={passwordInput} 
              onChange={e => setPasswordInput(e.target.value)}
              placeholder="Enter a strong password"
              icon={<Key className="w-5 h-5" />}
            />
            <Input 
              label="Confirm Password" 
              type="password" 
              value={confirmPasswordInput} 
              onChange={e => setConfirmPasswordInput(e.target.value)}
              placeholder="Re-enter password"
              icon={<Key className="w-5 h-5" />}
              error={authError}
            />

            <Button type="submit" className="w-full" isLoading={isAuthLoading}>
              Create Vault
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // --- LOGIN VIEW ---
  if (viewState === ViewState.LOGIN) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl p-8 border border-slate-700 relative overflow-hidden">
          {lockoutTimer > 0 && (
            <div className="absolute inset-0 bg-slate-900/90 z-10 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
              <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Security Lockout</h2>
              <p className="text-slate-300 mb-6">Too many failed attempts. Encryption keys are temporarily locked.</p>
              <div className="text-4xl font-mono font-bold text-red-400">{lockoutTimer}s</div>
            </div>
          )}

          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-indigo-500" />
            </div>
            <h1 className="text-2xl font-bold text-white">Unlock Vault</h1>
            <p className="text-slate-400 mt-2">Enter your master password to decrypt your data.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <Input 
              label="Master Password" 
              type="password" 
              value={passwordInput} 
              onChange={e => setPasswordInput(e.target.value)}
              placeholder="••••••••••••"
              icon={<Key className="w-5 h-5" />}
              error={authError}
              disabled={lockoutTimer > 0}
            />

            <Button type="submit" className="w-full" isLoading={isAuthLoading} disabled={lockoutTimer > 0}>
              Unlock
            </Button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-slate-700 text-center">
             <button onClick={resetVault} className="text-xs text-red-500 hover:text-red-400 underline">
               Reset Vault (Delete All Data)
             </button>
          </div>
        </div>
      </div>
    );
  }

  // --- VAULT VIEW ---
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 pb-20">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-500" />
            <span className="font-bold text-xl text-white tracking-tight">SecureVault</span>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-xs text-slate-500 hidden sm:inline-block">AES-256-GCM Encrypted</span>
            <Button variant="ghost" onClick={handleLogout} className="text-sm">
              <LogOut className="w-4 h-4 mr-2" /> Lock
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-white">My Passwords</h2>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Password
          </Button>
        </div>

        {/* List */}
        {entries.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/50 rounded-xl border border-slate-700 border-dashed">
            <div className="mx-auto w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mb-4">
              <Key className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">Your vault is empty</h3>
            <p className="text-slate-400 mb-6">Add your first password to get started.</p>
            <Button variant="secondary" onClick={() => setIsAddModalOpen(true)}>Add Password</Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {entries.map(entry => (
              <div key={entry.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-slate-600 transition-colors">
                <div className="flex items-start gap-4 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-white truncate">{entry.site}</h3>
                    <div className="flex items-center text-slate-400 text-sm mt-0.5">
                      <User className="w-3 h-3 mr-1.5" />
                      <span className="truncate">{entry.username}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:border-l sm:border-slate-700 sm:pl-4">
                   <div className="flex-1 sm:w-64">
                    {revealedIds.has(entry.id) ? (
                        <div className="bg-slate-900/50 px-3 py-2 rounded text-emerald-400 font-mono text-sm break-all border border-slate-700/50">
                            {decryptedValues[entry.id] || 'Decrypting...'}
                        </div>
                    ) : (
                        <div className="bg-slate-900/50 px-3 py-2 rounded text-slate-500 font-mono text-sm select-none border border-slate-700/50">
                            ••••••••••••••••
                        </div>
                    )}
                   </div>
                   
                   <div className="flex items-center gap-2">
                    <button 
                        onClick={() => toggleReveal(entry)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                        title={revealedIds.has(entry.id) ? "Hide Password" : "Show Password"}
                    >
                        {revealedIds.has(entry.id) ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                    <button 
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Add New Password</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleAddEntry} className="p-6 space-y-4">
              <Input 
                label="Website / Service" 
                value={newEntrySite}
                onChange={e => setNewEntrySite(e.target.value)}
                placeholder="e.g. google.com"
                icon={<Globe className="w-4 h-4" />}
                required
                autoFocus
              />
              <Input 
                label="Username / Email" 
                value={newEntryUsername}
                onChange={e => setNewEntryUsername(e.target.value)}
                placeholder="e.g. user@example.com"
                icon={<User className="w-4 h-4" />}
                required
              />
              <Input 
                label="Password" 
                type="password"
                value={newEntryPassword}
                onChange={e => setNewEntryPassword(e.target.value)}
                placeholder="Enter password"
                icon={<Key className="w-4 h-4" />}
                required
              />

              <div className="pt-2 flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Save Encrypted
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;