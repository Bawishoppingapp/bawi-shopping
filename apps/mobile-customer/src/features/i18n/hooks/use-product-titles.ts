import { useEffect, useState } from "react";
import { getPublicProduct } from "@/features/products/services/products-client";
import { useLocale } from "./use-locale";

/** Resolve approved catalog translations without changing transactional snapshots. */
export function useProductTitles(codes: (string | null)[]) {
  const locale = useLocale();
  const key = JSON.stringify([...new Set(codes.filter((code): code is string => Boolean(code)))].sort());
  const [result, setResult] = useState<{ locale: string; titles: Record<string, string> }>({ locale, titles: {} });
  useEffect(() => {
    let active = true;
    const codes: string[] = JSON.parse(key);
    Promise.all(codes.map(async (code) => {
      try { const product = await getPublicProduct(code, locale); return [code, product?.title] as const; }
      catch { return [code, undefined] as const; }
    })).then((entries) => {
      if (active) setResult({ locale, titles: Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))) });
    });
    return () => { active = false; };
  }, [key, locale]);
  return result.locale === locale ? result.titles : {};
}
