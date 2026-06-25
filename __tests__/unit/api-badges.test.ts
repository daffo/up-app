import { supabase } from "../../lib/supabase";
import { badgesApi, cacheEvents, CACHE_EVENTS } from "../../lib/api";
import { BADGE_PRESENTATION } from "../../lib/badges";
import en from "../../locales/en.json";
import itLocale from "../../locales/it.json";
import type { BadgeKey } from "../../types/database.types";

jest.mock("../../lib/supabase", () => ({
  supabase: { from: jest.fn() },
}));

// api.ts transitively imports the detected-holds cache (AsyncStorage-backed);
// mock it out so the suite doesn't need a native AsyncStorage module.
jest.mock("../../lib/cache/detected-holds-cache", () => ({
  getCachedHolds: jest.fn().mockResolvedValue(null),
  getCachedHoldsAnyVersion: jest.fn().mockResolvedValue(null),
  getCachedVersion: jest.fn().mockResolvedValue(null),
  setCachedHolds: jest.fn().mockResolvedValue(undefined),
  invalidateHoldsCache: jest.fn().mockResolvedValue(undefined),
}));

const mockFrom = supabase.from as jest.Mock;

function createBuilder(resolvedValue: { data: any; error: any }) {
  const builder: any = {};
  const methods = ["select", "eq", "in", "order", "update"];
  for (const m of methods) {
    builder[m] = jest.fn().mockReturnValue(builder);
  }
  builder.then = (resolve: any) => resolve(resolvedValue);
  return builder;
}

const ALL_KEYS: BadgeKey[] = [
  "first_send",
  "sends_10",
  "sends_25",
  "sends_50",
  "sends_100",
  "first_attempt",
  "comeback",
  "first_route",
  "routes_10",
  "first_comment",
  "route_sent_by_other",
];

afterEach(() => {
  jest.restoreAllMocks();
});

describe("badgesApi.catalog", () => {
  it("fetches and orders the catalog", async () => {
    const rows = [{ key: "first_send", category: "send", threshold: 1 }];
    const builder = createBuilder({ data: rows, error: null });
    mockFrom.mockReturnValue(builder);

    const result = await badgesApi.catalog();

    expect(mockFrom).toHaveBeenCalledWith("badges");
    expect(builder.order).toHaveBeenCalledWith("sort_order", {
      ascending: true,
    });
    expect(result).toEqual(rows);
  });

  it("caches the catalog across calls (single fetch)", async () => {
    const builder = createBuilder({ data: [{ key: "x" }], error: null });
    mockFrom.mockReturnValue(builder);

    // First call already cached the catalog in the previous test, so this
    // call must not hit the network again.
    const before = mockFrom.mock.calls.length;
    await badgesApi.catalog();
    await badgesApi.catalog();
    expect(mockFrom.mock.calls.length).toBe(before);
  });
});

describe("badgesApi.listForUser", () => {
  it("queries user_badges by user", async () => {
    const rows = [{ user_id: "u1", badge_key: "first_send" }];
    const builder = createBuilder({ data: rows, error: null });
    mockFrom.mockReturnValue(builder);

    const result = await badgesApi.listForUser("u1");

    expect(mockFrom).toHaveBeenCalledWith("user_badges");
    expect(builder.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(result).toEqual(rows);
  });

  it("throws on error", async () => {
    const builder = createBuilder({ data: null, error: { message: "boom" } });
    mockFrom.mockReturnValue(builder);
    await expect(badgesApi.listForUser("u1")).rejects.toEqual({
      message: "boom",
    });
  });
});

describe("badgesApi.listUnseen", () => {
  it("filters by user and seen=false", async () => {
    const builder = createBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    await badgesApi.listUnseen("u1");

    expect(builder.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(builder.eq).toHaveBeenCalledWith("seen", false);
  });
});

describe("badgesApi.markSeen", () => {
  it("updates seen=true for the given keys", async () => {
    const builder = createBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await badgesApi.markSeen("u1", ["first_send", "sends_10"]);

    expect(builder.update).toHaveBeenCalledWith({ seen: true });
    expect(builder.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(builder.in).toHaveBeenCalledWith("badge_key", [
      "first_send",
      "sends_10",
    ]);
  });

  it("no-ops on empty keys (no network call)", async () => {
    const before = mockFrom.mock.calls.length;
    await badgesApi.markSeen("u1", []);
    expect(mockFrom.mock.calls.length).toBe(before);
  });
});

describe("BADGES cache event", () => {
  it("notifies subscribers on invalidate", () => {
    const listener = jest.fn();
    const unsub = cacheEvents.subscribe(CACHE_EVENTS.BADGES, listener);
    cacheEvents.invalidate(CACHE_EVENTS.BADGES);
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });
});

describe("badge presentation + i18n completeness", () => {
  it("every badge key has a presentation entry", () => {
    ALL_KEYS.forEach((key) => {
      expect(BADGE_PRESENTATION[key]).toBeDefined();
      expect(BADGE_PRESENTATION[key].icon).toBeTruthy();
      expect(BADGE_PRESENTATION[key].color).toMatch(/^#/);
    });
  });

  it("presentation map has no extra keys", () => {
    expect(Object.keys(BADGE_PRESENTATION).sort()).toEqual(
      [...ALL_KEYS].sort(),
    );
  });

  it("every badge key has EN name + desc", () => {
    ALL_KEYS.forEach((key) => {
      expect((en.badges as any)[key]?.name).toBeTruthy();
      expect((en.badges as any)[key]?.desc).toBeTruthy();
    });
  });

  it("every badge key has IT name + desc", () => {
    ALL_KEYS.forEach((key) => {
      expect((itLocale.badges as any)[key]?.name).toBeTruthy();
      expect((itLocale.badges as any)[key]?.desc).toBeTruthy();
    });
  });
});
