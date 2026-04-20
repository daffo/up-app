import { z } from "zod";

// Reusable schemas
const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

// Hold schemas (embedded in routes)
const HoldSchema = z.object({
  detected_hold_id: z.string(),
  labelX: z.number(),
  labelY: z.number(),
  note: z.string().optional(),
});

export const HandHoldSchema = HoldSchema.extend({
  order: z.number(),
});

export const FootHoldSchema = HoldSchema;

export const RouteHoldsSchema = z.object({
  hand_holds: z.array(HandHoldSchema),
  foot_holds: z.array(FootHoldSchema),
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
  holds_version: z.number().int(),
});

export const RouteSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  grade: z.string(),
  photo_id: z.string().uuid(),
  holds: RouteHoldsSchema,
  user_id: z.string().uuid(),
  is_draft: z.boolean(),
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

export const LogStatusSchema = z.enum(["sent", "attempted"]);

export const LogSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    route_id: z.string().uuid(),
    status: LogStatusSchema,
    quality_rating: z.number().nullable(),
    difficulty_rating: z.number().nullable(),
    fall_hold_id: z.string().uuid().nullable(),
    logged_at: z.string(),
    created_at: z.string(),
  })
  .refine((l) => l.status === "sent" || l.difficulty_rating === null, {
    message: "difficulty_rating only allowed when status=sent",
  })
  .refine((l) => l.status === "attempted" || l.fall_hold_id === null, {
    message: "fall_hold_id only allowed when status=attempted",
  });

export const BookmarkSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  route_id: z.string().uuid(),
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
  logs: LogSchema,
  bookmarks: BookmarkSchema,
  comments: CommentSchema,
} as const;

export type TableName = keyof typeof schemas;
