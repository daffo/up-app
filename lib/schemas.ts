import { z } from 'zod';

// Reusable schemas
const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

// Hold schema (embedded in routes)
export const HoldSchema = z.object({
  order: z.number(),
  detected_hold_id: z.string(),
  labelX: z.number(),
  labelY: z.number(),
  note: z.string().optional(),
});

// Table schemas - matching Database['public']['Tables'][table]['Row']
export const AdminSchema = z.object({
  user_id: z.string().uuid(),
  created_at: z.string(),
});

export const DetectedHoldSchema = z.object({
  id: z.string().uuid(),
  photo_id: z.string().uuid(),
  polygon: z.array(PointSchema),
  center: PointSchema,
  dominant_color: z.string().nullable(),
  created_at: z.string(),
});

export const PhotoSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  image_url: z.string().url(),
  setup_date: z.string().nullable(),
  teardown_date: z.string().nullable(),
  user_id: z.string().uuid(),
});

export const RouteSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  grade: z.string(),
  photo_id: z.string().uuid(),
  holds: z.array(HoldSchema),
  user_id: z.string().uuid(),
});

export const UserProfileSchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const SendSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  route_id: z.string().uuid(),
  quality_rating: z.number().nullable(),
  difficulty_rating: z.number().nullable(),
  sent_at: z.string(),
  created_at: z.string(),
});

export const CommentSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  route_id: z.string().uuid(),
  text: z.string(),
  created_at: z.string(),
});

// Export all schemas as a map for dynamic access
export const schemas = {
  admins: AdminSchema,
  detected_holds: DetectedHoldSchema,
  photos: PhotoSchema,
  routes: RouteSchema,
  user_profiles: UserProfileSchema,
  sends: SendSchema,
  comments: CommentSchema,
} as const;

export type TableName = keyof typeof schemas;
