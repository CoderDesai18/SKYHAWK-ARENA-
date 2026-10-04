import { createSeedDatabase } from './demoData';
import type { AppNotification, AuditEntry, LocalDatabase, Mission, MissionEvent, PerformanceRecord, SimulationSession, UserProfile } from '../types';

const DB_KEY = 'skyhawk-arena:local-db:v1';
const SESSION_KEY = 'skyhawk-arena:session:v1';
let memoryDb: LocalDatabase | null = null;
let memorySession: string | null = null;

export function makeId(prefix = 'id'): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

export function getDb(): LocalDatabase {
  if (typeof window === 'undefined') return memoryDb ?? (memoryDb = createSeedDatabase());
  try {
    const stored = window.localStorage.getItem(DB_KEY);
    if (!stored) {
      const initial = createSeedDatabase();
      window.localStorage.setItem(DB_KEY, JSON.stringify(initial));
      memoryDb = initial;
      return initial;
    }
    const parsed = JSON.parse(stored) as LocalDatabase;
    const seeded = createSeedDatabase();
    const db: LocalDatabase = {
      ...seeded,
      ...parsed,
      users: parsed.users ?? seeded.users,
      credentials: parsed.credentials ?? seeded.credentials,
      missions: parsed.missions ?? seeded.missions,
      missionEvents: parsed.missionEvents ?? parsed.missions?.flatMap((m) => m.events ?? []) ?? seeded.missionEvents,
      simulationSessions: parsed.simulationSessions ?? seeded.simulationSessions,
      performance: parsed.performance ?? seeded.performance,
      certifications: parsed.certifications ?? seeded.certifications,
      notifications: parsed.notifications ?? seeded.notifications,
      trainingScenarios: parsed.trainingScenarios ?? seeded.trainingScenarios,
      systemSettings: { ...seeded.systemSettings, ...parsed.systemSettings },
      auditLogs: parsed.auditLogs ?? seeded.auditLogs,
      pendingSync: parsed.pendingSync ?? [],
      userPreferences: parsed.userPreferences ?? {}
    };
    memoryDb = db;
    return db;
  } catch (error) {
    console.warn('Browser storage is unavailable; keeping training data in memory for this session.', error);
    if (memoryDb) return memoryDb;
    const initial = createSeedDatabase();
    memoryDb = initial;
    return initial;
  }
}

export function saveDb(db: LocalDatabase): void {
  memoryDb = db;
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  catch (error) { console.error('Local save failed. Existing simulator results remain in this session.', error); }
}

export function updateDb<T>(updater: (db: LocalDatabase) => T): T {
  const db = getDb();
  const result = updater(db);
  saveDb(db);
  return result;
}

export function getProfile(uid: string): UserProfile | undefined {
  return getDb().users.find((u) => u.uid === uid);
}

export function saveProfile(profile: UserProfile): void {
  updateDb((db) => {
    const index = db.users.findIndex((u) => u.uid === profile.uid);
    if (index >= 0) db.users[index] = profile;
    else db.users.push(profile);
  });
}

export function saveMission(mission: Mission, queueForCloud = true): void {
  updateDb((db) => {
    const index = db.missions.findIndex((m) => m.id === mission.id);
    if (index >= 0) db.missions[index] = mission;
    else db.missions.unshift(mission);
    db.missionEvents = db.missionEvents.filter((event) => !mission.events.some((incoming) => incoming.id === event.id));
    db.missionEvents.push(...mission.events);
    if (queueForCloud && !db.pendingSync.includes(mission.id)) db.pendingSync.push(mission.id);
  });
}

export function addNotification(notification: AppNotification): void {
  updateDb((db) => { db.notifications.unshift(notification); });
}

export function logAudit(entry: AuditEntry): void {
  updateDb((db) => { db.auditLogs.unshift(entry); });
}

export function setLocalSession(uid: string | null): void {
  memorySession = uid;
  if (typeof window === 'undefined') return;
  try {
    if (uid) window.localStorage.setItem(SESSION_KEY, uid);
    else window.localStorage.removeItem(SESSION_KEY);
  } catch (error) { console.warn('Browser session storage is unavailable; the login lasts for this page session.', error); }
}

export function getLocalSession(): string | null {
  if (typeof window === 'undefined') return memorySession;
  try { return window.localStorage.getItem(SESSION_KEY) ?? memorySession; }
  catch { return memorySession; }
}

export function getLocalValue(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export function setLocalValue(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, value); } catch (error) { console.warn('This browser does not allow local preference storage.', error); }
}

export function isDemoProfile(uid: string): boolean {
  return uid.startsWith('demo-');
}

export function removePendingSync(missionId: string): void {
  updateDb((db) => { db.pendingSync = db.pendingSync.filter((id) => id !== missionId); });
}

export function markNotificationRead(id: string): void {
  updateDb((db) => {
    const notice = db.notifications.find((n) => n.id === id);
    if (notice) notice.read = true;
  });
}

export function appendMissionEvent(missionId: string, event: MissionEvent): Mission | undefined {
  let result: Mission | undefined;
  updateDb((db) => {
    const mission = db.missions.find((m) => m.id === missionId);
    if (!mission) return;
    mission.events.push(event);
    db.missionEvents.push(event);
    result = mission;
  });
  return result;
}

export function getSimulationSession(missionId: string): SimulationSession | undefined {
  return getDb().simulationSessions.find((session) => session.missionId === missionId);
}

export function saveSimulationSession(session: SimulationSession): void {
  updateDb((db) => {
    const index = db.simulationSessions.findIndex((item) => item.missionId === session.missionId);
    if (index >= 0) db.simulationSessions[index] = session;
    else db.simulationSessions.push(session);
    if (!session.userId.startsWith('demo-') && !db.pendingSync.includes(session.id)) db.pendingSync.push(session.id);
  });
}

export function savePerformanceRecord(record: PerformanceRecord): void {
  updateDb((db) => {
    db.performance.unshift(record);
    if (!record.userId.startsWith('demo-')) db.pendingSync.push(record.id);
  });
}
