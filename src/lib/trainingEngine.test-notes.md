The `TrainingEngineService` interface in `trainingEngine.ts` is the AI integration seam. Unit tests can call `ProceduralTrainingEngine.generateMission` with a seeded `UserProfile` and assert:

- mission owner and mode match the requested role
- the generated focus matches the selected objective
- contact counts remain bounded to one through five
- difficulty adjustments remain within the supported four bands
- every generated title, objective and event stays inside the fictional simulation vocabulary

No model weights or external API are required for the prototype.