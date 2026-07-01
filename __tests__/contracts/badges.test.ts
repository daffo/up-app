import { supabase } from "./setup";
import { BadgeSchema, UserBadgeSchema } from "../../lib/schemas";

// Contract tests verify the real database returns expected shapes and that
// RLS protects the server-authoritative awarding flow.
// Run with: npm run test:contracts
//
// The shared client uses the anon key (unauthenticated), so auth.uid() is null.

describe("Badges Contract Tests", () => {
  describe("badges catalog table", () => {
    it("is publicly readable and matches BadgeSchema", async () => {
      const { data, error } = await supabase.from("badges").select("*");

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data?.length ?? 0).toBeGreaterThan(0);

      for (const row of data ?? []) {
        const result = BadgeSchema.safeParse(row);
        if (!result.success) {
          console.error("Badge validation failed:", result.error.format());
        }
        expect(result.success).toBe(true);
      }
    });

    it("seeds the full catalog of 16 badges", async () => {
      const { data, error } = await supabase.from("badges").select("key");
      expect(error).toBeNull();
      const keys = (data ?? []).map((r) => r.key).sort();
      expect(keys).toEqual(
        [
          "comeback",
          "first_attempt",
          "first_comment",
          "first_route",
          "first_send",
          "grade_5",
          "grade_6",
          "grade_7",
          "grade_8",
          "route_sent_by_other",
          "routes_10",
          "sadist",
          "sends_10",
          "sends_100",
          "sends_25",
          "sends_50",
        ].sort(),
      );
    });
  });

  describe("user_badges table", () => {
    it("is publicly readable and matches UserBadgeSchema", async () => {
      const { data, error } = await supabase
        .from("user_badges")
        .select("*")
        .limit(1);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);

      if (data && data.length > 0) {
        const result = UserBadgeSchema.safeParse(data[0]);
        if (!result.success) {
          console.error("UserBadge validation failed:", result.error.format());
        }
        expect(result.success).toBe(true);
      }
    });

    it("blocks self-insert (awarding is server-authoritative)", async () => {
      const { error } = await supabase.from("user_badges").insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        badge_key: "first_send",
      });

      // RLS has no INSERT policy -> the write is rejected.
      expect(error).not.toBeNull();
    });
  });
});
