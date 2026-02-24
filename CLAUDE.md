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

### Theming (lib/theme-context.tsx)
The app supports Light, Dark, and System (follows device) themes. Preference is persisted in AsyncStorage (`@app_theme`).

```typescript
// In components/screens - get themed colors:
const colors = useThemeColors();

// Apply via style array pattern (structural styles stay static, colors are dynamic):
<View style={[styles.container, { backgroundColor: colors.screenBackground }]}>
<Text style={[styles.title, { color: colors.textPrimary }]}>

// For full context (preference, isDark, setter) - used in settings UI:
const { themePreference, isDark, colors, setThemePreference } = useTheme();

// For TextInputs - always set placeholderTextColor explicitly:
<TextInput placeholderTextColor={colors.placeholderText} />
```

**Semantic color tokens**: `screenBackground`, `cardBackground`, `inputBackground`, `textPrimary`, `textSecondary`, `textTertiary`, `textOnPrimary`, `border`, `borderLight`, `separator`, `primary`, `primaryLight`, `primaryLightAlt`, `danger`, `star`, `cancelButton`, `disabledButton`, `placeholderText`, `chevron`, `shadowColor`

**Theme exceptions** (keep hardcoded dark colors, do NOT use theme):
- `FullScreenImageBase`, `FullScreenRouteEditor`, `FullScreenHoldEditor`, `FullScreenRouteViewer` - image viewers with black backgrounds
- `DragModeButtons`, `RouteOverlay` - render on top of images with rgba() colors
- `RouteVisualization` - container bg follows theme, but overlays/image rendering stay static

**Auth styles** use a hook pattern: `const { styles, colors } = useAuthStyles()` from `components/auth/authStyles.ts`

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

### CI/CD Workflow

**Production Release (to Play Store internal testing):**
1. Bump version in `app.json` (e.g., `0.1.2-alpha` → `0.1.3-alpha`)
2. Commit and push to `main`
3. Push a release tag:
   ```bash
   git tag release-v0.1.3-alpha && git push origin release-v0.1.3-alpha
   ```
4. GitHub Actions builds **production AAB** and submits to Play Store internal testing track

**Required GitHub Secrets** (Settings → Secrets → Actions):
- `EXPO_TOKEN` - Expo access token for EAS CLI
- `GOOGLE_SERVICE_ACCOUNT_KEY` - Google Play Service Account JSON (full file contents)

**Note**: EAS environment variables don't work from GitHub Actions. Use GitHub secrets instead.

## Important Notes
- GestureHandlerRootView must wrap the app (in App.tsx)
- react-native-worklets pinned to 0.5.1 for Expo SDK 54 compatibility
- DraggableFlatList inside ScrollView has gesture conflicts (known limitation)
- Commits follow Conventional Commits format
- **All user-facing text must be localized** - use `t('key')` from `useTranslation()`, including accessibility labels. Add keys to both `locales/en.json` and `locales/it.json`
- **All colors must use theme tokens** - use `useThemeColors()` from `lib/theme-context.tsx`, never hardcode colors in themed screens/components. Exception: fullscreen image editors and overlays (see theme exceptions above)

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
  /e2e            - E2E tests (Maestro)
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

### E2E Tests (Maestro)
Comprehensive happy path tests covering all features for both user types:

- `guest-happy-path.yaml` - Full guest user flow:
  - Browse routes, view route details
  - View comments and sends list
  - Tap creator to view profile
  - Try auth-required action → redirects to login

- `auth-happy-path.yaml` - Full authenticated user flow:
  - Login, browse and view routes
  - Log a send with rating
  - Add and delete a comment
  - View My Sends, My Comments, My Account
  - Cleanup (remove send/comment) and logout

**Shared flows:**
- `shared/setup.yaml` - Common setup (clearState, launch, handle dev client)
- `auth-login.yaml` - Reusable login flow (used by auth-happy-path)

**Test User:** `e2e-test@up-app.test` / `TestPass123!` (created in Supabase Auth, auto-confirmed)

### Running Tests
```bash
npm test              # Unit tests only (fast, no network)
npm test -- --watch   # Watch mode
npm run test:contracts # Contract tests (requires .env)
npm run test:coverage  # Coverage report

# E2E (requires Maestro CLI + Android emulator + dev server running)
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"

npm run test:e2e       # Both happy paths
npm run test:e2e:guest # Guest user flow only
npm run test:e2e:auth  # Auth user flow only
```

**Note:** Maestro does NOT inherit shell env vars. The `test:e2e:auth` script sources `.env` and passes credentials via `-e` flags automatically.
