import { wishlistCache } from "@/features/wishlist/services/wishlist-client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  MedusaAuthError,
  createCustomer,
  deleteCustomerAccount,
  getCurrentCustomer,
  loginCustomer,
  registerCustomerAuthIdentity,
} from "../services/medusa-auth-client";
import { clearSessionToken, getSessionToken, setSessionToken } from "../services/token-storage";

export interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface AuthContextValue {
  customer: Customer | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { firstName: string; lastName: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getSessionToken();
      if (token) {
        const current = await getCurrentCustomer(token);
        if (current) {
          setCustomer(current);
        } else {
          // Stale/expired token - drop it rather than keep retrying.
          await clearSessionToken();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const token = await loginCustomer(email, password);
    await setSessionToken(token);
    const current = await getCurrentCustomer(token);
    if (!current) {
      await clearSessionToken();
      throw new MedusaAuthError("Sign-in could not be completed");
    }
    setCustomer(current);
  }, []);

  const register = useCallback(
    async (input: { firstName: string; lastName: string; email: string; password: string }) => {
      let registrationToken: string;
      try {
        registrationToken = await registerCustomerAuthIdentity(input.email, input.password);
      } catch (error) {
        // Registration has two backend steps. If the Store API rejected step
        // two (for example after a rotated publishable key), the auth identity
        // already exists but has no customer attached. Prove ownership with
        // the same password, then finish the interrupted registration.
        if (!(error instanceof MedusaAuthError) || !/identity with email already exists/i.test(error.message)) {
          throw error;
        }
        registrationToken = await loginCustomer(input.email, input.password);
        if (await getCurrentCustomer(registrationToken)) {
          throw new MedusaAuthError("Account already exists");
        }
      }
      await createCustomer(registrationToken, {
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
      });
      const sessionToken = await loginCustomer(input.email, input.password);
      await setSessionToken(sessionToken);
      const current = await getCurrentCustomer(sessionToken);
      if (!current) {
        await clearSessionToken();
        throw new MedusaAuthError("Account was created, but sign-in could not be completed");
      }
      setCustomer(current);
    },
    []
  );

  const logout = useCallback(async () => {
    await clearSessionToken();
    wishlistCache.clear();
    setCustomer(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    const token = await getSessionToken();
    if (!token) throw new MedusaAuthError("No active customer session");
    await deleteCustomerAccount(token);
    await clearSessionToken();
    wishlistCache.clear();
    setCustomer(null);
  }, []);

  const value = useMemo(
    () => ({ customer, isLoading, login, register, logout, deleteAccount }),
    [customer, isLoading, login, register, logout, deleteAccount]
  );

  // Known TS false positive: Context.Provider's exotic component type
  // intermittently fails TS's JSX element-type check under this
  // @types/react version in this monorepo (see mobile-seller's identical
  // suppression for the same symptom). Runtime behavior is unaffected.
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
