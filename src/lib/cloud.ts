import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { AuditEntry, Certification, LocalDatabase, Mission, PerformanceRecord, SimulationSession, TrainingScenario, UserProfile, SystemSettings, AppNotification, MissionEvent } from '../types';
import { firestore, firebaseConfigured } from './firebaseClient';
import { getDb, removePendingSync, saveProfile } from './store';

function compact<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => compact(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).map(([key, item]) => [key, compact(item)])) as T;
  }
  return value;
}

export async function readCloudProfile(uid: string): Promise<UserProfile | null> {
  if (!firebaseConfigured || !firestore) return null;
  const snap = await getDoc(doc(firestore, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function createCloudProfile(user: User, overrides: Partial<UserProfile> = {}): Promise<UserProfile> {
  const fallback: UserProfile = {
    uid: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'Trainee',
    email: user.email || '',
    photoURL: user.photoURL || undefined,
    role: 'TRAINEE',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    trainingLevel: 'BEGINNER',
    overallScore: 0,
    missionsCompleted: 0,
    certificationStatus: 'NOT STARTED',
    baselineCompleted: false,
    skills: { detection: 50, tracking: 50, navigation: 50, accuracy: 50, reactionTime: 50, decisionMaking: 50, situationalAwareness: 50, objectiveCompletion: 50 },
    averageReactionMs: 0,
    successRate: 0,
    recommendedDifficulty: 'BEGINNER',
    emailVerified: user.emailVerified
  };
  const profile = { ...fallback, ...overrides, uid: user.uid, role: overrides.role ?? 'TRAINEE', emailVerified: user.emailVerified };
  if (firestore) await setDoc(doc(firestore, 'users', user.uid), compact(profile), { merge: true });
  return profile;
}

export async function saveCloudProfile(profile: UserProfile): Promise<void> {
  if (!firebaseConfigured || !firestore || profile.uid.startsWith('demo-')) return;
  await setDoc(doc(firestore, 'users', profile.uid), compact(profile), { merge: true });
}

export async function saveCloudMission(mission: Mission): Promise<void> {
  if (!firebaseConfigured || !firestore || mission.userId.startsWith('demo-')) return;
  const store = firestore;
  const { events, ...missionDocument } = mission;
  await setDoc(doc(store, 'missions', mission.id), compact(missionDocument), { merge: true });
  await Promise.all(events.map((event) => setDoc(doc(store, 'missionEvents', event.id), compact({ ...event, missionId: mission.id, userId: mission.userId }), { merge: true })));
}

export async function saveCloudSession(session: SimulationSession): Promise<void> {
  if (!firebaseConfigured || !firestore || session.userId.startsWith('demo-')) return;
  await setDoc(doc(firestore, 'simulationSessions', session.id), compact(session), { merge: true });
}

export async function saveCloudPerformance(record: PerformanceRecord): Promise<void> {
  if (!firebaseConfigured || !firestore || record.userId.startsWith('demo-')) return;
  await setDoc(doc(firestore, 'performance', record.id), compact(record), { merge: true });
}

export async function saveCloudCertification(certificate: Certification): Promise<void> {
  if (!firebaseConfigured || !firestore || certificate.userId.startsWith('demo-')) return;
  await setDoc(doc(firestore, 'certifications', certificate.id), compact(certificate), { merge: true });
}

export async function saveCloudNotification(notification: AppNotification): Promise<void> {
  if (!firebaseConfigured || !firestore || notification.userId.startsWith('demo-')) return;
  await setDoc(doc(firestore, 'notifications', notification.id), compact(notification), { merge: true });
}

export async function saveCloudScenario(scenario: TrainingScenario): Promise<void> {
  if (!firebaseConfigured || !firestore) return;
  await setDoc(doc(firestore, 'trainingScenarios', scenario.id), compact(scenario), { merge: true });
}

export async function saveCloudSystemSettings(settings: SystemSettings): Promise<void> {
  if (!firebaseConfigured || !firestore) return;
  await setDoc(doc(firestore, 'systemSettings', 'global'), compact(settings), { merge: true });
}

export async function saveCloudAudit(entry: AuditEntry): Promise<void> {
  if (!firebaseConfigured || !firestore) return;
  await setDoc(doc(firestore, 'auditLogs', entry.id), compact(entry), { merge: true });
}

export async function readCloudWorkspace(profile: UserProfile): Promise<Partial<LocalDatabase>> {
  if (!firebaseConfigured || !firestore) return {};
  const store = firestore;
  const uid = profile.uid;
  const staff = profile.role !== 'TRAINEE';
  const readCollection = async <T,>(name: string, ownerField?: string): Promise<T[]> => {
    const reference = collection(store, name);
    const result = ownerField ? await getDocs(query(reference, where(ownerField, '==', uid))) : await getDocs(reference);
    return result.docs.map((snapshot) => snapshot.data() as T);
  };
  const userPromise = staff
    ? readCollection<UserProfile>('users')
    : getDoc(doc(store, 'users', uid)).then((snapshot) => snapshot.exists() ? [snapshot.data() as UserProfile] : []);
  const [users, rawMissions, missionEvents, simulationSessions, performance, certifications, notifications, trainingScenarios] = await Promise.all([
    userPromise,
    readCollection<Mission>('missions', staff ? undefined : 'userId'),
    readCollection<MissionEvent & { missionId: string; userId: string }>('missionEvents', staff ? undefined : 'userId'),
    readCollection<SimulationSession>('simulationSessions', staff ? undefined : 'userId'),
    readCollection<PerformanceRecord>('performance', staff ? undefined : 'userId'),
    readCollection<Certification>('certifications', staff ? undefined : 'userId'),
    readCollection<AppNotification>('notifications', 'userId'),
    readCollection<TrainingScenario>('trainingScenarios')
  ]);
  const eventsByMission = new Map<string, MissionEvent[]>();
  missionEvents.forEach(({ missionId, ...event }) => {
    const events = eventsByMission.get(missionId) ?? [];
    events.push(event);
    eventsByMission.set(missionId, events);
  });
  const missions = rawMissions.map((mission) => ({ ...mission, events: eventsByMission.get(mission.id) ?? mission.events ?? [] }));
  const workspace: Partial<LocalDatabase> = { users, missions, missionEvents, simulationSessions, performance, certifications, notifications, trainingScenarios };
  if (profile.role === 'ADMIN') {
    const [settingsSnap, auditLogs] = await Promise.all([
      getDoc(doc(store, 'systemSettings', 'global')),
      readCollection<AuditEntry>('auditLogs')
    ]);
    if (settingsSnap.exists()) workspace.systemSettings = settingsSnap.data() as SystemSettings;
    workspace.auditLogs = auditLogs;
  }
  return workspace;
}

export async function syncPendingMissions(): Promise<number> {
  if (!firebaseConfigured || !firestore) return 0;
  const db = getDb();
  let synced = 0;
  for (const id of [...db.pendingSync]) {
    const mission = db.missions.find((item) => item.id === id);
    const session = db.simulationSessions.find((item) => item.id === id);
    const performance = db.performance.find((item) => item.id === id);
    const ownerId = mission?.userId ?? session?.userId ?? performance?.userId;
    if (!ownerId || ownerId.startsWith('demo-')) {
      removePendingSync(id);
      continue;
    }
    try {
      if (mission) await saveCloudMission(mission);
      else if (session) await saveCloudSession(session);
      else if (performance) await saveCloudPerformance(performance);
      removePendingSync(id);
      synced += 1;
    } catch (error) {
      console.warn('Training data sync deferred until a connection is available.', error);
      break;
    }
  }
  return synced;
}

export async function saveProfileBoth(profile: UserProfile): Promise<void> {
  saveProfile(profile);
  try { await saveCloudProfile(profile); }
  catch (error) { console.warn('Cloud profile sync will retry when available.', error); }
}
