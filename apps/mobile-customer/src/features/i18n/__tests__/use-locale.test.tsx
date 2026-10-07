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
  it("does not let delayed hydration overwrite a language selected by the user", async () => {
    let resolveRead!: (value: string) => void;
    jest.mocked(SecureStore.getItemAsync).mockImplementationOnce(() => new Promise((resolve) => { resolveRead = resolve; }));
    const view = await renderHook(() => ({ locale: useLocale(), setLocale: useSetLocale() }), { wrapper });
    await act(async () => { view.result.current.setLocale("es"); });
    await act(async () => { resolveRead("am"); });
    expect(view.result.current.locale).toBe("es");
  });

  it("continues rendering after storage read/write failures", async () => {
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error("unavailable"));
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error("unavailable"));
    const view = await renderHook(() => ({ locale: useLocale(), setLocale: useSetLocale(), t: useTranslations() }), { wrapper });
    await act(async () => { view.result.current.setLocale("es"); });
    expect(view.result.current.t("nav.home")).toBe("Inicio");
  });

  it("serializes rapid selections so the last language is the one restored", async () => {
    let finishWrite!: () => void;
    jest.mocked(SecureStore.setItemAsync).mockClear();
    jest.mocked(SecureStore.setItemAsync).mockImplementationOnce(() => new Promise((resolve) => { finishWrite = resolve; }));
    const view = await renderHook(() => ({ locale: useLocale(), setLocale: useSetLocale() }), { wrapper });
    await act(async () => { view.result.current.setLocale("es"); view.result.current.setLocale("am"); });
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    await act(async () => { finishWrite(); });
    expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith("bawi_locale", "am");
  });

});
