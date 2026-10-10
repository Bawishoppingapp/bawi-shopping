import { createRequestCache } from "../request-cache";

test("coalesces concurrent reads and uses fresh values until expiry", async () => {
  const clock = jest.spyOn(Date, "now").mockReturnValue(100);
  const cache = createRequestCache<number>(1000);
  const load = jest.fn().mockResolvedValue(7);
  expect(await Promise.all([cache.get("en", load), cache.get("en", load)])).toEqual([7, 7]);
  await cache.get("en", load);
  expect(load).toHaveBeenCalledTimes(1);
  clock.mockReturnValue(1101);
  await cache.get("en", load);
  expect(load).toHaveBeenCalledTimes(2);
  clock.mockRestore();
});

test("force refresh bypasses freshness and failed refresh retains stale data", async () => {
  const cache = createRequestCache<number>(1000);
  await cache.get("en", async () => 7);
  await expect(cache.get("en", async () => { throw new Error("offline"); }, true)).rejects.toThrow("offline");
  expect(cache.peek("en")).toBe(7);
  expect(await cache.get("en", async () => 8, true)).toBe(8);
});

test("invalidated in-flight data cannot repopulate the cache", async () => {
  const cache = createRequestCache<number>(1000);
  let resolve!: (value: number) => void;
  const pending = cache.get("en", () => new Promise<number>((done) => { resolve = done; }));
  await Promise.resolve();
  cache.clear();
  await cache.get("en", async () => 2);
  resolve(1);
  await pending;
  expect(cache.peek("en")).toBe(2);
});

test("isolates keys and bounds memory", async () => {
  const cache = createRequestCache<number>(1000, 2);
  await cache.get("en", async () => 1);
  await cache.get("am", async () => 2);
  expect(cache.peek("en")).toBe(1);
  await cache.get("es", async () => 3);
  expect(cache.peek("en")).toBeUndefined();
  expect(cache.peek("am")).toBe(2);
});
