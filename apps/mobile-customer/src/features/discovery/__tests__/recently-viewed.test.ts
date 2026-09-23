import * as SecureStore from "expo-secure-store";

import {
  clearRecentlyViewed,
  getRecentlyViewed,
  recordProductView,
  removeRecentlyViewedProduct,
} from "../services/recently-viewed";

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
});
