import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowDown, ArrowRight, BatteryCharging, Check, ChevronRight, Clock3, Compass, Crosshair, Eye, Flag, Info, Keyboard, Map, Pause, Play, Radio, Radar, Shield, ShieldCheck, Signal, Target, TriangleAlert, WifiOff, X } from 'lucide-react';
import ThreeWorld, { type WorldPosition } from '../components/ThreeWorld';
import { Badge, Button, Card, KeyCap, Modal, ProgressBar, ScoreRing } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { addNotification, getLocalValue, getSimulationSession, logAudit, makeId, saveMission, savePerformanceRecord, saveSimulationSession, updateDb } from '../lib/store';
import { blendedSkills, calculateMissionScores, createMissionEvent, trainingLevelFromScore, eventTimeLabel } from '../lib/missionEngine';
import { createTrainingContacts, type ThreatBehavior } from '../lib/threatEngine';
import { saveCloudCertification, saveCloudMission, saveCloudNotification, saveCloudPerformance, saveCloudSession } from '../lib/cloud';
import type { AppNotification, Certification, Mission, MissionEvent, SimulationSession, SkillKey } from '../types';
import { EMPTY_SKILLS, SKILL_LABELS } from '../types';

const waypoints = [{ x: 0, z: -12, label: 'WP-01 / RIDGE MARKER' }, { x: 10, z: -26, label: 'WP-02 / SURVEY POINT' }];
type ContactState = ReturnType<typeof createTrainingContacts>[number] & { status: SimulationSession['contacts'][number]['status']; available: boolean; reactionMs?: number };

export default function SimulationPage() {
  const { missionId = '' } = useParams();
  const { user } = useAuth();
  const { db } = useData();
  const mission = db.missions.find((item) => item.id === missionId);
  if (!user) return null;
  if (!mission) return <MissionUnavailable />;
  if (mission.userId !== user.uid && user.role === 'TRAINEE') return <MissionUnavailable unauthorized />;
  if (mission.status === 'COMPLETED') return <CompletedRedirect missionId={mission.id} />;
  return <SimulationRunner key={mission.id} mission={mission} />;
}

function CompletedRedirect({ missionId }: { missionId: string }) {
  const navigate = useNavigate();
  useEffect(() => { navigate(`/review/${missionId}`, { replace: true }); }, [navigate, missionId]);
  return <div className="sim-loading"><span className="button-spinner" /> RESTORING AFTER-ACTION REVIEW</div>;
}

function MissionUnavailable({ unauthorized = false }: { unauthorized?: boolean }) {
  const navigate = useNavigate();
  return <div className="sim-unavailable"><div className="sim-unavailable-icon">{unauthorized ? <Shield size={22} /> : <Radio size={22} />}</div><span>{unauthorized ? 'ACCESS RESTRICTED' : 'MISSION UNAVAILABLE'}</span><h1>{unauthorized ? 'This mission belongs to another trainee.' : 'Mission not found.'}</h1><p>{unauthorized ? 'Trainee mission records are private. Return to your command center to continue.' : 'The mission may have been archived or is not stored on this device.'}</p><Button onClick={() => navigate('/dashboard')}>RETURN TO COMMAND CENTER <ArrowRight size={14} /></Button></div>;
}

function SimulationRunner({ mission: initialMission }: { mission: Mission }) {
  const { user, updateUser } = useAuth();
  const { db, online, refresh } = useData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const savedSession = getSimulationSession(initialMission.id);
  const manifest = useMemo(() => createTrainingContacts(initialMission), [initialMission.id]);
  const restoredContactStates: ContactState[] = manifest.map((contact) => {
    const saved = savedSession?.contacts.find((item) => item.id === contact.id);
    const shouldBeAvailable = (savedSession?.elapsedSeconds ?? 0) >= contact.spawnSeconds;
    return { ...contact, status: saved?.status ?? 'UNASSESSED', available: saved?.available ?? shouldBeAvailable, reactionMs: saved?.reactionMs };
  });
  const [position, setPosition] = useState<WorldPosition>(savedSession?.position ?? { x: 0, z: 0, altitude: 60, heading: 0 });
  const positionRef = useRef(position);
  const [activeWaypoint, setActiveWaypoint] = useState(savedSession?.activeWaypoint ?? 0);
  const activeWaypointRef = useRef(activeWaypoint);
  const visitedRef = useRef(new Set<number>(Array.from({ length: savedSession?.activeWaypoint ?? 0 }, (_, index) => index)));
  const [contacts, setContacts] = useState<ContactState[]>(restoredContactStates);
  const contactsRef = useRef<ContactState[]>(restoredContactStates);
  const [selectedContactId, setSelectedContactId] = useState(restoredContactStates.find((item) => item.available)?.id ?? restoredContactStates[0]?.id ?? '');
  const [events, setEvents] = useState<MissionEvent[]>(initialMission.events ?? []);
  const eventsRef = useRef<MissionEvent[]>(initialMission.events ?? []);
  const [replayPath, setReplayPath] = useState(initialMission.replayPath ?? [{ timeElapsed: 0, x: position.x, z: position.z, heading: position.heading }]);
  const replayPathRef = useRef(initialMission.replayPath ?? [{ timeElapsed: 0, x: position.x, z: position.z, heading: position.heading }]);
  const [elapsed, setElapsed] = useState(savedSession?.elapsedSeconds ?? 0);
  const elapsedRef = useRef(savedSession?.elapsedSeconds ?? 0);
  const [running, setRunning] = useState(Boolean(savedSession?.isRunning && initialMission.status === 'IN_PROGRESS'));
  const runningRef = useRef(Boolean(savedSession?.isRunning && initialMission.status === 'IN_PROGRESS'));
  const [countdown, setCountdown] = useState<number | null>(null);
  const [speed, setSpeed] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'OBJECTIVES' | 'EVENTS'>('OBJECTIVES');
  const [keyboardHelp, setKeyboardHelp] = useState(false);
  const [showDisruption, setShowDisruption] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const completingRef = useRef(false);
  const missionStartAtRef = useRef<number>(Date.now() - (savedSession?.elapsedSeconds ?? 0) * 1000);
  const signalEventRef = useRef(false);
  const missionRef = useRef<Mission>(initialMission);
  missionRef.current = { ...missionRef.current, ...initialMission, events: eventsRef.current, replayPath: replayPathRef.current };

  const isOperator = initialMission.role === 'OPERATOR';
  const isVariableScenario = initialMission.scenario === 'Signal Disruption Simulation' || initialMission.scenario === 'Mixed Scenario';
  const selectedContact = contacts.find((contact) => contact.id === selectedContactId) ?? contacts.find((contact) => contact.available) ?? contacts[0];
  const allContactsComplete = contacts.length > 0 && contacts.every((contact) => contact.status === 'RESOLVED' || contact.status === 'DISENGAGED');
  const missionObjectiveComplete = isOperator ? activeWaypoint >= waypoints.length : allContactsComplete;
  const liveResult = calculateMissionScores(events, initialMission.baselineAtStart ?? user?.skills ?? EMPTY_SKILLS);
  const timeLeft = Math.max(0, initialMission.durationSeconds - elapsed);
  const battery = Math.max(12, 100 - Math.floor(elapsed / Math.max(1, initialMission.durationSeconds) * 75));
  const contactBehaviors: ThreatBehavior[] = manifest.map((contact) => contact.behavior);
  const notify = (notification: AppNotification) => { addNotification(notification); void saveCloudNotification(notification).catch((error) => console.warn('Training notification remains local until cloud access is available.', error)); };
  const graphicsQuality = (getLocalValue('skyhawk:graphics') ?? (db.systemSettings.lowGraphicsDefault ? 'LOW' : 'MEDIUM')) as 'LOW' | 'MEDIUM' | 'HIGH';

  const saveSession = (isRunning: boolean, patch: Partial<SimulationSession> = {}) => {
    saveSimulationSession({
      id: `session-${initialMission.id}`, missionId: initialMission.id, userId: initialMission.userId, elapsedSeconds: elapsedRef.current,
      position: positionRef.current, contacts: contactsRef.current.map(({ id, status, available, reactionMs }) => ({ id, status, available, reactionMs })),
      activeWaypoint: activeWaypointRef.current, updatedAt: new Date().toISOString(), isRunning, ...patch
    });
  };

  const persistMission = (patch: Partial<Mission> = {}) => {
    const next = { ...missionRef.current, ...patch, events: eventsRef.current, replayPath: replayPathRef.current };
    missionRef.current = next;
    saveMission(next);
  };

  const addEvent = (event: Omit<MissionEvent, 'id' | 'at'>) => {
    const savedEvent = createMissionEvent({ ...event, timeElapsed: event.timeElapsed ?? elapsedRef.current });
    const nextEvents = [...eventsRef.current, savedEvent];
    eventsRef.current = nextEvents;
    setEvents(nextEvents);
    persistMission({ status: 'IN_PROGRESS', durationSeconds: Math.max(initialMission.durationSeconds, elapsedRef.current) });
    return savedEvent;
  };

  const startSimulation = () => {
    if (!runningRef.current) setCountdown(3);
  };
  const beginRun = () => {
    runningRef.current = true;
    setRunning(true);
    missionStartAtRef.current = Date.now() - elapsedRef.current * 1000;
    persistMission({ status: 'IN_PROGRESS' });
    const existingStart = eventsRef.current.some((event) => event.event === 'Simulation started');
    if (!existingStart) addEvent({ timeElapsed: elapsedRef.current, event: 'Simulation started', action: 'Mission clock started', result: 'Training session active; all entities are simulated.', scoreImpact: 0, categories: [], expected: 'Review the brief, then complete the listed training objectives.', traineeAction: 'Started the simulation.' });
    saveSession(true);
  };

  const completeMission = async (objectivesMet: boolean, early = false) => {
    if (!user || completingRef.current) return;
    completingRef.current = true;
    runningRef.current = false;
    setRunning(false);
    setShowEndConfirm(false);
    const finalEvents = eventsRef.current;
    const scored = calculateMissionScores(finalEvents, initialMission.baselineAtStart ?? user.skills);
    const objectiveEventExists = finalEvents.some((event) => event.event === 'Mission objective completed' || event.event === 'Mission debrief recorded');
    let missionEvents = finalEvents;
    if (!objectiveEventExists) {
      const objectiveEvent = createMissionEvent({
        timeElapsed: elapsedRef.current,
        event: objectivesMet ? 'Mission objective completed' : early ? 'Early debrief recorded' : 'Mission debrief recorded',
        action: objectivesMet ? 'Confirmed objective completion' : 'Ended the training session',
        result: objectivesMet ? 'Mission objectives verified in the simulation.' : 'Session safely closed; incomplete objectives are reflected in scoring.',
        scoreImpact: objectivesMet ? 16 : -3,
        categories: objectivesMet ? ['objectiveCompletion', 'decisionMaking'] : ['objectiveCompletion'],
        expected: objectivesMet ? 'Confirm the objective after each required training step is complete.' : 'Complete the listed objectives before ending the session where possible.',
        traineeAction: objectivesMet ? 'Confirmed the objective after all training steps.' : 'Chose to end the session early.'
      });
      missionEvents = [...finalEvents, objectiveEvent];
      eventsRef.current = missionEvents;
      setEvents(missionEvents);
    }
    const finalScores = calculateMissionScores(missionEvents, initialMission.baselineAtStart ?? user.skills);
    const finalScore = Math.max(0, Math.min(100, finalScores.score));
    const completedAt = new Date().toISOString();
    const completedMission: Mission = { ...missionRef.current, status: 'COMPLETED', completedAt, score: finalScore, categoryScores: finalScores.categoryScores, durationSeconds: elapsedRef.current, events: missionEvents, replayPath: replayPathRef.current };
    missionRef.current = completedMission;
    saveMission(completedMission);
    saveSession(false);
    const priorCount = user.missionsCompleted ?? db.missions.filter((item) => item.userId === user.uid && item.status === 'COMPLETED').length;
    const newCount = priorCount + 1;
    const newOverall = Math.round((user.overallScore * Math.min(priorCount, 7) + finalScore) / (Math.min(priorCount, 7) + 1));
    const newSkills = blendedSkills(user.skills, finalScores.categoryScores);
    const reactionEvents = missionEvents.filter((event) => event.categories.includes('reactionTime') && event.timeElapsed > 0);
    const reactionMs = reactionEvents.length ? Math.max(500, Math.round((reactionEvents[0].timeElapsed || elapsedRef.current) * 1000 / Math.max(1, contacts.length))) : user.averageReactionMs || 1800;
    const newReactionMs = user.averageReactionMs ? Math.round((user.averageReactionMs * priorCount + reactionMs) / (priorCount + 1)) : reactionMs;
    const newSuccessRate = Math.round((user.successRate * priorCount + (finalScore >= 65 ? 100 : 0)) / (priorCount + 1));
    const eligibleForFoundation = newCount >= 3 && newOverall >= db.systemSettings.certificationThreshold;
    const existingFoundation = db.certifications.find((cert) => cert.userId === user.uid && cert.tier === 'FOUNDATION' && cert.status === 'EARNED');
    const certificationStatus = existingFoundation || !eligibleForFoundation ? user.certificationStatus : 'FOUNDATION • EARNED';
    await updateUser({
      overallScore: newOverall, skills: newSkills, trainingLevel: trainingLevelFromScore(newOverall), missionsCompleted: newCount,
      averageReactionMs: newReactionMs, successRate: newSuccessRate, certificationStatus,
      recommendedDifficulty: finalScore >= 88 ? 'ADVANCED' : finalScore >= 68 ? 'INTERMEDIATE' : 'BEGINNER'
    });
    const performanceRecord = { id: makeId('performance'), userId: user.uid, missionId: initialMission.id, score: finalScore, categoryScores: finalScores.categoryScores, reactionMs, createdAt: completedAt };
    savePerformanceRecord(performanceRecord);
    logAudit({ id: makeId('audit'), actorId: user.uid, actorName: user.name, action: 'MISSION_COMPLETED', target: initialMission.title, at: completedAt, detail: `Score ${finalScore} / ${initialMission.difficulty} / ${initialMission.role}.` });
    if (!existingFoundation && eligibleForFoundation) {
      const certificate: Certification = { id: makeId('cert'), userId: user.uid, name: 'Simulation Foundations', tier: 'FOUNDATION', status: 'EARNED', issueDate: completedAt, credentialId: `SHA-26-${user.name.split(' ').map((part) => part[0]).join('').toUpperCase()}-${Math.round(finalScore)}${String(newCount).padStart(2, '0')}`, score: newOverall, description: 'Demonstrated consistent baseline readiness and adaptive training performance in fictional simulation scenarios.' };
      updateDb((state) => { state.certifications.unshift(certificate); });
      void saveCloudCertification(certificate).catch((error) => console.warn('Credential remains local until cloud access is available.', error));
      notify({ id: makeId('notice'), userId: user.uid, title: 'Certification achieved', body: 'Simulation Foundations is now available in your digital skill passport.', type: 'CERTIFICATION', createdAt: completedAt, read: false, href: '/certifications' });
    }
    notify({ id: makeId('notice'), userId: user.uid, title: 'Mission complete', body: `${initialMission.title} scored ${finalScore}. Your next adaptive recommendation is ready.`, type: 'MISSION', createdAt: completedAt, read: false, href: `/review/${initialMission.id}` });
    if (finalScore >= user.overallScore + 5) notify({ id: makeId('notice'), userId: user.uid, title: 'Performance improvement', body: `Your latest mission score improved by ${finalScore - user.overallScore} points over readiness.`, type: 'MILESTONE', createdAt: completedAt, read: false, href: '/analytics' });
    refresh();
    try {
      const finalSession = getSimulationSession(initialMission.id);
      await Promise.all([saveCloudMission(completedMission), saveCloudPerformance(performanceRecord), ...(finalSession ? [saveCloudSession(finalSession)] : [])]);
    } catch (error) { console.warn('Completed mission is stored locally and will sync later.', error); }
    toast(`Mission scored ${finalScore}/100. After-action review is ready.`, finalScore >= 70 ? 'success' : 'info');
    navigate(`/review/${initialMission.id}`);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { setCountdown(null); beginRun(); return; }
    const timer = window.setTimeout(() => setCountdown((current) => current === null ? null : current - 1), 950);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      const next = elapsedRef.current + 1;
      elapsedRef.current = next;
      setElapsed(next);
      const newlyAvailable = contactsRef.current.filter((contact) => !contact.available && contact.spawnSeconds <= next);
      if (newlyAvailable.length) {
        const updated = contactsRef.current.map((contact) => contact.spawnSeconds <= next ? { ...contact, available: true } : contact);
        contactsRef.current = updated;
        setContacts(updated);
        newlyAvailable.forEach((contact) => addEvent({ timeElapsed: next, event: `${contact.callsign} entered training space`, action: 'Simulated contact appeared', result: `${contact.behavior.toLowerCase()} cue is available for practice.`, scoreImpact: 0, categories: [], expected: 'Observe newly available training contacts and complete the mission sequence.', traineeAction: 'Contact was presented by the simulation.' }));
        if (!selectedContactId && updated.length) setSelectedContactId(newlyAvailable[0].id);
      }
      if (isVariableScenario && next >= 18 && next % 28 === 0 && !signalEventRef.current) {
        signalEventRef.current = true; setShowDisruption(true);
        addEvent({ timeElapsed: next, event: 'Simulated signal variance', action: 'Training signal quality changed', result: 'Fictional variance cue added; no real electronic effect is modeled.', scoreImpact: 0, categories: ['situationalAwareness'], expected: 'Note the variance and preserve a clear training context.', traineeAction: 'Reviewed an abstract signal-variance cue.' });
        window.setTimeout(() => setShowDisruption(false), 4600);
      }
      if (next % 4 === 0) {
        const nextPath = [...replayPathRef.current, { timeElapsed: next, x: positionRef.current.x, z: positionRef.current.z, heading: positionRef.current.heading }];
        replayPathRef.current = nextPath; setReplayPath(nextPath);
        persistMission({ status: 'IN_PROGRESS', durationSeconds: initialMission.durationSeconds });
      }
      saveSession(true);
      if (next >= initialMission.durationSeconds) { runningRef.current = false; setRunning(false); setTimeExpired(true); saveSession(false); }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running, initialMission.durationSeconds, initialMission.id, isVariableScenario, selectedContactId]);

  useEffect(() => {
    runningRef.current = running;
    saveSession(running);
  }, [running]);
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { contactsRef.current = contacts; }, [contacts]);
  useEffect(() => { activeWaypointRef.current = activeWaypoint; }, [activeWaypoint]);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { replayPathRef.current = replayPath; }, [replayPath]);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);
  useEffect(() => { setDisplayScore(liveResult.score); }, [liveResult.score]);

  useEffect(() => {
    if (!running || !isOperator) return;
    const onKey = (event: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) return;
      const key = event.key.toLowerCase();
      const step = event.shiftKey ? 1.85 : 1.15;
      let dx = 0; let dz = 0; let altitudeDelta = 0;
      if (key === 'w' || key === 'arrowup') dz = -step;
      else if (key === 's' || key === 'arrowdown') dz = step;
      else if (key === 'a' || key === 'arrowleft') dx = -step;
      else if (key === 'd' || key === 'arrowright') dx = step;
      else if (key === ' ') altitudeDelta = event.shiftKey ? 3 : 1.5;
      else if (key === 'shift') return;
      else return;
      event.preventDefault();
      const current = positionRef.current;
      const next: WorldPosition = { x: Math.max(-70, Math.min(70, current.x + dx)), z: Math.max(-72, Math.min(75, current.z + dz)), altitude: Math.max(24, Math.min(130, current.altitude + altitudeDelta)), heading: dx || dz ? Math.round(Math.atan2(dx, -dz) * 180 / Math.PI) : current.heading };
      positionRef.current = next; setPosition(next); setSpeed(dx || dz ? (event.shiftKey ? 22 : 14) : 0);
      const targetIndex = activeWaypointRef.current;
      if (targetIndex < waypoints.length && !visitedRef.current.has(targetIndex)) {
        const target = waypoints[targetIndex];
        if (Math.hypot(next.x - target.x, next.z - target.z) < 2.8) {
          visitedRef.current.add(targetIndex);
          activeWaypointRef.current = targetIndex + 1; setActiveWaypoint(targetIndex + 1);
          addEvent({ timeElapsed: elapsedRef.current, event: `${target.label.split(' / ')[0]} reached`, action: 'Entered waypoint training radius', result: `Navigation marker ${target.label} verified.`, scoreImpact: 13, categories: ['navigation', 'situationalAwareness'], expected: 'Reach the waypoint with a stable route and verify the marker.', traineeAction: 'Navigated into the marked training radius.', position: { x: next.x, z: next.z } });
        }
      }
      saveSession(true, { position: next });
    };
    window.addEventListener('keydown', onKey, { passive: false });
    return () => window.removeEventListener('keydown', onKey);
  }, [running, isOperator, initialMission.id]);

  const changeContactStatus = (id: string, status: ContactState['status'], reactionMs?: number) => {
    const updated = contactsRef.current.map((contact) => contact.id === id ? { ...contact, status, reactionMs: reactionMs ?? contact.reactionMs } : contact);
    contactsRef.current = updated; setContacts(updated); saveSession(running, { contacts: updated.map(({ id: contactId, status: contactStatus, available, reactionMs: value }) => ({ id: contactId, status: contactStatus, available, reactionMs: value })) });
  };
  const performContactAction = (action: 'DETECT' | 'TRACK' | 'CLASSIFY' | 'RESPOND' | 'DISENGAGE') => {
    if (!selectedContact || !selectedContact.available || !running) return;
    const contact = contactsRef.current.find((item) => item.id === selectedContact.id);
    if (!contact) return;
    const actionMap = {
      DETECT: { required: 'UNASSESSED', next: 'DETECTED', event: 'Simulated contact detected', impact: 13, categories: ['detection', 'situationalAwareness'] as SkillKey[], result: 'Contact acknowledged in the training console.' },
      TRACK: { required: 'DETECTED', next: 'TRACKING', event: 'Tracking sequence started', impact: 12, categories: ['tracking', 'situationalAwareness'] as SkillKey[], result: 'Training track continuity established.' },
      CLASSIFY: { required: 'TRACKING', next: 'CLASSIFIED', event: 'Training class confirmed', impact: 12, categories: ['accuracy', 'decisionMaking'] as SkillKey[], result: contact.isDecoy ? 'Fictional decoy cue correctly held for review.' : 'Simulated class selected from the training context.' },
      RESPOND: { required: 'CLASSIFIED', next: 'RESOLVED', event: 'Simulation response logged', impact: 14, categories: ['decisionMaking', 'reactionTime'] as SkillKey[], result: 'Abstract, simulation-only response recorded. No real-world action is connected.' }
    } as const;
    if (action === 'DISENGAGE') {
      const reactionMs = Math.max(250, Date.now() - missionStartAtRef.current);
      changeContactStatus(contact.id, 'DISENGAGED', reactionMs);
      addEvent({ timeElapsed: elapsedRef.current, event: `${contact.callsign} safely disengaged`, action: 'Selected fictional disengage option', result: 'Training contact closed without a simulated response action.', scoreImpact: 5, categories: ['decisionMaking', 'situationalAwareness'], expected: 'Use the abstract disengage option when the training context calls for safe closure.', traineeAction: 'Logged a simulation-only disengage choice.' });
      return;
    }
    const config = actionMap[action];
    if (contact.status !== config.required) {
      addEvent({ timeElapsed: elapsedRef.current, event: 'Sequence check missed', action: `${action} selected out of sequence`, result: 'The training console kept the contact state unchanged.', scoreImpact: -4, categories: ['decisionMaking', 'accuracy'], expected: `Complete the prior training stage before ${action.toLowerCase()}.`, traineeAction: `Selected ${action.toLowerCase()} before the prior stage was complete.` });
      toast('Training sequence is out of order. Review the contact status.', 'info');
      return;
    }
    const reactionMs = Math.max(250, Date.now() - missionStartAtRef.current);
    changeContactStatus(contact.id, config.next as ContactState['status'], reactionMs);
    addEvent({ timeElapsed: elapsedRef.current, event: config.event, action: `${action} training stage completed`, result: config.result, scoreImpact: config.impact, categories: config.categories, expected: action === 'DETECT' ? 'Acknowledge the cue and compare it with the training context.' : action === 'TRACK' ? 'Maintain a continuous track before selecting a training class.' : action === 'CLASSIFY' ? 'Use confidence and available context to choose an abstract class.' : 'Choose an abstract training response only after completing awareness stages.', traineeAction: `Completed the ${action.toLowerCase()} step in the simulation.` });
    if (action === 'DETECT' && (!user?.averageReactionMs || reactionMs < user.averageReactionMs)) toast('Contact acknowledged. Response interval improved.', 'success');
  };

  const finishObjectives = () => {
    if (!missionObjectiveComplete) return;
    addEvent({ timeElapsed: elapsedRef.current, event: 'Mission objective completed', action: 'Confirmed mission objectives', result: isOperator ? 'Both navigation markers and the abstract survey objective are verified.' : 'All simulated contacts were reviewed and the training objective is complete.', scoreImpact: 16, categories: ['objectiveCompletion', 'decisionMaking'], expected: 'Verify each objective before confirming mission completion.', traineeAction: 'Confirmed all listed simulation objectives.' });
    void completeMission(true);
  };
  const selectedContactActions = selectedContact?.status ?? 'UNASSESSED';
  const canDetect = selectedContact?.available && selectedContactActions === 'UNASSESSED';
  const canTrack = selectedContact?.available && selectedContactActions === 'DETECTED';
  const canClassify = selectedContact?.available && selectedContactActions === 'TRACKING';
  const canRespond = selectedContact?.available && selectedContactActions === 'CLASSIFIED';
  const canDisengage = selectedContact?.available && selectedContactActions !== 'RESOLVED' && selectedContactActions !== 'DISENGAGED';
  const setSelectTab = (tab: 'OBJECTIVES' | 'EVENTS') => setSelectedTab(tab);
  const replayMission = () => navigate(`/review/${initialMission.id}`);

  return <div className={`simulation-stage ${isOperator ? 'operator-stage' : 'defender-stage'}`}>
    <div className="sim-brief-strip"><div className="sim-mission-ident"><span className="sim-mission-icon">{isOperator ? <Radio size={16} /> : <Shield size={16} />}</span><span><small>LIVE TRAINING SIMULATION</small><b>{initialMission.title}</b></span><Badge tone={initialMission.difficulty === 'EXPERT' || initialMission.difficulty === 'ADVANCED' ? 'orange' : 'cyan'}>{initialMission.difficulty}</Badge></div><div className="sim-brief-tags"><span>{initialMission.environment}</span><i /> <span>{initialMission.scenario}</span><i /> <span>{isOperator ? 'OPERATOR COCKPIT' : 'DEFENDER CONSOLE'}</span></div><div className="sim-brief-actions"><span className={`sim-network ${online ? 'online' : 'offline'}`}>{online ? <Signal size={13} /> : <WifiOff size={13} />}{online ? 'ONLINE' : 'OFFLINE'}</span><button className="sim-help-btn" onClick={() => setKeyboardHelp(true)}><Keyboard size={15} /> CONTROLS</button>{running ? <button className="sim-pause-btn" onClick={() => { runningRef.current = false; setRunning(false); saveSession(false); toast('Simulation paused. Progress is saved locally.', 'info'); }}><Pause size={14} /> PAUSE</button> : <button className="sim-start-btn" onClick={startSimulation} disabled={timeExpired}><Play size={14} /> {elapsed > 0 ? 'RESUME' : 'START'} SIM</button>}</div></div>
    {!online && <div className="offline-banner"><WifiOff size={14} /> OFFLINE MODE — this simulation continues locally. Results will sync when connectivity returns.</div>}
    <div className="simulation-content">
      <section className="sim-world-panel"><ThreeWorld mode={isOperator ? 'operator' : 'defender'} position={position} threatCount={initialMission.threatCount} threatBehaviors={contactBehaviors} waypoints={isOperator ? waypoints : []} activeWaypoint={activeWaypoint} quality={graphicsQuality} seed={initialMission.seed} className="training-world" />
        <div className="world-top-hud"><div className="world-weather-tag"><span className="sunny-dot" /> {initialMission.environment.toUpperCase()} <i /> DAY / LOW HAZE</div><div className="world-hud-right"><span className="sim-score-live"><small>LIVE SCORE</small><b>{displayScore}<i>/100</i></b></span><span className="sim-timer-live"><small>MISSION CLOCK</small><b className={timeLeft < 45 ? 'timer-warning' : ''}>{eventTimeLabel(timeLeft)}</b></span></div></div>
        <div className="world-left-hud"><div className="world-hud-title"><span>TRAINING ZONE / 04</span><span className="world-hud-dot" /></div><div className="world-coord"><span>POSITION</span><b>{position.x.toFixed(1)} <i>/</i> {position.z.toFixed(1)}</b><small>SIM GRID / LOCAL</small></div><div className="world-compass"><span className="compass-arrow" style={{ transform: `rotate(${position.heading}deg)` }}><ArrowDown size={17} /></span><span><small>HEADING</small><b>{String(Math.round((position.heading + 360) % 360)).padStart(3, '0')}°</b></span></div></div>
        {isOperator && <div className="operator-telemetry"><Telemetry label="ALTITUDE" value={position.altitude.toFixed(0)} unit="M" icon={ArrowDown} /><Telemetry label="SPEED" value={speed.toString().padStart(2, '0')} unit="M/S" icon={Activity} /><Telemetry label="BATTERY" value={battery.toString()} unit="%" icon={BatteryCharging} meter={battery} /></div>}
        {isOperator && <div className="world-waypoint-callout"><span className="waypoint-ping"><Target size={14} /></span><span><small>NEXT WAYPOINT</small><b>{activeWaypoint < waypoints.length ? waypoints[activeWaypoint].label : 'SURVEY OBJECTIVE'}</b></span><span className="wp-index">{Math.min(activeWaypoint + 1, 2)} / 2</span></div>}
        {!isOperator && <div className="world-contact-callout"><span className="contact-ping"><Radio size={14} /></span><span><small>SIMULATED CONTACTS</small><b>{contacts.filter((contact) => contact.available && contact.status !== 'RESOLVED' && contact.status !== 'DISENGAGED').length} ACTIVE / {contacts.length} TOTAL</b></span><span className="sim-contact-alert">ABSTRACT</span></div>}
        {showDisruption && <div className="signal-variance-overlay"><TriangleAlert size={15} /><span>SIMULATED SIGNAL VARIANCE</span><small>TRAINING CUE ONLY</small></div>}
        {countdown !== null && <div className="mission-countdown"><span>SIMULATION STARTS IN</span><b>{countdown}</b><small>STAND BY</small></div>}
        {!running && countdown === null && !timeExpired && <div className="sim-paused-overlay"><div className="pause-card"><span className="pause-card-icon"><Play size={19} /></span><span className="panel-overline">{elapsed > 0 ? 'SESSION PAUSED' : 'MISSION BRIEFING'}</span><h2>{elapsed > 0 ? 'Resume your simulation.' : 'Ready to enter the arena?'}</h2><p>{initialMission.objective}</p><div className="pause-brief-meta"><span><Clock3 size={13} /> {Math.ceil(initialMission.durationSeconds / 60)} MIN WINDOW</span><span><Radio size={13} /> {initialMission.threatCount} ABSTRACT CONTACTS</span></div><Button size="lg" onClick={startSimulation}><Play size={15} /> {elapsed > 0 ? 'RESUME SIMULATION' : 'BEGIN SIMULATION'} <ArrowRight size={14} /></Button></div></div>}
        {timeExpired && !missionObjectiveComplete && <div className="sim-expired-banner"><Clock3 size={16} /><span>MISSION WINDOW COMPLETE</span><Button size="sm" onClick={() => setShowEndConfirm(true)}>END &amp; REVIEW <ArrowRight size={13} /></Button></div>}
        {running && <button className="sim-end-early" onClick={() => setShowEndConfirm(true)}>END SESSION <X size={13} /></button>}
        {running && isOperator && <div className="sim-key-hint"><span>FLIGHT CONTROLS</span><KeyCap>W</KeyCap><KeyCap>A</KeyCap><KeyCap>S</KeyCap><KeyCap>D</KeyCap><span className="key-hint-mouse">MOUSE / LOOK</span></div>}
        <div className="world-corner-status"><span><span className="corner-dot" /> 3D TERRAIN / {graphicsQuality}</span><span>SIMULATION-ONLY DATA</span></div>
      </section>
      <aside className="sim-console-column">
        {!isOperator ? <DefenderConsole contacts={contacts} selectedId={selectedContactId} onSelect={setSelectedContactId} onAction={performContactAction} canDetect={Boolean(canDetect)} canTrack={Boolean(canTrack)} canClassify={Boolean(canClassify)} canRespond={Boolean(canRespond)} canDisengage={Boolean(canDisengage)} running={running} /> : <OperatorConsole mission={initialMission} activeWaypoint={activeWaypoint} position={position} complete={missionObjectiveComplete} onComplete={finishObjectives} running={running} />}
        <Card className="sim-side-card sim-task-card"><div className="sim-card-tabs"><button className={selectedTab === 'OBJECTIVES' ? 'sim-tab-active' : ''} onClick={() => setSelectTab('OBJECTIVES')}>OBJECTIVES <span>{isOperator ? activeWaypoint : contacts.filter((contact) => contact.status === 'RESOLVED' || contact.status === 'DISENGAGED').length}/{isOperator ? 3 : contacts.length}</span></button><button className={selectedTab === 'EVENTS' ? 'sim-tab-active' : ''} onClick={() => setSelectTab('EVENTS')}>EVENTS <span>{events.length}</span></button></div>
          {selectedTab === 'OBJECTIVES' ? <div className="sim-objective-list">{initialMission.objectives.map((objective, index) => { const complete = isOperator ? index < activeWaypoint : index === 0 ? contacts.some((contact) => contact.status !== 'UNASSESSED') : index === 1 ? contacts.some((contact) => contact.status === 'CLASSIFIED' || contact.status === 'RESOLVED' || contact.status === 'DISENGAGED') : allContactsComplete; return <div key={objective} className={`sim-objective-item ${complete ? 'objective-done' : ''}`}><span>{complete ? <Check size={12} /> : String(index + 1).padStart(2, '0')}</span><p>{objective}</p></div>; })}{missionObjectiveComplete && <Button size="sm" className="objective-finish-btn" onClick={finishObjectives} disabled={!running}><Check size={13} /> COMPLETE MISSION &amp; DEBRIEF</Button>}</div> : <div className="sim-event-feed">{events.length ? [...events].slice(-6).reverse().map((event) => <div className="sim-feed-event" key={event.id}><span className="sim-feed-time">{eventTimeLabel(event.timeElapsed)}</span><span className="sim-feed-dot" /><span><b>{event.event}</b><small>{event.result}</small></span></div>) : <div className="sim-feed-empty"><Clock3 size={15} /> Events appear here as you train.</div>}</div>}
        </Card>
        <div className="sim-score-strip"><span className="sim-score-icon"><Activity size={15} /></span><span><small>LIVE PERFORMANCE</small><b>{displayScore}<i>/100</i></b></span><div className="sim-score-progress"><ProgressBar value={displayScore} color={displayScore < 60 ? 'orange' : displayScore >= 85 ? 'green' : 'cyan'} /></div></div>
        <div className="sim-safety-note"><ShieldCheck size={13} /><span>ALL CONTACTS AND RESPONSES ARE FICTIONAL. NO REAL-WORLD SYSTEMS CONNECTED.</span></div>
      </aside>
    </div>
    <div className="mobile-sim-notice"><Info size={15} /><span>This 3D simulation is optimized for a laptop or larger screen. Use landscape orientation for mobile.</span></div>
    {showEndConfirm && <Modal title="End this training session?" subtitle="Your event log and current mission state are saved locally." onClose={() => setShowEndConfirm(false)}><div className="confirm-panel"><span className="confirm-warning"><AlertTriangle size={18} /></span><p>{missionObjectiveComplete ? 'Your objectives are ready for review.' : 'Incomplete objectives may reduce your score. You can keep training or end with an early debrief.'}</p><div className="modal-actions"><Button variant="secondary" onClick={() => setShowEndConfirm(false)}>KEEP TRAINING</Button><Button onClick={() => void completeMission(missionObjectiveComplete, true)}>END &amp; OPEN REVIEW <ArrowRight size={14} /></Button></div></div></Modal>}
    {keyboardHelp && <Modal title="Simulation controls" subtitle={isOperator ? 'Operator cockpit · keyboard movement and mouse look' : 'Defender console · select contacts and log abstract training actions'} onClose={() => setKeyboardHelp(false)} size="lg"><div className="controls-modal-grid">{isOperator ? <><div className="control-group"><span>MOVE</span><div className="key-grid"><KeyCap>W</KeyCap><KeyCap>A</KeyCap><KeyCap>S</KeyCap><KeyCap>D</KeyCap></div><small>WASD or arrow keys / move through the 3D practice terrain.</small></div><div className="control-group"><span>ALTITUDE</span><KeyCap>SPACE</KeyCap><small>Change simulated altitude. Hold Shift for an expanded practice adjustment.</small></div><div className="control-group"><span>CAMERA</span><span className="mouse-icon"><Eye size={18} /> MOUSE</span><small>Move the pointer over the 3D viewport to look around.</small></div><div className="control-group"><span>OBJECTIVE</span><span className="mouse-icon"><Target size={18} /> WAYPOINTS</span><small>Navigate to the cyan markers, then confirm the survey objective.</small></div></> : <><div className="control-group"><span>SELECT CONTACT</span><span className="mouse-icon"><Radio size={18} /> CONTACT CARD</span><small>Choose a training contact from the list in the console.</small></div><div className="control-group"><span>TRAINING STAGES</span><span className="mouse-icon"><Crosshair size={18} /> DETECT → TRACK</span><small>Move through each abstract stage in sequence.</small></div><div className="control-group"><span>CLASSIFY / RESPOND</span><span className="mouse-icon"><ShieldCheck size={18} /> FICTIONAL</span><small>Classifications and responses are simulated and non-operational.</small></div><div className="control-group"><span>SAFE EXIT</span><span className="mouse-icon"><X size={18} /> DISENGAGE</span><small>Record a safe training closure at any stage.</small></div></>}</div><div className="modal-actions"><Button onClick={() => setKeyboardHelp(false)}>GOT IT <Check size={14} /></Button></div></Modal>}
  </div>;
}

function Telemetry({ label, value, unit, icon: Icon, meter }: { label: string; value: string; unit: string; icon: typeof BatteryCharging; meter?: number }) {
  return <div className="telemetry-item"><Icon size={13} /><span className="telemetry-reading"><small>{label}</small><b>{value}<i>{unit}</i></b>{meter !== undefined && <ProgressBar value={meter} color={meter < 35 ? 'orange' : 'cyan'} />}</span></div>;
}

function RadarScope({ contacts, selectedId }: { contacts: ContactState[]; selectedId: string }) {
  return <div className="radar-scope"><svg viewBox="0 0 220 220" role="img" aria-label="Abstract simulated contact radar"><defs><radialGradient id="radarGlow"><stop offset="0" stopColor="#15424a" stopOpacity=".55" /><stop offset="1" stopColor="#07121a" stopOpacity=".08" /></radialGradient><clipPath id="radarClip"><circle cx="110" cy="110" r="100" /></clipPath></defs><circle cx="110" cy="110" r="100" fill="url(#radarGlow)" stroke="#31505b" strokeWidth="1" /><g stroke="#29434c" strokeWidth=".8" fill="none"><circle cx="110" cy="110" r="73" /><circle cx="110" cy="110" r="46" /><circle cx="110" cy="110" r="20" /><path d="M10 110h200M110 10v200M39 39l142 142M181 39 39 181" /></g><path d="M110 110 L110 11 A99 99 0 0 1 180 40 Z" fill="#55e0e9" opacity=".13" className="radar-sweep-sector" /><g clipPath="url(#radarClip)">{contacts.filter((contact) => contact.available).map((contact, index) => { const angle = (index * 62 + 28) * Math.PI / 180; const radius = 27 + (index % 3) * 23; const x = 110 + Math.cos(angle) * radius; const y = 110 + Math.sin(angle) * radius; const selected = contact.id === selectedId; const resolved = contact.status === 'RESOLVED' || contact.status === 'DISENGAGED'; return <g key={contact.id} className={selected ? 'radar-contact-selected' : ''}><circle cx={x} cy={y} r={selected ? 8 : 5.5} fill={resolved ? '#62cd96' : contact.isDecoy ? '#f4a259' : '#ee7471'} opacity={resolved ? .7 : .95} /><circle cx={x} cy={y} r={selected ? 13 : 10} fill="none" stroke={resolved ? '#62cd96' : contact.isDecoy ? '#f4a259' : '#ee7471'} opacity=".48" /></g>; })}</g><circle cx="110" cy="110" r="2.5" fill="#65dce4" /><text x="110" y="9" textAnchor="middle">N</text><text x="215" y="113" textAnchor="end">E</text></svg><span className="radar-caption">SIMULATED CONTACT FIELD</span></div>;
}

function DefenderConsole({ contacts, selectedId, onSelect, onAction, canDetect, canTrack, canClassify, canRespond, canDisengage, running }: { contacts: ContactState[]; selectedId: string; onSelect: (id: string) => void; onAction: (action: 'DETECT' | 'TRACK' | 'CLASSIFY' | 'RESPOND' | 'DISENGAGE') => void; canDetect: boolean; canTrack: boolean; canClassify: boolean; canRespond: boolean; canDisengage: boolean; running: boolean }) {
  const selected = contacts.find((contact) => contact.id === selectedId);
  const statusLabel = (status: ContactState['status']) => status === 'UNASSESSED' ? 'UNASSESSED' : status === 'TRACKING' ? 'TRACKING' : status;
  return <Card className="defender-console-card"><div className="defender-console-head"><div><div className="panel-overline">DEFENDER CONSOLE / SIM-ONLY</div><h3>Contact awareness</h3></div><span className="console-alert"><i /> {contacts.filter((contact) => contact.available && contact.status !== 'RESOLVED' && contact.status !== 'DISENGAGED').length} ACTIVE</span></div><RadarScope contacts={contacts} selectedId={selectedId} /><div className="radar-legend"><span><i className="legend-threat" /> UNASSESSED</span><span><i className="legend-resolved" /> REVIEWED</span></div><div className="contact-list-head"><span>TRAINING CONTACTS</span><span>STATE / PATTERN</span></div><div className="contact-list">{contacts.map((contact) => <button key={contact.id} disabled={!contact.available} className={`contact-row ${selectedId === contact.id ? 'contact-selected' : ''} ${!contact.available ? 'contact-pending' : ''}`} onClick={() => onSelect(contact.id)}><span className={`contact-state-dot contact-${contact.status.toLowerCase()}`} /><span className="contact-main"><b>{contact.callsign}</b><small>{contact.available ? contact.behavior.toLowerCase() : `ETA ${eventTimeLabel(contact.spawnSeconds)}`}</small></span><span className="contact-state-label">{contact.available ? statusLabel(contact.status).replace('_', ' ') : 'PENDING'}</span><ChevronRight size={13} /></button>)}</div><div className="contact-selected-detail"><div><span>SELECTED / {selected?.callsign ?? '—'}</span><Badge tone={selected?.isDecoy ? 'orange' : 'cyan'}>{selected?.isDecoy ? 'FICTIONAL DECOY CUE' : 'SIMULATED ENTITY'}</Badge></div><p>{selected?.available ? selected?.status === 'UNASSESSED' ? 'A training cue is present. Start with a detection acknowledgement.' : selected?.status === 'DETECTED' ? 'Contact acknowledged. Continue with the tracking stage.' : selected?.status === 'TRACKING' ? 'Track held. Review context before choosing a class.' : selected?.status === 'CLASSIFIED' ? 'Training class recorded. Select a simulation-only response or disengage.' : 'This contact training sequence is closed.' : 'This contact has not entered the training space yet.'}</p></div><div className="defender-action-grid"><button disabled={!running || !canDetect} onClick={() => onAction('DETECT')} className={`console-action action-detect ${canDetect && running ? 'action-ready' : ''}`}><Radar size={15} /> DETECT <small>ACKNOWLEDGE</small></button><button disabled={!running || !canTrack} onClick={() => onAction('TRACK')} className={`console-action action-track ${canTrack && running ? 'action-ready' : ''}`}><Crosshair size={15} /> TRACK <small>CONTINUITY</small></button><button disabled={!running || !canClassify} onClick={() => onAction('CLASSIFY')} className={`console-action action-classify ${canClassify && running ? 'action-ready' : ''}`}><ShieldCheck size={15} /> CLASSIFY <small>TRAINING CLASS</small></button><button disabled={!running || !canRespond} onClick={() => onAction('RESPOND')} className={`console-action action-respond ${canRespond && running ? 'action-ready' : ''}`}><Activity size={15} /> RESPOND <small>SIMULATION ONLY</small></button></div><button className="disengage-action" disabled={!running || !canDisengage} onClick={() => onAction('DISENGAGE')}><X size={13} /> DISENGAGE / SAFE TRAINING EXIT</button><div className="console-sequence"><span>TRAINING SEQUENCE</span><div>{['DETECT', 'TRACK', 'CLASSIFY', 'RESPOND'].map((label, index) => <span key={label} className={`${selected && ['DETECTED', 'TRACKING', 'CLASSIFIED', 'RESOLVED'].includes(selected.status) && index <= ['DETECTED', 'TRACKING', 'CLASSIFIED', 'RESOLVED'].indexOf(selected.status) ? 'sequence-complete' : ''}`}>{index + 1} {label}</span>)}</div></div></Card>;
}

function OperatorConsole({ mission, activeWaypoint, position, complete, onComplete, running }: { mission: Mission; activeWaypoint: number; position: WorldPosition; complete: boolean; onComplete: () => void; running: boolean }) {
  const current = activeWaypoint < waypoints.length ? waypoints[activeWaypoint] : null;
  const distance = current ? Math.round(Math.hypot(position.x - current.x, position.z - current.z)) : 0;
  return <Card className="operator-console-card"><div className="operator-console-head"><div><div className="panel-overline">OPERATOR COCKPIT / WAYPOINTS</div><h3>Route practice</h3></div><Badge tone="cyan">NAVIGATION</Badge></div><div className="operator-objective-box"><span className="operator-objective-icon"><Target size={18} /></span><span><small>PRIMARY OBJECTIVE</small><b>{mission.objective}</b></span></div><div className="operator-waypoint-list">{waypoints.map((waypoint, index) => <div key={waypoint.label} className={`operator-waypoint ${index < activeWaypoint ? 'waypoint-done' : index === activeWaypoint ? 'waypoint-current' : ''}`}><span className="waypoint-step">{index < activeWaypoint ? <Check size={13} /> : String(index + 1).padStart(2, '0')}</span><span><b>{waypoint.label}</b><small>{index < activeWaypoint ? 'MARKER VERIFIED' : index === activeWaypoint ? `${distance}M / SIM GRID DISTANCE` : 'UPCOMING MARKER'}</small></span><span className="waypoint-state">{index < activeWaypoint ? 'DONE' : index === activeWaypoint ? 'NEXT' : 'WAIT'}</span></div>)}</div><div className="operator-altitude-note"><Compass size={15} /><span>Maintain awareness of the route marker and surrounding terrain. Camera look follows the pointer.</span></div><Button className="operator-complete-btn" onClick={onComplete} disabled={!complete || !running}>{complete ? <><Check size={14} /> CONFIRM SURVEY &amp; COMPLETE</> : <>WAYPOINTS REMAINING <span>{Math.max(0, 2 - activeWaypoint)}</span></>}</Button><div className="operator-controls-hint"><span><Keyboard size={13} /> WASD / ARROWS</span><span><span className="keycap-small">SPACE</span> ALTITUDE</span></div></Card>;
}

