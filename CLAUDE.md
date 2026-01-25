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
- **Build**: `eas build --profile preview --platform android`
- **Version**: In `app.json` → `expo.version`
- **CI/CD**: Bump version in app.json → push to main → auto-tags & builds

## Important Notes
- GestureHandlerRootView must wrap the app (in App.tsx)
- react-native-worklets pinned to 0.5.1 for Expo SDK 54 compatibility
- DraggableFlatList inside ScrollView has gesture conflicts (known limitation)
- Commits follow Conventional Commits format
