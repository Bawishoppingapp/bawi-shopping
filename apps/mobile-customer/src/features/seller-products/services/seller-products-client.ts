// Mirrors apps/seller-portal/src/features/products/services/products-client.ts
// exactly - same /seller/products* endpoints, same request/response
// shapes, same bearer-only auth (no publishable key). Named distinctly
// from mobile-customer's own features/products (public browsing) since
// both live in this one merged app now.
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

export class ProductsClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductsClientError";
  }
}

// Real enum, apps/backend/src/modules/product-listing/state-machine.ts -
// no "submitted"/"under_review" alias exists in this codebase.
export type ProductListingStatus = "draft" | "pending_review" | "approved" | "rejected" | "archived";

export interface SellerProductListing {
  id: string;
  status: ProductListingStatus;
  product_code: string;
  rejection_reason?: string | null;
}

export interface SellerProductSummary {
  listing: SellerProductListing;
  product: { id: string; title: string; thumbnail: string | null; status: string } | null;
}

export interface ProductVariantInput {
  color: string;
  size: string;
  price?: number;
  inventory_quantity: number;
}

export interface ProductDraftInput {
  title: string;
  description: string;
  category_id: string;
  base_price: number;
  variants: ProductVariantInput[];
}

export interface SellerProductVariant {
  id: string;
  title: string;
  color: string | null;
  size: string | null;
  price: number | null;
  inventory_quantity: number;
}

export interface SellerProductDetail {
  listing: SellerProductListing;
  product: {
    id: string;
    title: string;
    description: string;
    category_id: string;
    thumbnail: string | null;
    images: string[];
    variants: SellerProductVariant[];
  };
}

export interface CategoryOption {
  id: string;
  name: string;
}

async function parseJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

async function request(path: string, sessionToken: string, init?: RequestInit) {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(`${MEDUSA_BACKEND_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      ...(init?.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new ProductsClientError(data.message || "Request failed");
  }
  return data;
}

export async function listMyProducts(sessionToken: string): Promise<SellerProductSummary[]> {
  const data = await request("/seller/products", sessionToken);
  return data.products;
}

export async function getMyProduct(sessionToken: string, listingId: string): Promise<SellerProductDetail> {
  const data = await request(`/seller/products/${listingId}`, sessionToken);
  return data;
}

export async function listCategories(sessionToken: string): Promise<CategoryOption[]> {
  const data = await request("/seller/categories", sessionToken);
  return data.categories;
}

export async function createProduct(
  sessionToken: string,
  input: ProductDraftInput
): Promise<{ listing: SellerProductListing }> {
  return request("/seller/products", sessionToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateProduct(
  sessionToken: string,
  listingId: string,
  input: ProductDraftInput
): Promise<{ listing: SellerProductListing }> {
  return request(`/seller/products/${listingId}`, sessionToken, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function submitProductForReview(
  sessionToken: string,
  listingId: string
): Promise<{ listing: SellerProductListing }> {
  return request(`/seller/products/${listingId}/submit`, sessionToken, {
    method: "POST",
  });
}

/**
 * React Native FormData files use {uri, name, type} objects (from
 * expo-image-picker), not the web File API - the shape fetch() expects
 * on RN. No Content-Type header is set here (or by request() above for
 * FormData bodies) - RN's fetch sets the multipart boundary itself, same
 * reasoning as the web client's own comment on why it skips that header.
 */
export async function uploadProductImages(
  sessionToken: string,
  listingId: string,
  files: { uri: string; name: string; type: string }[],
  isPrimary: boolean
): Promise<{ product: SellerProductDetail["product"] }> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file as unknown as Blob);
  }
  formData.append("is_primary", String(isPrimary));

  return request(`/seller/products/${listingId}/images`, sessionToken, {
    method: "POST",
    body: formData,
  });
}
