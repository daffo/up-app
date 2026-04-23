import { supabase } from "./setup";
import {
  schemas,
  TableName,
  RouteSchema,
  DetectedHoldSchema,
  PhotoSchema,
  CommentSchema,
  UserProfileSchema,
  LogSchema,
  BookmarkSchema,
} from "../../lib/schemas";

// Contract tests verify the real database returns expected shapes
// Run with: npm run test:contracts

describe("Database Contract Tests", () => {
  // Helper to test a table's schema
  async function testTableContract(tableName: TableName) {
    const { data, error } = await supabase.from(tableName).select("*").limit(1);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    if (data && data.length > 0) {
      const schema = schemas[tableName];
      const result = schema.safeParse(data[0]);

      if (!result.success) {
        console.error(
          `Schema validation failed for ${tableName}:`,
          result.error.format(),
        );
      }

      expect(result.success).toBe(true);
    }
  }

  describe("photos table", () => {
    it("returns data matching PhotoSchema", async () => {
      await testTableContract("photos");
    });
  });

  describe("routes table", () => {
    it("returns data matching RouteSchema", async () => {
      await testTableContract("routes");
    });

    it("returns holds as object with hand_holds and foot_holds", async () => {
      const { data, error } = await supabase
        .from("routes")
        .select("holds")
        .limit(1);

      expect(error).toBeNull();

      if (data && data.length > 0) {
        expect(data[0].holds).toHaveProperty("hand_holds");
        expect(data[0].holds).toHaveProperty("foot_holds");
        expect(Array.isArray(data[0].holds.hand_holds)).toBe(true);
        expect(Array.isArray(data[0].holds.foot_holds)).toBe(true);

        if (data[0].holds.hand_holds.length > 0) {
          const hold = data[0].holds.hand_holds[0];
          expect(hold).toHaveProperty("order");
          expect(hold).toHaveProperty("detected_hold_id");
          expect(hold).toHaveProperty("labelX");
          expect(hold).toHaveProperty("labelY");
        }
      }
    });
  });

  describe("detected_holds table", () => {
    it("returns data matching DetectedHoldSchema", async () => {
      await testTableContract("detected_holds");
    });

    it("returns polygon as array of points", async () => {
      const { data, error } = await supabase
        .from("detected_holds")
        .select("polygon, center")
        .limit(1);

      expect(error).toBeNull();

      if (data && data.length > 0) {
        // Polygon should be array of {x, y}
        expect(Array.isArray(data[0].polygon)).toBe(true);
        if (data[0].polygon.length > 0) {
          expect(data[0].polygon[0]).toHaveProperty("x");
          expect(data[0].polygon[0]).toHaveProperty("y");
        }

        // Center should be {x, y}
        expect(data[0].center).toHaveProperty("x");
        expect(data[0].center).toHaveProperty("y");
      }
    });
  });

  describe("user_profiles table", () => {
    it("returns data matching UserProfileSchema", async () => {
      await testTableContract("user_profiles");
    });
  });

  describe("logs table", () => {
    it("returns data matching LogSchema", async () => {
      await testTableContract("logs");
    });

    it("enforces status CHECK constraint", async () => {
      const { data, error } = await supabase
        .from("logs")
        .select("status")
        .limit(20);

      expect(error).toBeNull();
      if (data) {
        for (const row of data) {
          expect(["sent", "attempted"]).toContain(row.status);
        }
      }
    });
  });

  describe("bookmarks table", () => {
    it("returns data matching BookmarkSchema", async () => {
      await testTableContract("bookmarks");
    });
  });

  describe("comments table", () => {
    it("returns data matching CommentSchema", async () => {
      await testTableContract("comments");
    });
  });

  describe("admins table", () => {
    it("returns data matching AdminSchema", async () => {
      await testTableContract("admins");
    });
  });

  // Test relationships/joins match expected structure
  describe("API query contracts", () => {
    it("routes with photo join returns expected shape", async () => {
      const { data, error } = await supabase
        .from("routes")
        .select("*, photo:photos(*)")
        .limit(1);

      expect(error).toBeNull();

      if (data && data.length > 0) {
        // Route fields
        const routeResult = RouteSchema.safeParse(data[0]);
        if (!routeResult.success) {
          console.error("Route validation failed:", routeResult.error.format());
        }
        expect(routeResult.success).toBe(true);

        // Joined photo
        if (data[0].photo) {
          const photoResult = PhotoSchema.safeParse(data[0].photo);
          expect(photoResult.success).toBe(true);
        }
      }
    });

    it("routes with computed avg_rating, send_count, attempt_count returns expected shape", async () => {
      const { data, error } = await supabase
        .from("routes")
        .select("*, avg_rating, send_count, attempt_count")
        .limit(1);

      expect(error).toBeNull();

      if (data && data.length > 0) {
        // avg_rating is null when no logs with ratings, or a number
        expect(
          data[0].avg_rating === null || typeof data[0].avg_rating === "number",
        ).toBe(true);
        expect(typeof data[0].send_count).toBe("number");
        expect(typeof data[0].attempt_count).toBe("number");
      }
    });

    it("logs with route join returns expected shape", async () => {
      const { data, error } = await supabase
        .from("logs")
        .select("*, route:routes(id, title, grade)")
        .limit(1);

      expect(error).toBeNull();

      if (data && data.length > 0 && data[0].route) {
        expect(data[0].route).toHaveProperty("id");
        expect(data[0].route).toHaveProperty("title");
        expect(data[0].route).toHaveProperty("grade");
      }
    });

    it("comments with route join returns expected shape", async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, route:routes(id, title, grade)")
        .limit(1);

      expect(error).toBeNull();

      if (data && data.length > 0 && data[0].route) {
        expect(data[0].route).toHaveProperty("id");
        expect(data[0].route).toHaveProperty("title");
        expect(data[0].route).toHaveProperty("grade");
      }
    });
  });
});
