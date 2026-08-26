import * as SecureStore from "expo-secure-store";

// Device-local only - no backend concept of search history exists (and
// shouldn't for something this ephemeral/per-device). Reuses
// expo-secure-store (already a dependency for auth tokens) rather than
// adding a new storage library for what's just a small JSON array.
const RECENT_SEARCHES_KEY = "bawi_recent_searches";
const MAX_RECENT_SEARCHES = 8;

export async function getRecentSearches(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(RECENT_SEARCHES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addRecentSearch(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return getRecentSearches();
  const existing = await getRecentSearches();
  const next = [trimmed, ...existing.filter((q) => q.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    MAX_RECENT_SEARCHES
  );
  await SecureStore.setItemAsync(RECENT_SEARCHES_KEY, JSON.stringify(next));
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  await SecureStore.deleteItemAsync(RECENT_SEARCHES_KEY);
}
