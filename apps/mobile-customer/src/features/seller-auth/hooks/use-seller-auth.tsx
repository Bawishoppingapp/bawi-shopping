import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { SellerAuthError, activateSellerWithCode, getCurrentSeller, getSellerSessionFromCustomer, loginSellerUser, type SellerMe } from "../services/seller-medusa-auth-client";
import { getSessionToken } from "@/features/auth/services/token-storage";
import { clearSellerSessionToken, getSellerSessionToken, setSellerSessionToken } from "../services/seller-token-storage";

interface SellerAuthContextValue {
  seller: SellerMe | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  activate: (code: string) => Promise<void>;
  restoreFromCustomer: () => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SellerAuthContext = createContext<SellerAuthContextValue | null>(null);

export function SellerAuthProvider({ children }: { children: ReactNode }) {
  const [seller, setSeller] = useState<SellerMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = await getSellerSessionToken();
    if (!token) {
      setSeller(null);
      return;
    }
    const current = await getCurrentSeller(token);
    if (current) {
      setSeller(current);
    } else {
      // Stale/expired token - drop it rather than keep retrying.
      await clearSellerSessionToken();
      setSeller(null);
    }
  }, []);

  useEffect(() => {
    // A temporary backend outage must not leave startup loading forever or
    // discard a valid stored session.
    refresh().catch(() => {}).finally(() => setIsLoading(false));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const token = await loginSellerUser(email, password);
    const current = await getCurrentSeller(token);
    if (!current) {
      throw new SellerAuthError("Could not verify your seller account. Please try again or contact support.");
    }
    await setSellerSessionToken(token);
    setSeller(current);
  }, []);

  const activate = useCallback(async (code: string) => {
    const customerToken = await getSessionToken();
    const token = await activateSellerWithCode(code, customerToken);
    const current = await getCurrentSeller(token);
    if (!current) throw new SellerAuthError("Could not open your storefront. Please try again.");
    await setSellerSessionToken(token);
    setSeller(current);
  }, []);

  const restoreFromCustomer = useCallback(async () => {
    const customerToken = await getSessionToken();
    if (!customerToken) return false;
    const token = await getSellerSessionFromCustomer(customerToken);
    if (!token) return false;
    const current = await getCurrentSeller(token);
    if (!current) return false;
    await setSellerSessionToken(token);
    setSeller(current);
    return true;
  }, []);

  const logout = useCallback(async () => {
    await clearSellerSessionToken();
    setSeller(null);
  }, []);

  const value = useMemo(
    () => ({ seller, isLoading, login, activate, restoreFromCustomer, logout, refresh }),
    [seller, isLoading, login, activate, restoreFromCustomer, logout, refresh]
  );

  // Known TS false positive: Context.Provider's exotic component type
  // intermittently fails TS's JSX element-type check under this
  // @types/react version in this monorepo (same suppression as the
  // customer AuthProvider). Runtime behavior is unaffected.
  // @ts-expect-error - see comment above
  return <SellerAuthContext.Provider value={value}>{children}</SellerAuthContext.Provider>;
}

export function useSellerAuth() {
  const ctx = useContext(SellerAuthContext);
  if (!ctx) {
    throw new Error("useSellerAuth must be used within a SellerAuthProvider");
  }
  return ctx;
}

export { SellerAuthError };
