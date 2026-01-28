# UP App - Claude Context

## Overview
A React Native (Expo) climbing route management app for spray walls. Users can create, view, and edit climbing routes by placing holds on wall photos.

## Tech Stack
- **Framework**: React Native with Expo SDK 54
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Navigation**: React Navigation
- **State**: React hooks + custom cache invalidation pattern
- **Gestures**: react-native-gesture-handler, react-native-reanimated, react-native-draggable-flatlist

## Key Patterns

### Cache Invalidation (lib/api.ts)
```typescript
// Queries subscribe to events
cacheEvents.subscribe('routes', fetchRoutes);

// Mutations invalidate
cacheEvents.invalidate('routes');
```

### Hold System
- `DetectedHold`: ML-detected holds with polygon coordinates (percentage-based)
- `Hold`: User-placed holds in a route, referencing detected_hold_id
- Same hold can be used multiple times in a route

### Full Screen Editors
- `FullScreenImageBase`: Shared base component for image viewing with zoom
- `FullScreenRouteEditor`: For editing routes (add/remove/reorder holds)
- `FullScreenHoldEditor`: Admin tool for editing detected hold shapes

## Project Structure
```
/components     - Reusable UI components
/screens        - Screen components
/lib            - API, auth, supabase client
/hooks          - Custom hooks (useDragDelta)
/utils          - Helpers (polygon math)
/types          - TypeScript types
/navigation     - React Navigation setup
```

## Database Schema

### SQL Files (`/sql`)
```
migration-000-initial.sql    - Initial schema (admins, photos, routes with coordinates)
migration-001-update-holds.sql - Replace coordinates with holds JSONB
migration-002-detected-holds.sql - Add detected_holds table
migration-003-user-profiles.sql  - Add user_profiles table
migration-004-sends-comments.sql - Add sends and comments tables
schema-current.sql           - Complete schema (run on fresh DB)
```

### Fresh Setup
To set up a new Supabase project, run `schema-current.sql` - it contains the complete current schema in one file.

### Tables
- `admins` - Users with photo management permissions
- `photos` - Wall photos with setup/teardown dates
- `detected_holds` - Hold polygons detected on photos
- `routes` - Climbing routes with hold references
- `user_profiles` - Display names and settings
- `sends` - Route completions with ratings
- `comments` - User comments on routes

## Build & Deploy
- **Dev**: `npx expo start`
- **Version**: In `app.json` → `expo.version`

### Triggering a Build
To trigger a CI build:
1. Bump version in `app.json` (e.g., `0.1.2-alpha` → `0.1.3-alpha`)
2. Commit and push to `main`
3. GitHub Actions will auto-tag and run `eas build --profile preview --platform android`

**Note**: The workflow only triggers when `app.json` changes AND the version number is different from the previous commit.

## Important Notes
- GestureHandlerRootView must wrap the app (in App.tsx)
- react-native-worklets pinned to 0.5.1 for Expo SDK 54 compatibility
- DraggableFlatList inside ScrollView has gesture conflicts (known limitation)
- Commits follow Conventional Commits format

## Testing Strategy

### Principles
- All utility functions (`/utils`) must have unit tests
- API layer logic (cache invalidation) must have unit tests
- API layer tests verify contracts with Supabase DB
- E2E tests cover critical user flows (skip component tests - E2E provides more value)

### Test Structure
```
/__tests__
  /unit           - Pure function tests (utils, cache logic)
  /contracts      - DB contract tests (real Supabase + Zod validation)
  /e2e            - End-to-end flows
/lib
  /schemas.ts     - Zod schemas for all DB tables
```

### Unit Tests (Jest)
- `utils/polygon.ts` - isPointInPolygon, calculatePolygonArea, findPolygonsAtPoint
- `utils/date.ts` - formatDate, formatRelativeDate
- `lib/api.ts` - cacheEvents subscribe/invalidate pattern

### Contract Tests (Jest + Zod + Real Supabase)
- Validates real DB responses match expected Zod schemas
- Catches schema drift (renamed fields, type changes, etc.)
- Tests all tables: routes, photos, detected_holds, sends, comments, user_profiles, admins
- Tests API query patterns (joins, aggregations)

### E2E Tests (TBD)
- Auth flow (login → home with user context)
- Route creation (photo → holds → save)
- Send flow (mark route as sent with ratings)

### Running Tests
```bash
npm test              # Unit tests only (fast, no network)
npm test -- --watch   # Watch mode
npm run test:contracts # Contract tests (requires .env with Supabase credentials)
npm run test:coverage  # Coverage report
```
