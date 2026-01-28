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
  /api            - API layer contract tests (mocked Supabase)
  /e2e            - End-to-end flows
```

### Unit Tests (Jest)
- `utils/polygon.ts` - isPointInPolygon, calculatePolygonArea, findPolygonsAtPoint
- `utils/date.ts` - formatDate, formatRelativeDate
- `lib/api.ts` - cacheEvents subscribe/invalidate pattern

### API Layer Tests (Jest + Supabase mock)
- Verify correct Supabase queries are made
- Verify cache invalidation triggers on mutations
- Verify error handling

### E2E Tests (TBD - discuss DB mock strategy)
- Auth flow (login → home with user context)
- Route creation (photo → holds → save)
- Send flow (mark route as sent with ratings)

### Running Tests
```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
```
