"use server"

import {
  searchProducts,
  type ProductSearchParams,
  type ProductSearchResponse,
} from "../services/discovery-client"

/** Thin server-side wrapper so the "Load more" Client Component never talks
 * to the Medusa backend directly (docs/ARCHITECTURE.md §5 - frontends never
 * construct requests to internal services outside a Server
 * Component/Action/Route Handler). */
export async function loadMoreProducts(
  params: ProductSearchParams
): Promise<ProductSearchResponse> {
  return searchProducts(params)
}
