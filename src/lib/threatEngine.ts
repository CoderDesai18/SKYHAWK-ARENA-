import type { Mission } from '../types';

export type ThreatBehavior = 'PATROL' | 'WAYPOINT' | 'EVASIVE DRIFT' | 'GROUP MOTION' | 'FORMATION' | 'DIRECTION CHANGE' | 'DECOY CUE' | 'SIGNAL VARIANCE';
export interface TrainingContact { id: string; callsign: string; behavior: ThreatBehavior; spawnSeconds: number; isDecoy: boolean; confidence: number; }

const behaviorSets: Record<string, ThreatBehavior[]> = {
  'Single Threat': ['PATROL'],
  'Multiple Threats': ['PATROL', 'WAYPOINT', 'DIRECTION CHANGE'],
  'Swarm Simulation': ['GROUP MOTION', 'FORMATION', 'EVASIVE DRIFT', 'DECOY CUE', 'PATROL'],
  'Signal Disruption Simulation': ['PATROL', 'SIGNAL VARIANCE', 'WAYPOINT', 'DECOY CUE'],
  'Mixed Scenario': ['WAYPOINT', 'GROUP MOTION', 'DIRECTION CHANGE', 'EVASIVE DRIFT', 'DECOY CUE']
};

export function createTrainingContacts(mission: Mission): TrainingContact[] {
  const patterns = behaviorSets[mission.scenario] ?? behaviorSets['Multiple Threats'];
  return Array.from({ length: Math.max(1, Math.min(5, mission.threatCount)) }, (_, index) => {
    const behavior = patterns[(index + (mission.seed % patterns.length)) % patterns.length];
    const isDecoy = behavior === 'DECOY CUE';
    return { id: `contact-${index + 1}`, callsign: `ECHO-${String(index + 1).padStart(2, '0')}`, behavior, spawnSeconds: index === 0 ? 0 : 8 + index * 12, isDecoy, confidence: 72 + ((mission.seed + index * 9) % 24) };
  });
}

export function sampleTrainingContact(behavior: ThreatBehavior, index: number, time: number, seed = 1): { x: number; y: number; z: number } {
  const phase = (seed % 31) * .07 + index * 1.82;
  const radius = 17 + index * 5.1;
  const t = time * (.16 + index * .028);
  let x = Math.sin(t + phase) * radius + (index - 2) * 2.2;
  let z = Math.cos(t + phase) * radius * .66 - 7;
  if (behavior === 'WAYPOINT') { x = Math.sin(t * .55 + phase) * radius * .77; z = Math.sin(t * .31 + phase) * 17 - 13; }
  if (behavior === 'EVASIVE DRIFT') { x += Math.sin(time * .92 + phase) * 4.5; z += Math.cos(time * .68 + phase) * 3.2; }
  if (behavior === 'GROUP MOTION' || behavior === 'FORMATION') { x = Math.sin(t + phase) * (radius * .48) + index * 1.65; z = Math.cos(t + phase) * (radius * .35) - 9 + index * 1.25; }
  if (behavior === 'DIRECTION CHANGE') { const turn = Math.sin(time * .19 + phase) > .2 ? 1 : -1; x = Math.sin(t * turn + phase) * radius; z = Math.cos(t * turn + phase) * radius * .58 - 5; }
  if (behavior === 'DECOY CUE') { x += Math.sin(time * 1.8 + phase) * 1.3; z += Math.cos(time * 1.55 + phase) * 1.1; }
  return { x, y: 4.6 + Math.sin(time * .75 + phase) * .9, z };
}

export function behaviorLabel(behavior: ThreatBehavior): string {
  const descriptions: Record<ThreatBehavior, string> = {
    PATROL: 'predictable route loop', WAYPOINT: 'waypoint path', 'EVASIVE DRIFT': 'nonlinear drift', 'GROUP MOTION': 'group movement',
    FORMATION: 'formation motion', 'DIRECTION CHANGE': 'direction-change cue', 'DECOY CUE': 'fictional decoy cue', 'SIGNAL VARIANCE': 'simulated signal variance'
  };
  return descriptions[behavior];
}
