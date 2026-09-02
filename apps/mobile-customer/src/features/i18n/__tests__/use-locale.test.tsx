import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import type { ReactNode } from "react";

import { LocaleProvider, useLocale, useSetLocale, useTranslations } from "../hooks/use-locale";

const wrapper = ({ children }: { children: ReactNode }) => <LocaleProvider>{children}</LocaleProvider>;

describe("LocaleProvider", () => {
  beforeEach(() => {
    (SecureStore as typeof SecureStore & { __reset: () => void }).__reset();
  });

  it("updates all consumers immediately and restores the saved language after remount", async () => {
    const first = await renderHook(
      () => ({ locale: useLocale(), setLocale: useSetLocale(), t: useTranslations() }),
      { wrapper },
    );

    await waitFor(() => expect(first.result.current.locale).toBe("en-US"));

    await act(async () => {
      first.result.current.setLocale("es");
    });
    await waitFor(() => expect(first.result.current.locale).toBe("es"));
    expect(first.result.current.t("nav.home")).toBe("Inicio");
    await waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenCalledWith("bawi_locale", "es"));
    await first.unmount();

    const restored = await renderHook(() => ({ locale: useLocale(), t: useTranslations() }), { wrapper });
    await waitFor(() => expect(restored.result.current.locale).toBe("es"));
    expect(restored.result.current.t("nav.cart")).toBe("Carrito");
  });
});
