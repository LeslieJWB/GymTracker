# GymTracker iOS App - Requirements and Progress

## Project Overview

GymTracker is an iOS fitness tracking app built with React Native and TypeScript using Expo.

The app allows users to:
- Track workout history by date
- Log exercise details (weight, sets, reps)
- View past training records
- Receive AI-powered training advice based on historical workout data

## Core Requirements

### Mobile App
- Platform: iOS
- Framework: React Native
- Language: TypeScript
- Runtime and tooling: Expo

### Backend Server
- Required: yes
- Responsibilities:
  - Store and serve workout records
  - Provide APIs for workout CRUD operations
  - Integrate with an LLM service for training advice

### Data and Features
- Workout records must be trackable by date
- Each workout entry should support:
  - Exercise name
  - Weight
  - Sets
  - Reps
  - Notes (optional)
- Users can review historical training sessions

### AI Training Advice
- Backend connects to an LLM
- Advice should be generated using previous training records
- The "today's advice" response should be personalized and data-driven

## Suggested Initial Tech Stack

### Frontend (Expo App)
- Expo + React Native + TypeScript
- React Navigation (stack/tab navigation)
- State management: React Query + local component state
- Date handling: dayjs

### Backend (Node.js)
- Node.js + TypeScript
- Framework: Express or Fastify
- Database: PostgreSQL (recommended) or SQLite for MVP
- ORM: Prisma
- LLM SDK: OpenAI official SDK

## High-Level Architecture

1. iOS app submits and fetches workout logs via REST API.
2. Backend persists workout records (MVP: JSON file storage in `backend/data/workouts.json`).
3. iOS app requests "today's training advice."
4. Backend aggregates recent historical data and prompts LLM.
5. Backend returns concise, actionable advice to the app.

## API Surface (Draft)

- `POST /workouts`
  - Create a workout log
- `GET /workouts?date=YYYY-MM-DD`
  - Retrieve workouts for a specific date
- `GET /workouts/history?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - Retrieve workout history range
- `GET /advice/today`
  - Get today's training advice based on prior records

## Data Model (Draft)

### WorkoutSession
- id
- userId
- date
- createdAt
- updatedAt

### ExerciseEntry
- id
- workoutSessionId
- exerciseName
- weight
- sets
- reps
- notes (nullable)
- createdAt
- updatedAt

## Security and Secrets

- Keep API keys out of source code and git history.
- Store secrets in environment variables, for example:
  - Backend: `.env` -> `OPENAI_API_KEY=...`
- If a key is ever posted in plaintext, rotate/revoke it immediately.

## Milestones and Progress Tracker

### Milestone 0 - Project Setup
- [x] Initialize Expo app with TypeScript
- [ ] Configure linting/formatting
- [x] Create backend TypeScript server
- [x] Add shared docs and architecture notes

### Milestone 1 - Workout CRUD
- [x] Define DB schema (workout session + exercise entry)
- [x] Create migrations
- [x] Implement workout create/read endpoints
- [x] Build mobile screens for logging and viewing by date

### Milestone 2 - History and UX
- [x] Date-based history browsing
- [x] Session detail view
- [x] Basic validation and error states

### Milestone 3 - AI Advice
- [x] Implement backend LLM prompt pipeline
- [x] Add endpoint for today's advice
- [x] Display advice card in app home screen
- [x] Add fallback when records are insufficient

### Milestone 4 - Stabilization
- [ ] Basic tests (API + critical app flows)
- [ ] Improve prompt quality and response formatting
- [ ] Prepare for TestFlight build

## Current Status

- Date: 2026-02-17
- Status: Initial implementation complete (MVP)
- Completed this session:
  - Scaffolded Expo TypeScript app in `mobile`
  - Scaffolded TypeScript backend in `backend`
  - Implemented backend APIs: `POST /workouts`, `GET /workouts`, `GET /workouts/history`
  - Implemented backend AI advice API: `GET /advice/today` with OpenAI + fallback
  - Added local persistence via `backend/data/workouts.json`
  - Built mobile UI for adding workout logs, date-based history view, and AI advice view

## Next Actions

1. Add `.env` in `backend` with a rotated/revoked-and-replaced `OPENAI_API_KEY`
2. Add `DATABASE_URL` in `backend/.env` and run `npm --prefix backend run migrate`
3. Run backend and mobile together for local testing
4. Add tests for DB-backed API flows and mobile critical paths
5. Improve prompt quality and response formatting

