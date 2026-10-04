import type { Difficulty, Mission, MissionOptions, UserProfile } from '../types';
import { generateAdaptiveMission, getRecommendation, weakestSkill } from './missionEngine';
import { getDb } from './store';

export interface AdaptiveAnalysis {
  missionId: string;
  score: number;
  weakestSkill: string;
  recommendedObjective: MissionOptions['objective'];
  recommendedDifficulty: Difficulty;
  explanation: string;
  engine: 'procedural' | 'fastapi';
}

export interface TrainingEngineService {
  generateMission(profile: UserProfile, options: MissionOptions, history: Mission[]): Promise<Mission>;
  analyzeMission(mission: Mission, profile: UserProfile, history: Mission[]): Promise<AdaptiveAnalysis>;
}

/** Transparent local engine used by the hackathon demo; a trained RL service is not required. */
export class ProceduralTrainingEngine implements TrainingEngineService {
  async generateMission(profile: UserProfile, options: MissionOptions, history: Mission[]): Promise<Mission> {
    return generateAdaptiveMission(profile, options, history, getDb().systemSettings.adaptiveDifficulty);
  }

  async analyzeMission(mission: Mission, profile: UserProfile, history: Mission[]): Promise<AdaptiveAnalysis> {
    const weak = weakestSkill(profile.skills);
    const recommendation = getRecommendation(profile, history.filter((item) => item.id !== mission.id));
    return {
      missionId: mission.id,
      score: mission.score ?? 0,
      weakestSkill: weak,
      recommendedObjective: recommendation.objective,
      recommendedDifficulty: recommendation.difficulty,
      explanation: recommendation.sentence,
      engine: 'procedural'
    };
  }
}

/** Optional future FastAPI/PyTorch/PPO adapter. On network failure, the demo safely falls back to deterministic generation. */
export class FastAPITrainingEngine extends ProceduralTrainingEngine {
  constructor(private readonly endpoint: string) { super(); }

  override async generateMission(profile: UserProfile, options: MissionOptions, history: Mission[]): Promise<Mission> {
    try {
      const response = await fetch(`${this.endpoint.replace(/\/$/, '')}/v1/missions/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, options, history: history.slice(0, 8).map((mission) => ({ id: mission.id, score: mission.score, difficulty: mission.difficulty, events: mission.events.slice(-8) })) })
      });
      if (!response.ok) throw new Error(`Training service responded ${response.status}`);
      const mission = await response.json() as Mission;
      return { ...mission, userId: options.assignedTo ?? profile.uid, assignedTo: options.assignedTo, assignedBy: options.assignedBy, status: 'READY', events: [] };
    } catch (error) {
      console.warn('Advanced mission service unavailable; procedural mission generation is active.', error);
      return super.generateMission(profile, options, history);
    }
  }

  override async analyzeMission(mission: Mission, profile: UserProfile, history: Mission[]): Promise<AdaptiveAnalysis> {
    try {
      const response = await fetch(`${this.endpoint.replace(/\/$/, '')}/v1/missions/${encodeURIComponent(mission.id)}/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mission, profile, history: history.slice(0, 8) })
      });
      if (!response.ok) throw new Error(`Training service responded ${response.status}`);
      return { ...(await response.json() as AdaptiveAnalysis), missionId: mission.id, engine: 'fastapi' };
    } catch (error) {
      console.warn('Advanced analysis service unavailable; local feedback is active.', error);
      return super.analyzeMission(mission, profile, history);
    }
  }
}

const endpoint = import.meta.env.VITE_AI_ENGINE_URL as string | undefined;
export const trainingEngine: TrainingEngineService = endpoint ? new FastAPITrainingEngine(endpoint) : new ProceduralTrainingEngine();
