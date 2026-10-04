import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LocalDatabase } from '../types';
import { useAuth } from './AuthContext';
import { getDb, updateDb } from '../lib/store';
import { readCloudWorkspace, syncPendingMissions } from '../lib/cloud';

interface DataContextShape { db: LocalDatabase; refresh: () => void; online: boolean; syncNow: () => Promise<number>; }
const DataContext = createContext<DataContextShape | null>(null);

function snapshot(): LocalDatabase {
  const db = getDb();
  return { ...db, users: [...db.users], missions: [...db.missions], missionEvents: [...db.missionEvents], simulationSessions: [...db.simulationSessions], performance: [...db.performance], certifications: [...db.certifications], notifications: [...db.notifications], trainingScenarios: [...db.trainingScenarios], auditLogs: [...db.auditLogs], pendingSync: [...db.pendingSync] };
}

function mergeRecords<T>(local: T[], remote: T[], keyOf: (record: T) => string): T[] {
  const merged = new Map(local.map((record) => [keyOf(record), record]));
  remote.forEach((record) => merged.set(keyOf(record), record));
  return [...merged.values()];
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [db, setDb] = useState<LocalDatabase>(() => snapshot());
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const refresh = () => setDb(snapshot());
  const syncNow = async () => {
    const count = await syncPendingMissions();
    refresh();
    return count;
  };
  useEffect(() => {
    if (!user || user.uid.startsWith('demo-')) return;
    let active = true;
    readCloudWorkspace(user).then((remote) => {
      if (!active) return;
      updateDb((local) => {
        if (remote.users) local.users = mergeRecords(local.users, remote.users, (item) => item.uid);
        if (remote.missions) local.missions = mergeRecords(local.missions, remote.missions, (item) => item.id);
        if (remote.missionEvents) local.missionEvents = mergeRecords(local.missionEvents, remote.missionEvents, (item) => item.id);
        if (remote.simulationSessions) local.simulationSessions = mergeRecords(local.simulationSessions, remote.simulationSessions, (item) => item.id);
        if (remote.performance) local.performance = mergeRecords(local.performance, remote.performance, (item) => item.id);
        if (remote.certifications) local.certifications = mergeRecords(local.certifications, remote.certifications, (item) => item.id);
        if (remote.notifications) local.notifications = mergeRecords(local.notifications, remote.notifications, (item) => item.id);
        if (remote.trainingScenarios) local.trainingScenarios = mergeRecords(local.trainingScenarios, remote.trainingScenarios, (item) => item.id);
        if (remote.auditLogs) local.auditLogs = mergeRecords(local.auditLogs, remote.auditLogs, (item) => item.id);
        if (remote.systemSettings) local.systemSettings = { ...local.systemSettings, ...remote.systemSettings };
      });
      refresh();
      void syncPendingMissions().then(refresh);
    }).catch((error) => console.warn('Cloud training records are not available; local training remains usable.', error));
    return () => { active = false; };
  }, [user?.uid, user?.role]);
  useEffect(() => {
    const handleOnline = () => { setOnline(true); void syncPendingMissions().then(refresh); };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const isStandaloneShare = Boolean((window as Window & { __SKYHAWK_STANDALONE__?: boolean }).__SKYHAWK_STANDALONE__) || window.location.protocol === 'file:' || window.location.pathname.toLowerCase().endsWith('skyhawk_arena_share.html');
    if (import.meta.env.PROD && !isStandaloneShare && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Offline shell caching is unavailable.', error));
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);
  const value = useMemo(() => ({ db, refresh, online, syncNow }), [db, online]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextShape {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used inside DataProvider.');
  return context;
}
