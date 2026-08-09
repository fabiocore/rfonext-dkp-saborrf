import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { login as apiLogin, setAuthToken, setOnUnauthorized, type UserRole } from '../api/client';

interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = 'rfonext-dkp-auth';

const AuthContext = createContext<AuthState | null>(null);

function loadStored(): { user: AuthUser; token: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = loadStored();
    if (stored) {
      setUser(stored.user);
      setToken(stored.token);
      setAuthToken(stored.token);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
      setToken(null);
      setAuthToken(null);
      localStorage.removeItem(STORAGE_KEY);
    });
    return () => setOnUnauthorized(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      isLoading,
      login: async (username: string, password: string) => {
        const result = await apiLogin(username, password);
        setUser(result.user);
        setToken(result.accessToken);
        setAuthToken(result.accessToken);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: result.user, token: result.accessToken }));
      },
      logout: () => {
        setUser(null);
        setToken(null);
        setAuthToken(null);
        localStorage.removeItem(STORAGE_KEY);
      },
    }),
    [user, token, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return ctx;
}
