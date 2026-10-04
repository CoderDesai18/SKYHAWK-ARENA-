import type { Difficulty, Mission, MissionEvent, MissionOptions, SkillKey, SkillProfile, UserProfile } from '../types';
import { EMPTY_SKILLS, SKILL_LABELS } from '../types';
import { makeId } from './store';

const DIFFICULTIES: Difficulty[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const difficultyTitle: Record<Difficulty, string> = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced', EXPERT: 'Expert' };
const objectiveSkills: Record<MissionOptions['objective'], SkillKey> = {
  Detection: 'detection', Tracking: 'tracking', Navigation: 'navigation', 'Response Timing': 'reactionTime',
  'Threat Classification': 'accuracy', 'Situational Awareness': 'situationalAwareness'
};
const environmentTag: Record<string, string> = { 'Border Simulation': 'Perimeter', 'Urban Simulation': 'Urban', 'Mountain Simulation': 'Ridge', 'Open Terrain': 'Open terrain' };

function clamp(value: number, min = 0, max = 100): number { return Math.max(min, Math.min(max, value)); }

export function trainingLevelFromScore(score: number): UserProfile['trainingLevel'] {
  if (score >= 90) return 'EXPERT';
  if (score >= 80) return 'ADVANCED';
  if (score >= 65) return 'INTERMEDIATE';
  return 'BEGINNER';
}

export function weakestSkill(skills: SkillProfile): SkillKey {
  const keys: SkillKey[] = ['detection', 'tracking', 'navigation', 'accuracy', 'reactionTime', 'decisionMaking', 'situationalAwareness'];
  return keys.reduce((weakest, key) => skills[key] < skills[weakest] ? key : weakest, keys[0]);
}

export function objectiveForSkill(skill: SkillKey): MissionOptions['objective'] {
  const map: Record<SkillKey, MissionOptions['objective']> = {
    detection: 'Detection', tracking: 'Tracking', navigation: 'Navigation', accuracy: 'Threat Classification',
    reactionTime: 'Response Timing', decisionMaking: 'Threat Classification', situationalAwareness: 'Situational Awareness', objectiveCompletion: 'Situational Awareness'
  };
  return map[skill];
}

export function manageDifficulty(requested: Difficulty, recentScores: number[], profile: UserProfile): { difficulty: Difficulty; reason: string } {
  const index = DIFFICULTIES.indexOf(requested);
  const lastTwo = recentScores.slice(0, 2);
  let shift = 0;
  let reason = `Requested ${difficultyTitle[requested].toLowerCase()} level retained.`;
  if (lastTwo.length >= 2 && lastTwo.every((score) => score >= 90)) {
    shift = 1;
    reason = 'Recent high-confidence performance increased scenario complexity by one training band.';
  } else if ((lastTwo.length >= 1 && lastTwo[0] < 58) || profile.overallScore < 56) {
    shift = -1;
    reason = 'Recent performance suggests a supported practice band with a wider response window.';
  } else if (lastTwo.length >= 2 && lastTwo.every((score) => score >= 84)) {
    shift = 1;
    reason = 'Consistent performance nudged complexity upward while retaining the selected training focus.';
  } else if (lastTwo.length >= 2 && lastTwo.every((score) => score < 66)) {
    shift = -1;
    reason = 'Two recent sessions indicate extra practice scaffolding is appropriate.';
  }
  const difficulty = DIFFICULTIES[Math.max(0, Math.min(3, index + shift))];
  return { difficulty, reason };
}

function stableSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash) || 1;
}

export function generateAdaptiveMission(profile: UserProfile, options: MissionOptions, priorMissions: Mission[], adaptiveEnabled = true): Mission {
  const recent = priorMissions.filter((m) => m.userId === (options.assignedTo ?? profile.uid) && m.status === 'COMPLETED').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, 4);
  const recentScores = recent.map((m) => m.score ?? 0);
  const { difficulty, reason } = adaptiveEnabled
    ? manageDifficulty(options.difficulty, recentScores, profile)
    : { difficulty: options.difficulty, reason: 'System configuration keeps the requested difficulty unchanged.' };
  const focus = objectiveSkills[options.objective] ?? weakestSkill(profile.skills);
  const weakness = weakestSkill(profile.skills);
  const focusLabel = SKILL_LABELS[focus];
  const difficultyIndex = DIFFICULTIES.indexOf(difficulty);
  const scenarioBase: Record<string, number> = {
    'Single Threat': 1, 'Multiple Threats': 2, 'Swarm Simulation': 3, 'Signal Disruption Simulation': 2, 'Mixed Scenario': 3
  };
  let threatCount = scenarioBase[options.scenario] + (difficultyIndex >= 2 ? 1 : 0) + (difficultyIndex === 3 && options.scenario === 'Swarm Simulation' ? 1 : 0);
  if (profile.overallScore < 55) threatCount = Math.max(1, threatCount - 1);
  threatCount = Math.min(5, threatCount);
  const durationSeconds = [160, 190, 220, 250][difficultyIndex];
  const modeObjectives = options.role === 'OPERATOR'
    ? ['Reach the designated observation waypoint', 'Maintain orientation through the marked practice corridor', 'Confirm the abstract survey objective']
    : [`Detect ${threatCount} simulated contact${threatCount === 1 ? '' : 's'}`, 'Track and classify training signatures', 'Log a simulation-only response or safe disengagement'];
  const title = `${environmentTag[options.environment] ?? 'Training'} ${focusLabel} ${options.role === 'OPERATOR' ? 'Route' : 'Contact'} Drill`;
  const whyFocus = profile.skills[weakness] <= profile.skills[focus] - 5
    ? `Skill profile shows ${SKILL_LABELS[weakness].toLowerCase()} as a priority gap; a short warm-up cue is included.`
    : `Mission objective aligns to ${focusLabel.toLowerCase()} and recent session trends.`;
  const now = new Date().toISOString();
  return {
    id: makeId('mission'),
    userId: options.assignedTo ?? profile.uid,
    assignedTo: options.assignedTo,
    assignedBy: options.assignedBy,
    title,
    role: options.role,
    status: 'READY',
    difficulty,
    environment: options.environment,
    scenario: options.scenario,
    objective: options.role === 'OPERATOR' ? 'Navigate the training route and confirm each observation waypoint.' : `Apply the ${options.objective.toLowerCase()} sequence to simulated contacts.`,
    focus,
    threatCount,
    durationSeconds,
    objectives: modeObjectives,
    seed: stableSeed(`${profile.uid}:${now}:${options.environment}:${options.scenario}`),
    adaptNote: `${reason} ${whyFocus} Threat complexity: ${threatCount} abstract training contact${threatCount === 1 ? '' : 's'}.`,
    createdAt: now,
    events: [],
    replayPath: [{ timeElapsed: 0, x: 0, z: 0, heading: 0 }],
    baselineAtStart: { ...profile.skills },
    estimatedMinutes: Math.round(durationSeconds / 60) + 2
  };
}

export function createMissionEvent(input: Omit<MissionEvent, 'id' | 'at'>): MissionEvent {
  return { ...input, id: makeId('event'), at: new Date().toISOString() };
}

const categoryWeights: Record<SkillKey, number> = {
  detection: 0.14, tracking: 0.13, navigation: 0.12, accuracy: 0.12,
  reactionTime: 0.12, decisionMaking: 0.13, situationalAwareness: 0.13, objectiveCompletion: 0.11
};

export function calculateMissionScores(events: MissionEvent[], baseline: SkillProfile = EMPTY_SKILLS): { score: number; categoryScores: SkillProfile } {
  const categoryScores: SkillProfile = { ...baseline };
  const gains: Record<SkillKey, number> = { detection: 0, tracking: 0, navigation: 0, accuracy: 0, reactionTime: 0, decisionMaking: 0, situationalAwareness: 0, objectiveCompletion: 0 };
  const caps: Record<SkillKey, number> = { detection: 36, tracking: 34, navigation: 36, accuracy: 34, reactionTime: 32, decisionMaking: 34, situationalAwareness: 32, objectiveCompletion: 38 };
  for (const event of events) {
    for (const category of event.categories) {
      gains[category] += event.scoreImpact * (event.scoreImpact < 0 ? 0.85 : 0.46);
    }
  }
  (Object.keys(categoryScores) as SkillKey[]).forEach((key) => {
    const floor = Math.max(40, Math.min(100, baseline[key] || 50));
    categoryScores[key] = Math.round(clamp(floor + Math.min(caps[key], gains[key])));
  });
  const weighted = (Object.keys(categoryWeights) as SkillKey[]).reduce((sum, key) => sum + categoryScores[key] * categoryWeights[key], 0);
  return { score: Math.round(clamp(weighted)), categoryScores };
}

export function blendedSkills(previous: SkillProfile, latest: SkillProfile): SkillProfile {
  const result = { ...previous };
  (Object.keys(result) as SkillKey[]).forEach((key) => { result[key] = Math.round(previous[key] * 0.62 + latest[key] * 0.38); });
  return result;
}

export function getRecommendation(profile: UserProfile, recent: Mission[]): { objective: MissionOptions['objective']; difficulty: Difficulty; sentence: string } {
  const weak = weakestSkill(profile.skills);
  const latest = recent.filter((mission) => mission.userId === profile.uid && mission.status === 'COMPLETED').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, 2);
  const average = latest.length ? latest.reduce((sum, mission) => sum + (mission.score ?? 0), 0) / latest.length : profile.overallScore;
  const difficulty: Difficulty = average >= 88 ? 'ADVANCED' : average >= 68 ? 'INTERMEDIATE' : 'BEGINNER';
  const objective = objectiveForSkill(weak);
  return {
    objective,
    difficulty,
    sentence: `${difficultyTitle[difficulty]} ${objective.toLowerCase()} practice is recommended. Your current priority gap is ${SKILL_LABELS[weak].toLowerCase()} (${profile.skills[weak]}%).`
  };
}

export function eventTimeLabel(seconds: number): string {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}
