import { supabase } from './setup';
import {
  schemas,
  TableName,
  RouteSchema,
  DetectedHoldSchema,
  PhotoSchema,
  SendSchema,
  CommentSchema,
  UserProfileSchema,
} from '../../lib/schemas';

// Contract tests verify the real database returns expected shapes
// Run with: npm run test:contracts

describe('Database Contract Tests', () => {
  // Helper to test a table's schema
  async function testTableContract(tableName: TableName) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    if (data && data.length > 0) {
      const schema = schemas[tableName];
      const result = schema.safeParse(data[0]);

      if (!result.success) {
        console.error(`Schema validation failed for ${tableName}:`, result.error.format());
      }

      expect(result.success).toBe(true);
    }
  }

  describe('photos table', () => {
    it('returns data matching PhotoSchema', async () => {
      await testTableContract('photos');
    });
  });

  describe('routes table', () => {
    it('returns data matching RouteSchema', async () => {
      await testTableContract('routes');
    });

    it('returns holds as array with correct structure', async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('holds')
        .limit(1);

      expect(error).toBeNull();

      if (data && data.length > 0 && data[0].holds.length > 0) {
        const hold = data[0].holds[0];
        expect(hold).toHaveProperty('order');
        expect(hold).toHaveProperty('detected_hold_id');
        expect(hold).toHaveProperty('labelX');
        expect(hold).toHaveProperty('labelY');
      }
    });
  });

  describe('detected_holds table', () => {
    it('returns data matching DetectedHoldSchema', async () => {
      await testTableContract('detected_holds');
    });

    it('returns polygon as array of points', async () => {
      const { data, error } = await supabase
        .from('detected_holds')
        .select('polygon, center')
        .limit(1);

      expect(error).toBeNull();

      if (data && data.length > 0) {
        // Polygon should be array of {x, y}
        expect(Array.isArray(data[0].polygon)).toBe(true);
        if (data[0].polygon.length > 0) {
          expect(data[0].polygon[0]).toHaveProperty('x');
          expect(data[0].polygon[0]).toHaveProperty('y');
        }

        // Center should be {x, y}
        expect(data[0].center).toHaveProperty('x');
        expect(data[0].center).toHaveProperty('y');
      }
    });
  });

  describe('user_profiles table', () => {
    it('returns data matching UserProfileSchema', async () => {
      await testTableContract('user_profiles');
    });
  });

  describe('sends table', () => {
    it('returns data matching SendSchema', async () => {
      await testTableContract('sends');
    });

    it('allows nullable ratings', async () => {
      const { data, error } = await supabase
        .from('sends')
        .select('quality_rating, difficulty_rating')
        .limit(5);

      expect(error).toBeNull();
      // Just verify the query works - ratings can be null or number
    });
  });

  describe('comments table', () => {
    it('returns data matching CommentSchema', async () => {
      await testTableContract('comments');
    });
  });

  describe('admins table', () => {
    it('returns data matching AdminSchema', async () => {
      await testTableContract('admins');
    });
  });

  // Test relationships/joins match expected structure
  describe('API query contracts', () => {
    it('routes with photo join returns expected shape', async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*, photo:photos(*)')
        .limit(1);

      expect(error).toBeNull();

      if (data && data.length > 0) {
        // Route fields
        const routeResult = RouteSchema.safeParse(data[0]);
        if (!routeResult.success) {
          console.error('Route validation failed:', routeResult.error.format());
        }
        expect(routeResult.success).toBe(true);

        // Joined photo
        if (data[0].photo) {
          const photoResult = PhotoSchema.safeParse(data[0].photo);
          expect(photoResult.success).toBe(true);
        }
      }
    });

    it('routes with sends aggregation returns expected shape', async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*, sends(quality_rating)')
        .limit(1);

      expect(error).toBeNull();

      if (data && data.length > 0) {
        expect(Array.isArray(data[0].sends)).toBe(true);
      }
    });

    it('sends with route join returns expected shape', async () => {
      const { data, error } = await supabase
        .from('sends')
        .select('*, route:routes(id, title, grade)')
        .limit(1);

      expect(error).toBeNull();

      if (data && data.length > 0 && data[0].route) {
        expect(data[0].route).toHaveProperty('id');
        expect(data[0].route).toHaveProperty('title');
        expect(data[0].route).toHaveProperty('grade');
      }
    });

    it('comments with route join returns expected shape', async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, route:routes(id, title, grade)')
        .limit(1);

      expect(error).toBeNull();

      if (data && data.length > 0 && data[0].route) {
        expect(data[0].route).toHaveProperty('id');
        expect(data[0].route).toHaveProperty('title');
        expect(data[0].route).toHaveProperty('grade');
      }
    });
  });
});
