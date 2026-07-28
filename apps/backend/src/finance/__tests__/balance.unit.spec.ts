import { deriveLedgerBucket, summarizeSellerBalance } from "../balance"

describe("deriveLedgerBucket", () => {
  const now = new Date("2026-07-28T00:00:00Z")

  test("an entry with no timestamps at all is pending", () => {
    expect(
      deriveLedgerBucket({ net_amount: 1000, available_at: null, paid_at: null, disputed_at: null }, now)
    ).toBe("pending")
  })

  test("an entry whose available_at is still in the future is pending", () => {
    expect(
      deriveLedgerBucket(
        { net_amount: 1000, available_at: "2026-07-29T00:00:00Z", paid_at: null, disputed_at: null },
        now
      )
    ).toBe("pending")
  })

  test("an entry whose available_at has already passed is available", () => {
    expect(
      deriveLedgerBucket(
        { net_amount: 1000, available_at: "2026-07-27T00:00:00Z", paid_at: null, disputed_at: null },
        now
      )
    ).toBe("available")
  })

  test("an entry with paid_at set is paid, regardless of available_at", () => {
    expect(
      deriveLedgerBucket(
        {
          net_amount: 1000,
          available_at: "2026-07-01T00:00:00Z",
          paid_at: "2026-07-10T00:00:00Z",
          disputed_at: null,
        },
        now
      )
    ).toBe("paid")
  })

  test("a paid entry stays paid even if later disputed - money already moved", () => {
    expect(
      deriveLedgerBucket(
        {
          net_amount: 1000,
          available_at: "2026-07-01T00:00:00Z",
          paid_at: "2026-07-10T00:00:00Z",
          disputed_at: "2026-07-15T00:00:00Z",
        },
        now
      )
    ).toBe("paid")
  })

  test("disputed beats available/pending when not yet paid", () => {
    expect(
      deriveLedgerBucket(
        {
          net_amount: 1000,
          available_at: "2026-07-01T00:00:00Z",
          paid_at: null,
          disputed_at: "2026-07-15T00:00:00Z",
        },
        now
      )
    ).toBe("disputed")
  })
})

describe("summarizeSellerBalance", () => {
  const now = new Date("2026-07-28T00:00:00Z")

  test("sums entries into their derived buckets", () => {
    const summary = summarizeSellerBalance(
      [
        { net_amount: 100, available_at: null, paid_at: null, disputed_at: null, reason: "order" },
        {
          net_amount: 200,
          available_at: "2026-07-01T00:00:00Z",
          paid_at: null,
          disputed_at: null,
          reason: "order",
        },
        {
          net_amount: 300,
          available_at: "2026-07-01T00:00:00Z",
          paid_at: "2026-07-10T00:00:00Z",
          disputed_at: null,
          reason: "order",
        },
        {
          net_amount: 400,
          available_at: "2026-07-01T00:00:00Z",
          paid_at: null,
          disputed_at: "2026-07-15T00:00:00Z",
          reason: "order",
        },
      ],
      now
    )

    expect(summary).toEqual({
      pending: 100,
      available: 200,
      paid: 300,
      disputed: 400,
      reversed: 0,
    })
  })

  test("refund_reversal entries accumulate separately into `reversed`, on top of their own bucket", () => {
    const summary = summarizeSellerBalance(
      [
        { net_amount: 500, available_at: null, paid_at: null, disputed_at: null, reason: "order" },
        {
          net_amount: -200,
          available_at: "2026-07-01T00:00:00Z",
          paid_at: null,
          disputed_at: null,
          reason: "refund_reversal",
        },
      ],
      now
    )

    expect(summary.reversed).toBe(-200)
    expect(summary.available).toBe(-200)
    expect(summary.pending).toBe(500)
  })

  test("an empty entry list produces an all-zero summary", () => {
    expect(summarizeSellerBalance([], now)).toEqual({
      pending: 0,
      available: 0,
      paid: 0,
      disputed: 0,
      reversed: 0,
    })
  })
})
