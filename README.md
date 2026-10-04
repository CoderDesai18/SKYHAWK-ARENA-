# SKYHAWK ARENA

**AI-Enabled Drone & Counter-Drone Threat Simulation Trainer** — a training-only prototype for Smart India Hackathon 2026 problem statement **SIH26247**, Ministry of Defence / Robotics & Drones theme.

## Live deployment

- **Launch SKYHAWK ARENA:** [https://skyhawk-arena.vercel.app](https://skyhawk-arena.vercel.app)
- **Standalone offline HTML:** [Open the single-file app](https://skyhawk-arena.vercel.app/SKYHAWK_ARENA_SHARE.html)

> All environments, entities, responses, score events, and signal effects are fictional and abstract. This prototype has no real-world vehicle control, weapon targeting, operational military procedure, or real countermeasure guidance.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite (the development server binds to `0.0.0.0`). The app starts in **offline-first demo mode** when Firebase and Supabase settings are not provided. Build/check with:

```bash
npm run build
npm run preview
```

To create the portable, single-file build, run:

```bash
npm run build:share
```

This writes `SKYHAWK_ARENA_SHARE.html` in the project root. It embeds the app code and styles, starts in offline demo mode with no Firebase/Supabase credentials embedded, and uses hash routing so it can be opened directly as a local file. Demo progress is stored in browser storage when the browser permits it.

## Deploy with Vercel

The repository includes `vercel.json` for Vite builds, SPA route refreshes, and serving the standalone HTML alongside the regular app. Import the GitHub repository in Vercel; its build command is `npm run build:vercel` and its output directory is `dist`. No environment variables are required for the local demo. Add Firebase or Supabase client configuration only when those providers are intentionally configured; browser-exposed `VITE_` values are public.

## Demo access

Select **View Demo** on the landing page, or use one of the demo roles on `/login`:

| Role | Email | Password |
|---|---|---|
| Trainee — Aarav Mehta | `pilot.demo@skyhawk.ai` | `Skyhawk2026!` |
| Instructor — Anika Kulkarni | `instructor.demo@skyhawk.ai` | `Skyhawk2026!` |
| Instructor — Rohan Iyer | `instructor2.demo@skyhawk.ai` | `Skyhawk2026!` |
| Admin — Sana Menon | `admin.demo@skyhawk.ai` | `Skyhawk2026!` |

Five fictional trainee profiles, two instructors, one administrator, completed mission histories, replay events, certification records, notifications, scenarios, and audit activity are seeded locally. Demo data is clearly represented as simulated in the interface.

## Functional demo flow

1. Register a new trainee or use the Aarav demo account.
2. A new account completes `/assessment` (six interactive baseline prompts). The pre-seeded Aarav account has a profile ready to explore and can re-run the assessment.
3. Generate a mission at `/missions/generate`; the procedural engine weighs baseline skills, recent results, objective, requested difficulty, environment, and scenario.
4. Launch `/simulation/:missionId`. Operator mode uses **W/A/S/D**, arrow keys, **Space** for altitude, **Shift** for an expanded movement step, and mouse look. Reach two visible waypoints and confirm the survey objective. Defender mode uses simulated contact cards and fictional **Detect → Track → Classify → Respond** or **Disengage** training actions.
5. Complete the mission, review the score and event-level feedback at `/review/:missionId`, and play/pause/seek the replay with event markers.
6. Inspect `/analytics`, the skill passport, certification progress, notifications, and offline queue.
7. Sign in as the instructor to inspect the fictional roster, open profiles/replays, assign adaptive missions, and set a recommended difficulty. Admin access manages users/roles, scenarios, system settings, credentials, and audit logs.

## Architecture

- `src/pages/` — landing, authentication, assessment, trainee dashboard, mission generator/library, Three.js simulation, review/replay, analytics, instructor, passport/certification, admin, settings.
- `src/components/ThreeWorld.tsx` — optimized, procedural Three.js low-poly terrain and simulated entities; no large external models.
- `src/lib/missionEngine.ts` — deterministic weighted mission generation, difficulty management, scoring, and next-focus recommendation.
- `src/lib/threatEngine.ts` — fictional procedural contact manifests and movement profiles (patrol, waypoint, drift, group/formation, direction-change, decoy cue, variance cue).
- `src/lib/trainingEngine.ts` — replaceable `TrainingEngineService` interface. The local procedural implementation is the default; an optional FastAPI adapter uses `VITE_AI_ENGINE_URL` and falls back locally on errors. This is the integration seam for a future Python/PyTorch/PPO service.
- `src/lib/store.ts` — versioned local-first persistence for profiles, missions, events, sessions, performance, credentials, scenarios, notifications, and audit entries.
- `src/lib/firebaseClient.ts`, `src/lib/supabaseClient.ts`, `auth.ts`, `cloud.ts` — optional Firebase Authentication/Firestore plus Supabase Auth adapters. Firebase email/password and popup Google sign-in are preferred when configured; if Firebase Google sign-in fails, Supabase Google OAuth is attempted when configured. With neither backend configured, local demo auth remains available. Firebase Firestore sync is for Firebase-authenticated users; Supabase Auth fallback keeps training data in the offline-first local store unless a trusted backend bridge is added.
- `src/context/` — authenticated profile, local database snapshot, connection state, toast notifications.
- `public/sw.js` — production service worker caches the app shell and same-origin static assets. In-progress sessions and mission events persist locally and queue sync when online.
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json` — deployment configuration and role-aware rules.

## Optional Firebase setup

1. Create a Firebase project and enable Email/Password and Google providers in Firebase Authentication.
2. Create a Firestore database. Add the local environment file using `.env.example` as a template:

```bash
cp .env.example .env.local
```

3. Fill `VITE_FIREBASE_*` variables with the project configuration. These are client configuration values; do not put service-account secrets in Vite variables. Firebase client configuration is public by design and should be protected by Authentication and the included Firestore/Storage rules.
4. Deploy rules and indexes with Firebase CLI (`firebase deploy --only firestore:rules,firestore:indexes,storage`). Configure trusted instructor/admin roles with a controlled administrative workflow. Self-registration always creates a `TRAINEE` profile.
5. To point at a future service, set `VITE_AI_ENGINE_URL` to the base URL of a compatible FastAPI service. The prototype remains usable if that service is unreachable.

### Supabase Auth fallback for Google sign-in

If Firebase Google popup sign-in is unavailable (for example, the OAuth provider or authorized domain is not configured), configure Supabase Auth as the fallback:

1. Create a Supabase project and enable Google under **Authentication → Providers**. Add the Supabase callback URL shown in the dashboard to the Google OAuth client's authorized redirect URIs.
2. Add the app's local and deployed origins to Supabase **Authentication → URL Configuration** (site URL and redirect allow-list). The client redirects back to the app origin.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`, then restart Vite. The app tries Firebase Google sign-in first and redirects through Supabase Google OAuth if that fails.
4. Supabase email/password sign-in and email verification are also supported. New Supabase users start as trainees; elevated roles must be assigned through trusted server-side `app_metadata` or the protected Firebase-backed admin workflow.

Supabase is an authentication fallback, not a Firebase Firestore credential bridge. If Supabase is used without an authenticated Firebase session, simulation results and profiles continue to work and persist locally/offline, but they will not be written to Firestore.

**Production note:** the role management UI is a hackathon prototype. For a real deployment, use custom claims or a trusted server-side admin workflow to assign elevated roles; do not rely on client-side role edits as authorization. Firestore rules remain the actual data boundary.

## Firestore collections

`users`, `missions`, `missionEvents`, `simulationSessions`, `performance`, `certifications`, `notifications`, `trainingScenarios`, and `systemSettings` are modeled and covered by access rules. The browser keeps its local demo store authoritative when Firebase is unconfigured or offline. A real remote session's pending mission events, simulation checkpoints, and performance records are synchronized when connectivity returns.

## Safety and scope

This is a **training and simulation platform only**. Threats are visualized as simple fictional low-poly entities; counter-drone console actions are abstract state transitions; electronic effects are display-only training cues. There are no real-world targeting calculations, control links, weapon workflows, instructions for defeating actual systems, or tactical operating procedures.
