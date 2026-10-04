# Optional FastAPI training-engine contract

The client currently uses `ProceduralTrainingEngine`. Set `VITE_AI_ENGINE_URL` to enable the replaceable adapter in `src/lib/trainingEngine.ts`.

## Generate a mission

`POST /v1/missions/generate`

Request JSON contains:

- `profile`: current trainee profile / skill scores
- `options`: role, requested difficulty, environment, fictional scenario and training objective
- `history`: a compact recent-mission subset

Return a `Mission` JSON object defined in `src/types.ts`. The adapter overwrites ownership and status fields from the authenticated client context and resets events before the trainee launches it.

## Analyze a completed mission

`POST /v1/missions/{missionId}/analyze`

Request JSON contains the completed `mission`, `profile`, and a compact history. Return:

```json
{
  "missionId": "mission-id",
  "score": 82,
  "weakestSkill": "reactionTime",
  "recommendedObjective": "Response Timing",
  "recommendedDifficulty": "INTERMEDIATE",
  "explanation": "A concise training-only recommendation."
}
```

If the API is not configured, offline, or returns an error, the UI falls back to the deterministic procedural engine. Keep any advanced analysis restricted to training feedback; do not return operational control, targeting, or real-world countermeasure instructions.
