import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, isLocale, type Locale } from "@bawi/i18n/locales";
import { createTranslator } from "@bawi/i18n/translate";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// Native equivalent of packages/i18n's LocaleProvider/useLocale/
// useTranslations (locale-context.tsx) - not imported directly because
// that file is exported only from @bawi/i18n's root "." barrel, which
// also re-exports the DOM-only LanguageSelector and a Next.js Server
// Action (setLocale, "next/headers"-coupled) - pulling in `next` as a
// resolvable dependency for a mobile bundle isn't worth the risk for a
// ~20-line context. `translate`/`createTranslator` (pure logic) come
// from the safe "./translate" subpath instead, same pattern already
// used for `DEFAULT_LOCALE`/`LOCALES` via "./locales" elsewhere in this
// app. Persists to SecureStore under the same key name the web version
// uses for its cookie (LOCALE_COOKIE_NAME) - not a cookie here, just a
// convenient shared constant.
interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isLoading: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isLoading, setIsLoading] = useState(true);

  const changed = useRef(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(LOCALE_COOKIE_NAME)
      .then((stored) => {
        if (active && !changed.current && stored && isLocale(stored)) setLocaleState(stored);
      })
      .catch(() => { /* A storage failure must not prevent shopping. */ })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    changed.current = true;
    setLocaleState(next);
    // Serialize writes so a slow earlier selection cannot win after restart.
    writes.current = writes.current.then(() => SecureStore.setItemAsync(LOCALE_COOKIE_NAME, next)).catch(() => {});
  }, []);

  const value = useMemo(() => ({ locale, setLocale, isLoading }), [locale, setLocale, isLoading]);

  // Known TS false positive: Context.Provider's exotic component type
  // intermittently fails TS's JSX element-type check under this
  // @types/react version in this monorepo (same suppression as every
  // other provider in this app - see use-auth.tsx's identical comment).
  // @ts-expect-error - see comment above
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx.locale;
}

export function useSetLocale(): (locale: Locale) => void {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useSetLocale must be used within a LocaleProvider");
  return ctx.setLocale;
}

export function useTranslations() {
  const locale = useLocale();
  return useMemo(() => createTranslator(locale), [locale]);
}

export function useLocaleReady() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocaleReady must be used within a LocaleProvider");
  return !ctx.isLoading;
}
