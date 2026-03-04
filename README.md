# GymTracker

GymTracker is an Expo React Native iOS app with a TypeScript backend server.

## Project Structure

- `mobile` - Expo React Native app (TypeScript)
- `backend` - Express backend (TypeScript)
- `PROJECT_PROGRESS.md` - requirements and progress tracker

## Prerequisites

- Node.js 20+
- npm

## Setup

### 1) Backend

1. Create environment file:
   - Copy `backend/.env.example` to `backend/.env`
2. Configure database:
   - Ensure PostgreSQL is running locally
   - Set `DATABASE_URL=postgres://postgres:postgres@localhost:5432/gymtracker` (or your own URL)
3. Optionally configure AI provider:
   - `LLM_PROVIDER=kimi` or `LLM_PROVIDER=gemini` or `LLM_PROVIDER=vertex`
   - For Kimi: `KIMI_API_KEY=...`
   - For Gemini: `GEMINI_API_KEY=...`
   - For Vertex AI (Google Cloud): `VERTEX_API_KEY=...`
   - Without the selected provider key, advice/food endpoints use fallback mode.
4. Configure auth:
   - `SUPABASE_URL=...`
   - `SUPABASE_JWT_AUDIENCE=authenticated` (default is already `authenticated`)
5. Run migrations:
   - `npm --prefix backend run migrate`
   - This now syncs `exercise_items` from `free-exercise-db` and updates stale legacy rows.
6. (Optional) Refresh exercise dataset and local image cache:
   - `npm --prefix backend run exercise-db:refresh`
7. Start backend:
   - Dev mode (recommended): `npm --prefix backend run dev`
   - Prod-like local mode (runs migrate then starts compiled server): `npm --prefix backend run start:with-migrate`
   - Root shortcut: `npm run backend` (starts `node dist/server.js`)

The backend runs on `http://localhost:4000` by default.

Backend run mode notes:

- `npm run backend` uses compiled output (`dist/server.js`).
- If you changed `backend/src/*` and use `npm run backend`, rebuild first:
  - `npm --prefix backend run build`
- To avoid stale build issues during development, prefer `npm --prefix backend run dev`.

### 2) Mobile

1. Start mobile app:
   - Create `mobile/.env` from `mobile/.env.example` and set:
     - `EXPO_PUBLIC_SUPABASE_URL=...`
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY=...`
     - `EXPO_PUBLIC_BACKEND_URL=http://localhost:4000` (local) or your deployed backend URL
   - Start Metro: `npm run mobile`
2. iOS simulator (development build):
   - Install/update dev build on simulator: `npm --prefix mobile run ios`
   - If CLI shows `No development build (...) is installed`, run the command above again.
   - After install, keep Metro running (`npm run mobile`) and press `i`.

If running on a physical device, update backend URL in the app UI from `localhost` to your machine LAN IP.

## Deploy Backend on Render (Supabase Postgres)

### Prerequisites

- A GitHub repo connected to Render.
- A Supabase project with Postgres and Auth configured.
- Backend code merged to the branch you will deploy.

### 1) Prepare production configuration

1. Ensure `backend/.env` is not committed and secrets are only stored in Render environment variables.
2. Rotate any exposed API keys before production rollout.
3. Ensure only authenticated endpoints are exposed in production.

### 2) Create the Render web service

1. In Render, create a new **Web Service** from your GitHub repository.
2. Set:
   - Root directory: `backend`
   - Build command: `npm ci && npm run build`
   - Pre-deploy command: `npm run migrate`
   - Start command: `npm run start`
   - Health check path: `/health`

### 3) Configure Render environment variables

Set these variables in Render:

- `NODE_ENV=production`
- `DATABASE_URL=<supabase-postgres-connection-string>`
- `SUPABASE_URL=<your-supabase-project-url>`
- `SUPABASE_JWT_AUDIENCE=authenticated`
- `LLM_PROVIDER=<kimi-or-gemini-or-vertex>`
- `KIMI_API_KEY=<optional-if-LLM_PROVIDER-kimi>`
- `GEMINI_API_KEY=<optional-if-LLM_PROVIDER-gemini>`
- `VERTEX_API_KEY=<optional-if-LLM_PROVIDER-vertex>`
- `ALLOWED_ORIGINS=<comma-separated-origins-that-can-call-your-api>`
- `TRUST_PROXY=true`

Notes:

- Render provides `PORT`; the backend already reads it.
- If Supabase requires SSL params in your connection string, include them in `DATABASE_URL`.

### 4) Deploy and verify

1. Trigger the initial Render deploy.
2. Confirm the service is healthy at `GET /health`.
3. Verify one authenticated endpoint such as `GET /me` with a valid Supabase JWT.
4. Verify one DB-backed endpoint such as `GET /records?...` to confirm database connectivity.

### 5) Point mobile app to production backend

1. In `mobile/.env`, set:
   - `EXPO_PUBLIC_BACKEND_URL=https://<your-render-service>.onrender.com`
2. Restart Expo so the updated env var is loaded.
3. Validate record, exercise, food, and advice flows from the mobile app.

## Available APIs

- `GET /me`
- `GET /me/profile`
- `PUT /me/profile`
- `GET /exercise-items`
- `GET /records?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /records/by-date?date=YYYY-MM-DD`
- `GET /records/:recordId`
- `POST /records/by-date/exercises`
- `POST /records/:recordId/exercises`
- `GET /exercises/:exerciseId`
- `PATCH /exercises/:exerciseId`
- `DELETE /exercises/:exerciseId`
- `POST /exercises/:exerciseId/sets`
- `PATCH /exercise-sets/:setId`
- `DELETE /exercise-sets/:setId`
- `POST /advice/exercise-plan`
- `GET /records/by-date/food?date=YYYY-MM-DD`
- `POST /records/by-date/food`
- `DELETE /food-consumptions/:foodConsumptionId`
