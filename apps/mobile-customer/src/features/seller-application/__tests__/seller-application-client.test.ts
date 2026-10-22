import {
  SellerApplicationUnavailableError,
  getSellerApplicationStatus,
  submitSellerApplication,
} from "../services/seller-application-client";

describe("seller application network handling", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  test("a backend outage does not look like a missing application", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });

    await expect(getSellerApplicationStatus("app_1")).rejects.toThrow(SellerApplicationUnavailableError);
  });

  test("a confirmed missing application returns null", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });

    await expect(getSellerApplicationStatus("app_1")).resolves.toBeNull();
  });

  test("submission stops waiting when the backend never responds", async () => {
    jest.useFakeTimers();
    try {
      (globalThis.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
      const submission = submitSellerApplication({} as Parameters<typeof submitSellerApplication>[0]);
      const result = expect(submission).rejects.toThrow(SellerApplicationUnavailableError);
      await jest.advanceTimersByTimeAsync(30_000);
      await result;
    } finally {
      jest.useRealTimers();
    }
  });
});
