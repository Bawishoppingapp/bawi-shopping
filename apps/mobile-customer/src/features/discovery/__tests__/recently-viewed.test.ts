import { getPublicProduct } from "@/features/products/services/products-client";
import * as SecureStore from "expo-secure-store";

import {
  clearRecentlyViewed,
  getRecentlyViewed,
  recordProductView,
  removeRecentlyViewedProduct,
} from "../services/recently-viewed";

jest.mock("@/features/products/services/products-client");

const product = {
  productCode: "BAWI-TEST-001",
  title: "Test item",
  brand: "Bawi",
  thumbnail: null,
  priceMin: 100,
  priceMax: 100,
  currencyCode: "etb",
  available: true,
  categoryIds: [],
};

describe("recently viewed products", () => {
  beforeEach(() => {
    (SecureStore as typeof SecureStore & { __reset: () => void }).__reset();
  });

  test("removes a product that is no longer public", async () => {
    await recordProductView(product);
    await removeRecentlyViewedProduct(product.productCode);

    await expect(getRecentlyViewed()).resolves.toEqual([]);
  });

  test("clears stale catalog history", async () => {
    await recordProductView(product);
    await clearRecentlyViewed();

    await expect(getRecentlyViewed()).resolves.toEqual([]);
  });
  test("reloads titles in the selected language without changing the saved originals", async () => {
    await recordProductView(product);
    jest.mocked(getPublicProduct).mockResolvedValue({ title: "Vestido", thumbnail: null } as Awaited<ReturnType<typeof getPublicProduct>>);
    expect((await getRecentlyViewed("es"))[0].title).toBe("Vestido");
    expect(getPublicProduct).toHaveBeenCalledWith(product.productCode, "es");
    expect((await getRecentlyViewed())[0].title).toBe("Test item");
  });

});
