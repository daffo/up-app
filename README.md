# Up App - Climbing Gym Route Tracker

A mobile app for tracking new boulders and lead routes at your local climbing gym.

## Features

- 📋 List boulders and lead routes
- 📸 Photo uploads for each route
- 📝 Short descriptions and grades
- 🔐 User authentication
- 📱 iOS & Android support

## Tech Stack

- **Frontend**: Expo (React Native) with TypeScript
- **Backend**: Supabase (Database, Auth, Storage)
- **State Management**: React hooks

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo Go app (for testing on your phone)
- A Supabase account (free tier)

## Setup Instructions

### 1. Clone and Install

```bash
git clone https://github.com/daffo/up-app.git
cd up-app
npm install
```

### 2. Configure Environment Variables

The app is pre-configured to use the production Supabase instance. Just copy the example file:

```bash
cp .env.example .env
```

**Note:** The Supabase credentials in `.env.example` are public (anon key) and safe to share. Security is enforced by Row Level Security policies in the database.

### 3. Set Up Database Schema

The database is already configured. If you want to set up your own Supabase instance, see `supabase-setup.sql` for the complete schema.

### 4. Set Up Storage (for photos)

1. Go to Storage in your Supabase dashboard
2. Create a new bucket called `spray-wall-photos`
3. Make it public (or configure policies as needed)

### 5. Run the App

```bash
# Start the development server
npm start

# Or directly run on:
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web browser
```

Scan the QR code with Expo Go app on your phone to test.

## Project Structure

```
up-app/
├── lib/              # Shared utilities and clients
│   └── supabase.ts   # Supabase client configuration
├── types/            # TypeScript type definitions
│   └── database.types.ts
├── App.tsx           # Main app entry point
└── package.json
```

## Next Steps

- [ ] Add navigation (React Navigation)
- [ ] Create auth screens (login/signup)
- [ ] Build route list screen
- [ ] Create route detail screen
- [ ] Add photo upload functionality
- [ ] Implement filtering by type (boulder/lead)

## Deployment

When ready to deploy:

1. Build for production: `eas build`
2. Submit to app stores: `eas submit`

See [Expo EAS docs](https://docs.expo.dev/eas/) for detailed deployment instructions.

## License

MIT
