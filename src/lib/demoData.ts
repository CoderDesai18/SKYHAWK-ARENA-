import type { AppNotification, AuditEntry, Certification, Difficulty, LocalDatabase, Mission, MissionEvent, PerformanceRecord, SkillKey, SkillProfile, TrainingScenario, UserProfile } from '../types';
import { EMPTY_SKILLS } from '../types';

const now = Date.now();
const ago = (days: number, hours = 0) => new Date(now - days * 86400000 - hours * 3600000).toISOString();
const demoHash = '2fd65f6b5e92d56368df3a7955c23f6acdac0142e7c0704f24c37b9d2bbdcb58';

const skills = (patch: Partial<SkillProfile> = {}): SkillProfile => ({ ...EMPTY_SKILLS, ...patch });
const profile = (p: Partial<UserProfile> & Pick<UserProfile, 'uid' | 'name' | 'email' | 'role'>): UserProfile => ({
  uid: p.uid,
  name: p.name,
  email: p.email,
  photoURL: p.photoURL,
  role: p.role,
  createdAt: p.createdAt ?? ago(90),
  lastLogin: p.lastLogin ?? ago(0, 1),
  trainingLevel: p.trainingLevel ?? 'INTERMEDIATE',
  overallScore: p.overallScore ?? 76,
  missionsCompleted: p.missionsCompleted ?? 3,
  certificationStatus: p.certificationStatus ?? 'IN PROGRESS',
  baselineCompleted: p.baselineCompleted ?? true,
  baselineCompletedAt: p.baselineCompletedAt ?? ago(80),
  skills: p.skills ?? skills({ detection: 78, tracking: 74, navigation: 80, accuracy: 82, reactionTime: 70, decisionMaking: 76, situationalAwareness: 75, objectiveCompletion: 83 }),
  averageReactionMs: p.averageReactionMs ?? 1850,
  successRate: p.successRate ?? 75,
  recommendedDifficulty: p.recommendedDifficulty ?? 'INTERMEDIATE',
  emailVerified: p.emailVerified ?? true,
  active: p.active ?? true,
  notes: p.notes
});

const users: UserProfile[] = [
  profile({ uid: 'demo-aarav', name: 'Aarav Mehta', email: 'pilot.demo@skyhawk.ai', role: 'TRAINEE', overallScore: 84, missionsCompleted: 8, certificationStatus: 'FOUNDATION • EARNED', trainingLevel: 'ADVANCED', averageReactionMs: 1420, successRate: 88, recommendedDifficulty: 'ADVANCED', skills: skills({ detection: 89, tracking: 85, navigation: 86, accuracy: 91, reactionTime: 76, decisionMaking: 83, situationalAwareness: 82, objectiveCompletion: 89 }) }),
  profile({ uid: 'demo-kavya', name: 'Kavya Nair', email: 'kavya.demo@skyhawk.ai', role: 'TRAINEE', overallScore: 78, missionsCompleted: 6, certificationStatus: 'FOUNDATION • EARNED', trainingLevel: 'INTERMEDIATE', averageReactionMs: 1730, successRate: 83, recommendedDifficulty: 'INTERMEDIATE', skills: skills({ detection: 92, tracking: 80, navigation: 74, accuracy: 84, reactionTime: 68, decisionMaking: 77, situationalAwareness: 82, objectiveCompletion: 82 }) }),
  profile({ uid: 'demo-rehan', name: 'Rehan Siddiqui', email: 'rehan.demo@skyhawk.ai', role: 'TRAINEE', overallScore: 71, missionsCompleted: 5, certificationStatus: 'IN PROGRESS', trainingLevel: 'INTERMEDIATE', averageReactionMs: 2110, successRate: 72, recommendedDifficulty: 'INTERMEDIATE', skills: skills({ detection: 73, tracking: 76, navigation: 86, accuracy: 71, reactionTime: 62, decisionMaking: 70, situationalAwareness: 68, objectiveCompletion: 72 }) }),
  profile({ uid: 'demo-mira', name: 'Mira Deshpande', email: 'mira.demo@skyhawk.ai', role: 'TRAINEE', overallScore: 91, missionsCompleted: 11, certificationStatus: 'ADVANCED • EARNED', trainingLevel: 'EXPERT', averageReactionMs: 1190, successRate: 94, recommendedDifficulty: 'EXPERT', skills: skills({ detection: 93, tracking: 96, navigation: 87, accuracy: 94, reactionTime: 89, decisionMaking: 90, situationalAwareness: 91, objectiveCompletion: 95 }) }),
  profile({ uid: 'demo-vihaan', name: 'Vihaan Rao', email: 'vihaan.demo@skyhawk.ai', role: 'TRAINEE', overallScore: 65, missionsCompleted: 3, certificationStatus: 'IN PROGRESS', trainingLevel: 'BEGINNER', averageReactionMs: 2450, successRate: 66, recommendedDifficulty: 'BEGINNER', skills: skills({ detection: 70, tracking: 61, navigation: 73, accuracy: 65, reactionTime: 58, decisionMaking: 64, situationalAwareness: 62, objectiveCompletion: 68 }) }),
  profile({ uid: 'demo-anika', name: 'Anika Kulkarni', email: 'instructor.demo@skyhawk.ai', role: 'INSTRUCTOR', overallScore: 96, missionsCompleted: 42, certificationStatus: 'INSTRUCTOR • VERIFIED', trainingLevel: 'EXPERT', successRate: 98, skills: skills({ detection: 97, tracking: 96, navigation: 95, accuracy: 98, reactionTime: 94, decisionMaking: 97, situationalAwareness: 98, objectiveCompletion: 98 }) }),
  profile({ uid: 'demo-rohan', name: 'Rohan Iyer', email: 'instructor2.demo@skyhawk.ai', role: 'INSTRUCTOR', overallScore: 93, missionsCompleted: 35, certificationStatus: 'INSTRUCTOR • VERIFIED', trainingLevel: 'EXPERT', successRate: 97, skills: skills({ detection: 94, tracking: 93, navigation: 96, accuracy: 95, reactionTime: 91, decisionMaking: 94, situationalAwareness: 96, objectiveCompletion: 96 }) }),
  profile({ uid: 'demo-admin', name: 'Sana Menon', email: 'admin.demo@skyhawk.ai', role: 'ADMIN', overallScore: 100, missionsCompleted: 0, certificationStatus: 'SYSTEM ADMIN', trainingLevel: 'EXPERT', successRate: 100, skills: skills(Object.fromEntries(Object.keys(EMPTY_SKILLS).map((k) => [k, 100])) as Partial<SkillProfile>) })
];

const makeEvents = (missionId: string, score: number, names: string[], startTime: string): MissionEvent[] => names.map((event, i) => ({
  id: `${missionId}-event-${i + 1}`,
  timeElapsed: [42, 75, 128, 197, 238][i] ?? (i + 1) * 44,
  at: new Date(new Date(startTime).getTime() + ([42, 75, 128, 197, 238][i] ?? (i + 1) * 44) * 1000).toISOString(),
  event,
  action: ['Contact acknowledged', 'Track lock maintained', 'Classification confirmed', 'Response logged in simulation', 'Objective marker verified'][i] ?? 'Training action recorded',
  result: ['Positive identification window maintained', 'Track continuity: 94%', 'Correct simulated class selected', 'Abstract response action completed', 'Training objective completed'][i] ?? 'Event recorded in training log',
  scoreImpact: [9, 8, 8, 11, 12][i] ?? 5,
  categories: ([['detection', 'situationalAwareness'], ['tracking'], ['accuracy', 'decisionMaking'], ['reactionTime', 'decisionMaking'], ['objectiveCompletion']] as SkillKey[][])[i] ?? ['situationalAwareness'],
  expected: ['Confirm the new training contact before progressing.', 'Maintain a stable track through the observation window.', 'Use available context before selecting a simulated class.', 'Choose an abstract in-simulation response within the training window.', 'Verify the objective marker before ending the session.'][i] ?? 'Follow the mission brief and log the result.',
  traineeAction: ['Acknowledged the contact at first cue.', 'Maintained continuous tracking.', 'Selected the supported classification.', 'Recorded a simulation-only response.', 'Confirmed the final objective.'][i] ?? 'Completed the training event.'
}));

const mission = (p: { id: string; userId: string; name: string; role?: 'OPERATOR' | 'DEFENDER'; difficulty: Difficulty; score: number; daysAgo: number; focus?: 'detection' | 'tracking' | 'navigation' | 'accuracy' | 'reactionTime' | 'decisionMaking' | 'situationalAwareness' | 'objectiveCompletion'; environment?: Mission['environment']; scenario?: Mission['scenario'] }): Mission => {
  const createdAt = ago(p.daysAgo, 2);
  const categories = skills({ detection: p.score - 1, tracking: p.score - 5, navigation: p.score - 3, accuracy: p.score + 1, reactionTime: p.score - 8, decisionMaking: p.score - 2, situationalAwareness: p.score - 4, objectiveCompletion: p.score + 2 });
  const id = p.id;
  return {
    id, userId: p.userId, title: p.name, role: p.role ?? 'DEFENDER', status: 'COMPLETED', difficulty: p.difficulty,
    environment: p.environment ?? 'Border Simulation', scenario: p.scenario ?? 'Multiple Threats', objective: 'Detection and threat classification', focus: p.focus ?? 'detection', threatCount: 2,
    durationSeconds: 268, objectives: ['Detect two simulated contacts', 'Classify training signatures', 'Complete a simulation response'], seed: p.daysAgo * 983 + p.score,
    adaptNote: 'Generated from the trainee skill profile and recent session history.', createdAt, completedAt: new Date(new Date(createdAt).getTime() + 268000).toISOString(), score: p.score,
    categoryScores: categories,
    events: makeEvents(id, p.score, ['Simulated contact detected', 'Tracking sequence initiated', 'Threat class confirmed', 'Simulation response logged', 'Mission objective completed'], createdAt),
    replayPath: [{ timeElapsed: 0, x: 0, z: 0, heading: 0 }, { timeElapsed: 42, x: 2, z: -3, heading: 15 }, { timeElapsed: 128, x: 4, z: -9, heading: 30 }, { timeElapsed: 197, x: 2, z: -14, heading: 10 }, { timeElapsed: 268, x: -1, z: -20, heading: -8 }]
  };
};

const missions: Mission[] = [
  mission({ id: 'demo-m-01', userId: 'demo-aarav', name: 'Perimeter Echo', difficulty: 'INTERMEDIATE', score: 78, daysAgo: 12 }),
  mission({ id: 'demo-m-02', userId: 'demo-aarav', name: 'Urban Signal Sweep', difficulty: 'INTERMEDIATE', score: 81, daysAgo: 9, environment: 'Urban Simulation', scenario: 'Signal Disruption Simulation' }),
  mission({ id: 'demo-m-03', userId: 'demo-aarav', name: 'North Ridge Watch', difficulty: 'ADVANCED', score: 84, daysAgo: 5, environment: 'Mountain Simulation', scenario: 'Mixed Scenario' }),
  mission({ id: 'demo-m-04', userId: 'demo-aarav', name: 'Adaptive Contact Drill', difficulty: 'ADVANCED', score: 90, daysAgo: 1, focus: 'reactionTime', scenario: 'Multiple Threats' }),
  mission({ id: 'demo-m-05', userId: 'demo-kavya', name: 'Signal Trace', difficulty: 'BEGINNER', score: 68, daysAgo: 13, focus: 'detection' }),
  mission({ id: 'demo-m-06', userId: 'demo-kavya', name: 'Observation Arc', difficulty: 'INTERMEDIATE', score: 82, daysAgo: 4, focus: 'situationalAwareness' }),
  mission({ id: 'demo-m-07', userId: 'demo-rehan', name: 'Waypoint Survey', difficulty: 'BEGINNER', score: 65, daysAgo: 10, role: 'OPERATOR', focus: 'navigation', environment: 'Mountain Simulation' }),
  mission({ id: 'demo-m-08', userId: 'demo-rehan', name: 'Contact Review', difficulty: 'INTERMEDIATE', score: 74, daysAgo: 2, focus: 'decisionMaking' }),
  mission({ id: 'demo-m-09', userId: 'demo-mira', name: 'Formation Awareness', difficulty: 'ADVANCED', score: 88, daysAgo: 8, scenario: 'Swarm Simulation' }),
  mission({ id: 'demo-m-10', userId: 'demo-mira', name: 'Mixed Terrain Review', difficulty: 'EXPERT', score: 94, daysAgo: 1, role: 'OPERATOR', environment: 'Open Terrain', scenario: 'Mixed Scenario', focus: 'navigation' }),
  mission({ id: 'demo-m-11', userId: 'demo-vihaan', name: 'First Contact', difficulty: 'BEGINNER', score: 63, daysAgo: 6, focus: 'reactionTime' }),
  mission({ id: 'demo-m-12', userId: 'demo-vihaan', name: 'Waypoint Foundations', difficulty: 'BEGINNER', score: 69, daysAgo: 1, role: 'OPERATOR', focus: 'navigation' })
];

const certifications: Certification[] = [
  { id: 'cert-aarav-1', userId: 'demo-aarav', name: 'Simulation Foundations', tier: 'FOUNDATION', status: 'EARNED', issueDate: ago(7), credentialId: 'SHA-26-AR-0841', score: 84, description: 'Demonstrated reliable performance across foundational simulated operator and awareness objectives.' },
  { id: 'cert-kavya-1', userId: 'demo-kavya', name: 'Simulation Foundations', tier: 'FOUNDATION', status: 'EARNED', issueDate: ago(21), credentialId: 'SHA-26-KN-0712', score: 78, description: 'Demonstrated consistent foundational performance in a controlled training environment.' },
  { id: 'cert-mira-1', userId: 'demo-mira', name: 'Advanced Simulation Readiness', tier: 'ADVANCED', status: 'EARNED', issueDate: ago(2), credentialId: 'SHA-26-MD-0917', score: 91, description: 'Demonstrated advanced performance across multiple simulated training scenarios.' },
  { id: 'cert-rehan-p', userId: 'demo-rehan', name: 'Simulation Foundations', tier: 'FOUNDATION', status: 'IN_PROGRESS', credentialId: 'SHA-26-RS-PROG', score: 71, description: 'Complete two additional training missions and improve decision consistency to qualify.' },
  { id: 'cert-vihaan-p', userId: 'demo-vihaan', name: 'Simulation Foundations', tier: 'FOUNDATION', status: 'IN_PROGRESS', credentialId: 'SHA-26-VR-PROG', score: 65, description: 'Continue foundational practice and complete the adaptive readiness threshold.' }
];

const notifications: AppNotification[] = [
  { id: 'notice-aarav-1', userId: 'demo-aarav', title: 'Readiness milestone reached', body: 'Your last mission improved your overall score to 84.', type: 'MILESTONE', createdAt: ago(1), read: false, href: '/analytics' },
  { id: 'notice-aarav-2', userId: 'demo-aarav', title: 'New adaptive mission available', body: 'A rapid-detection session is recommended from your latest review.', type: 'MISSION', createdAt: ago(0, 5), read: false, href: '/missions/generate' },
  { id: 'notice-kavya-1', userId: 'demo-kavya', title: 'Certification earned', body: 'Simulation Foundations is now available in your skill passport.', type: 'CERTIFICATION', createdAt: ago(20), read: true, href: '/certifications' },
  { id: 'notice-rehan-1', userId: 'demo-rehan', title: 'Instructor feedback', body: 'Focus your next practice on response timing and context checks.', type: 'FEEDBACK', createdAt: ago(2), read: false, href: '/missions/generate' },
  { id: 'notice-mira-1', userId: 'demo-mira', title: 'Advanced certification achieved', body: 'Your digital skill passport has been updated.', type: 'CERTIFICATION', createdAt: ago(2), read: true, href: '/passport' }
];

const scenarios: TrainingScenario[] = [
  { id: 'scenario-border', name: 'Outer Perimeter Echo', environment: 'Border Simulation', scenario: 'Multiple Threats', enabled: true, difficulty: 'INTERMEDIATE', description: 'Abstract contact-awareness exercise across a marked training boundary.' },
  { id: 'scenario-urban', name: 'Urban Signal Trace', environment: 'Urban Simulation', scenario: 'Signal Disruption Simulation', enabled: true, difficulty: 'ADVANCED', description: 'Fictional signal-quality changes in a low-poly urban practice environment.' },
  { id: 'scenario-ridge', name: 'North Ridge Survey', environment: 'Mountain Simulation', scenario: 'Single Threat', enabled: true, difficulty: 'BEGINNER', description: 'Waypoint navigation and situational-awareness fundamentals.' },
  { id: 'scenario-open', name: 'Open Terrain Formation', environment: 'Open Terrain', scenario: 'Swarm Simulation', enabled: true, difficulty: 'EXPERT', description: 'Group-motion awareness with abstract simulated entities.' }
];

const auditLogs: AuditEntry[] = [
  { id: 'audit-01', actorId: 'demo-anika', actorName: 'Anika Kulkarni', action: 'ASSIGNMENT_CREATED', target: 'Rehan Siddiqui', at: ago(1), detail: 'Assigned a response-timing practice recommendation.' },
  { id: 'audit-02', actorId: 'demo-rohan', actorName: 'Rohan Iyer', action: 'REVIEW_VIEWED', target: 'Aarav Mehta', at: ago(2), detail: 'Reviewed mission Adaptive Contact Drill.' },
  { id: 'audit-03', actorId: 'demo-admin', actorName: 'Sana Menon', action: 'SCENARIO_UPDATED', target: 'Outer Perimeter Echo', at: ago(3), detail: 'Training scenario configuration checked.' }
];

export function createSeedDatabase(): LocalDatabase {
  const credentials: Record<string, string> = {};
  users.forEach((u) => { credentials[u.email.toLowerCase()] = demoHash; });
  return {
    version: 1,
    users: structuredClone(users),
    credentials,
    missions: structuredClone(missions),
    missionEvents: missions.flatMap((m) => m.events),
    simulationSessions: [],
    performance: missions.map((item): PerformanceRecord => ({ id: `perf-${item.id}`, userId: item.userId, missionId: item.id, score: item.score ?? 0, categoryScores: item.categoryScores ?? skills(), reactionMs: 1500 + (item.events[0]?.timeElapsed ?? 0) * 7, createdAt: item.completedAt ?? item.createdAt })),
    certifications: structuredClone(certifications),
    notifications: structuredClone(notifications),
    trainingScenarios: structuredClone(scenarios),
    systemSettings: { baselineThreshold: 55, adaptiveDifficulty: true, certificationThreshold: 80, lowGraphicsDefault: false, soundEnabled: false },
    auditLogs: structuredClone(auditLogs),
    pendingSync: [],
    userPreferences: {}
  };
}
