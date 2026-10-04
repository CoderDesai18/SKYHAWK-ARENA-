export type UserRole = 'TRAINEE' | 'INSTRUCTOR' | 'ADMIN';
export type TrainingLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
export type MissionRole = 'OPERATOR' | 'DEFENDER';
export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
export type MissionStatus = 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
export type Environment = 'Border Simulation' | 'Urban Simulation' | 'Mountain Simulation' | 'Open Terrain';
export type ScenarioType = 'Single Threat' | 'Multiple Threats' | 'Swarm Simulation' | 'Signal Disruption Simulation' | 'Mixed Scenario';
export type SkillKey = 'detection' | 'tracking' | 'navigation' | 'accuracy' | 'reactionTime' | 'decisionMaking' | 'situationalAwareness' | 'objectiveCompletion';

export type SkillProfile = Record<SkillKey, number>;

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: UserRole;
  createdAt: string;
  lastLogin: string;
  trainingLevel: TrainingLevel;
  overallScore: number;
  missionsCompleted: number;
  certificationStatus: string;
  baselineCompleted: boolean;
  baselineCompletedAt?: string;
  skills: SkillProfile;
  averageReactionMs: number;
  successRate: number;
  recommendedDifficulty: Difficulty;
  emailVerified: boolean;
  active?: boolean;
  notes?: string;
}

export interface MissionEvent {
  id: string;
  timeElapsed: number;
  at: string;
  event: string;
  action: string;
  result: string;
  scoreImpact: number;
  categories: SkillKey[];
  expected: string;
  traineeAction: string;
  position?: { x: number; z: number };
}

export interface ReplayPoint {
  timeElapsed: number;
  x: number;
  z: number;
  heading: number;
}

export interface Mission {
  id: string;
  userId: string;
  assignedTo?: string;
  assignedBy?: string;
  title: string;
  role: MissionRole;
  status: MissionStatus;
  difficulty: Difficulty;
  environment: Environment;
  scenario: ScenarioType;
  objective: string;
  focus: SkillKey;
  threatCount: number;
  durationSeconds: number;
  objectives: string[];
  seed: number;
  adaptNote: string;
  createdAt: string;
  completedAt?: string;
  score?: number;
  categoryScores?: SkillProfile;
  events: MissionEvent[];
  replayPath?: ReplayPoint[];
  baselineAtStart?: SkillProfile;
  assignedLabel?: string;
  estimatedMinutes?: number;
}

export interface Certification {
  id: string;
  userId: string;
  name: string;
  tier: string;
  status: 'EARNED' | 'IN_PROGRESS' | 'EXPIRED';
  issueDate?: string;
  credentialId: string;
  score?: number;
  description: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'MISSION' | 'CERTIFICATION' | 'FEEDBACK' | 'MILESTONE' | 'SYSTEM';
  createdAt: string;
  read: boolean;
  href?: string;
}

export interface SimulationSession {
  id: string;
  missionId: string;
  userId: string;
  elapsedSeconds: number;
  position: { x: number; z: number; altitude: number; heading: number };
  contacts: Array<{ id: string; status: 'UNASSESSED' | 'DETECTED' | 'TRACKING' | 'CLASSIFIED' | 'RESOLVED' | 'DISENGAGED'; available: boolean; reactionMs?: number }>;
  activeWaypoint: number;
  updatedAt: string;
  isRunning: boolean;
}

export interface PerformanceRecord {
  id: string;
  userId: string;
  missionId: string;
  score: number;
  categoryScores: SkillProfile;
  reactionMs: number;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  target: string;
  at: string;
  detail: string;
}

export interface TrainingScenario {
  id: string;
  name: string;
  environment: Environment;
  scenario: ScenarioType;
  enabled: boolean;
  difficulty: Difficulty;
  description: string;
}

export interface SystemSettings {
  baselineThreshold: number;
  adaptiveDifficulty: boolean;
  certificationThreshold: number;
  lowGraphicsDefault: boolean;
  soundEnabled: boolean;
}

export interface LocalDatabase {
  version: number;
  users: UserProfile[];
  credentials: Record<string, string>;
  missions: Mission[];
  missionEvents: MissionEvent[];
  simulationSessions: SimulationSession[];
  performance: PerformanceRecord[];
  certifications: Certification[];
  notifications: AppNotification[];
  trainingScenarios: TrainingScenario[];
  systemSettings: SystemSettings;
  auditLogs: AuditEntry[];
  pendingSync: string[];
  userPreferences: Record<string, Record<string, string | boolean>>;
}

export interface MissionOptions {
  role: MissionRole;
  difficulty: Difficulty;
  environment: Environment;
  scenario: ScenarioType;
  objective: 'Detection' | 'Tracking' | 'Navigation' | 'Response Timing' | 'Threat Classification' | 'Situational Awareness';
  assignedTo?: string;
  assignedBy?: string;
}

export const SKILL_LABELS: Record<SkillKey, string> = {
  detection: 'Detection',
  tracking: 'Tracking',
  navigation: 'Navigation',
  accuracy: 'Accuracy',
  reactionTime: 'Reaction time',
  decisionMaking: 'Decision making',
  situationalAwareness: 'Situational awareness',
  objectiveCompletion: 'Objective completion'
};

export const EMPTY_SKILLS: SkillProfile = {
  detection: 50,
  tracking: 50,
  navigation: 50,
  accuracy: 50,
  reactionTime: 50,
  decisionMaking: 50,
  situationalAwareness: 50,
  objectiveCompletion: 50
};