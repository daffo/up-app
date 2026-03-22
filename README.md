# Upp - Spray Wall Route Manager

A React Native (Expo) app for creating, sharing, and tracking climbing routes on spray walls. Users place holds on wall photos to define routes, log sends with ratings, and leave comments.

## Features

- Interactive route creation by tapping detected holds on wall photos
- ML-powered hold detection (Roboflow) with manual editing
- Full-screen zoomable route viewer and editor
- Send logging with difficulty ratings
- Comments on routes
- User profiles
- Admin tools for managing wall photos and detected holds
- Dark / Light / System theme
- Localization
- Android (Play Store internal testing) and iOS support

## Tech Stack

- **Framework**: React Native with Expo SDK 54 (New Architecture)
- **Language**: TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Navigation**: React Navigation (native stack)
- **Gestures**: react-native-gesture-handler, react-native-reanimated
- **State**: React hooks + custom cache invalidation pattern
- **Validation**: Zod
- **i18n**: i18next + react-i18next
- **Testing**: Jest (unit & contract), Maestro (E2E)

## Prerequisites

- Node.js 18+
- npm
- Expo dev client (not Expo Go — the app uses native modules)
- A Supabase account (free tier works)

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/daffo/up-app.git
cd up-app
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

The Supabase URL and anon key in `.env.example` point to the production instance and are safe to share (security is enforced by Row Level Security). Add your own Roboflow API key for hold detection.

### 3. Database Schema

The database is already configured on the production Supabase instance. To set up your own, run `sql/schema-current.sql` — it contains the complete current schema. Incremental migrations are in `sql/migration-*.sql`.

### 4. Run the App

```bash
npx expo start          # Dev server
npm run android         # Android (requires emulator or device)
npm run ios             # iOS (requires simulator or device)
```

## Project Structure

```
up-app/
├── components/          # Reusable UI components
├── screens/             # Screen components
├── navigation/          # React Navigation setup
├── lib/                 # API layer, auth, supabase client, caching
│   ├── api.ts           # All DB access (cache invalidation, typing)
│   ├── schemas.ts       # Zod schemas for DB tables
│   └── cache/           # Local caching (images, detected holds)
├── hooks/               # Custom hooks
├── utils/               # Helpers (polygon math, date formatting)
├── types/               # TypeScript types
├── locales/             # i18n translations (en.json, it.json)
├── sql/                 # Database schema and migrations
├── scripts/             # Build and utility scripts
├── __tests__/           # Unit, contract, and E2E tests
├── assets/              # Icons, splash screen
├── App.tsx              # Entry point
└── app.json             # Expo config (version: 0.5.4-beta)
```

## Testing

```bash
npm test                  # Unit tests (fast, no network)
npm test -- --watch       # Watch mode
npm run test:coverage     # Coverage report
npm run test:contracts    # Contract tests (requires .env with Supabase creds)
```

### E2E Tests (Maestro)

Requires Maestro CLI, an Android emulator, and the dev server running.

```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"

npm run test:e2e          # Both happy paths
npm run test:e2e:guest    # Guest user flow
npm run test:e2e:auth     # Authenticated user flow
```

## CI/CD

Production releases are handled by GitHub Actions:

1. Bump `version` in `app.json`
2. Commit and push to `main`
3. Push a release tag: `git tag release-v0.5.4-beta && git push origin release-v0.5.4-beta`
4. GitHub Actions builds a production AAB and submits to Play Store internal testing

## License

MIT
