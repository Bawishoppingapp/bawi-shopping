import { useProductTitles } from "@/features/i18n/hooks/use-product-titles";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSessionToken } from "@/features/auth/services/token-storage";

import {
  type Cart,
  addCartItem,
  getCart,
  mergeGuestCartIntoCustomerCart,
  removeCartItem,
  updateCartItemQuantity,
} from "../services/cart-client";
import { clearCartId, getCartId, setCartId } from "../services/cart-storage";

interface CartContextValue {
  cart: Cart | null;
  isLoading: boolean;
  addItem: (variantId: string, quantity: number) => Promise<void>;
  updateQuantity: (lineItemId: string, quantity: number) => Promise<void>;
  removeItem: (lineItemId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { customer } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [cartId, sessionToken] = await Promise.all([getCartId(), getSessionToken()]);
    if (!cartId) {
      setCart(null);
      return;
    }
    try {
      const result = await getCart(cartId, sessionToken);
      setCart(result);
    } catch {
      // Leave the last-known cart in place rather than clearing it on a
      // transient network error.
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  // Merge the guest cart into the customer's cart the moment a session
  // appears (covers both "logged in with items already in the guest
  // cart" and "registered mid-shopping") - mirrors
  // apps/storefront/src/features/cart/actions/merge-cart.ts's
  // mergeGuestCartOnLogin, best-effort so a merge hiccup never blocks
  // auth or shopping.
  useEffect(() => {
    if (!customer) return;
    (async () => {
      const guestCartId = await getCartId();
      const sessionToken = await getSessionToken();
      if (!guestCartId || !sessionToken) return;
      try {
        await mergeGuestCartIntoCustomerCart(guestCartId, sessionToken);
      } catch {
        // Best-effort - the guest cart id simply stays around to retry later.
        return;
      }
      await clearCartId();
      await refresh();
    })();
  }, [customer, refresh]);

  const addItem = useCallback(async (variantId: string, quantity: number) => {
    const [cartId, sessionToken] = await Promise.all([getCartId(), getSessionToken()]);
    const result = await addCartItem(cartId, variantId, quantity, sessionToken);
    await setCartId(result.id);
    setCart(result);
  }, []);

  const updateQuantity = useCallback(async (lineItemId: string, quantity: number) => {
    const [cartId, sessionToken] = await Promise.all([getCartId(), getSessionToken()]);
    if (!cartId) return;
    const result = await updateCartItemQuantity(cartId, lineItemId, quantity, sessionToken);
    setCart(result);
  }, []);

  const removeItem = useCallback(async (lineItemId: string) => {
    const [cartId, sessionToken] = await Promise.all([getCartId(), getSessionToken()]);
    if (!cartId) return;
    const result = await removeCartItem(cartId, lineItemId, sessionToken);
    setCart(result);
  }, []);

  const titles = useProductTitles(cart?.items.map((item) => item.product_code) ?? []);
  const localizedCart = useMemo(() => cart ? { ...cart, items: cart.items.map((item) => ({ ...item, title: (item.product_code && titles[item.product_code]) || item.title })) } : null, [cart, titles]);
  const value = useMemo(
    () => ({ cart: localizedCart, isLoading, addItem, updateQuantity, removeItem, refresh }),
    [localizedCart, isLoading, addItem, updateQuantity, removeItem, refresh]
  );

  // Known TS false positive: see the identical comment on
  // AuthProvider's return in features/auth/hooks/use-auth.tsx.
  // @ts-expect-error - see comment above
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
