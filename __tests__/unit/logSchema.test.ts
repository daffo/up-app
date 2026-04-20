import { LogSchema, BookmarkSchema, LogStatusSchema } from "../../lib/schemas";

describe("LogStatusSchema", () => {
  it("accepts sent and attempted", () => {
    expect(LogStatusSchema.safeParse("sent").success).toBe(true);
    expect(LogStatusSchema.safeParse("attempted").success).toBe(true);
  });

  it("rejects other values", () => {
    expect(LogStatusSchema.safeParse("other").success).toBe(false);
    expect(LogStatusSchema.safeParse("").success).toBe(false);
  });
});

describe("LogSchema", () => {
  const base = {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "22222222-2222-4222-8222-222222222222",
    route_id: "33333333-3333-4333-8333-333333333333",
    quality_rating: null,
    difficulty_rating: null,
    fall_hold_id: null,
    logged_at: "2026-04-20T00:00:00Z",
    created_at: "2026-04-20T00:00:00Z",
  };

  const validFallHoldId = "99999999-9999-4999-8999-999999999999";

  it("accepts a sent log with difficulty and no fall hold", () => {
    const result = LogSchema.safeParse({
      ...base,
      status: "sent",
      difficulty_rating: 0,
    });
    expect(result.success).toBe(true);
  });

  it("accepts an attempted log with fall hold and no difficulty", () => {
    const result = LogSchema.safeParse({
      ...base,
      status: "attempted",
      fall_hold_id: validFallHoldId,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a log with quality rating regardless of status", () => {
    const asSent = LogSchema.safeParse({
      ...base,
      status: "sent",
      quality_rating: 4,
    });
    const asAttempted = LogSchema.safeParse({
      ...base,
      status: "attempted",
      quality_rating: 4,
    });
    expect(asSent.success).toBe(true);
    expect(asAttempted.success).toBe(true);
  });

  it("rejects difficulty_rating when status is attempted", () => {
    const result = LogSchema.safeParse({
      ...base,
      status: "attempted",
      difficulty_rating: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects fall_hold_id when status is sent", () => {
    const result = LogSchema.safeParse({
      ...base,
      status: "sent",
      fall_hold_id: validFallHoldId,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown status", () => {
    const result = LogSchema.safeParse({ ...base, status: "skipped" });
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid fall_hold_id", () => {
    const result = LogSchema.safeParse({
      ...base,
      status: "attempted",
      fall_hold_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("BookmarkSchema", () => {
  const valid = {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "22222222-2222-4222-8222-222222222222",
    route_id: "33333333-3333-4333-8333-333333333333",
    created_at: "2026-04-20T00:00:00Z",
  };

  it("accepts a well-formed bookmark", () => {
    expect(BookmarkSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects missing user_id", () => {
    const { user_id, ...rest } = valid;
    expect(BookmarkSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects non-uuid route_id", () => {
    expect(
      BookmarkSchema.safeParse({ ...valid, route_id: "nope" }).success,
    ).toBe(false);
  });
});
