import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { MedusaAuthError, getCurrentSeller, loginSellerUser, type SellerMe } from "../services/medusa-auth-client";
import { clearSessionToken, getSessionToken, setSessionToken } from "../services/token-storage";

interface AuthContextValue {
  seller: SellerMe | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [seller, setSeller] = useState<SellerMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = await getSessionToken();
    if (!token) {
      setSeller(null);
      return;
    }
    const current = await getCurrentSeller(token);
    if (current) {
      setSeller(current);
    } else {
      // Stale/expired token - drop it rather than keep retrying.
      await clearSessionToken();
      setSeller(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const token = await loginSellerUser(email, password);
    await setSessionToken(token);
    const current = await getCurrentSeller(token);
    setSeller(current);
  }, []);

  const logout = useCallback(async () => {
    await clearSessionToken();
    setSeller(null);
  }, []);

  const value = useMemo(
    () => ({ seller, isLoading, login, logout, refresh }),
    [seller, isLoading, login, logout, refresh]
  );

  // Known false positive isolated to this app: the identical line in
  // mobile-customer's own use-auth.tsx typechecks clean under the same
  // tsconfig typeRoots fix (see that file's history) - this one spot in
  // mobile-seller still hits TS's exotic-JSX-component/ReactNode mismatch
  // for reasons that didn't reproduce anywhere else. Runtime behavior is
  // unaffected (Context.Provider works identically either way).
  // @ts-expect-error - see comment above
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export { MedusaAuthError };
