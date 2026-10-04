import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarClock, CheckCircle2, Clock3, FileClock, Map, Radio, RotateCcw, Search, Shield, Sparkles, Target } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { saveMission } from '../lib/store';
import { Badge, Button, Card, EmptyState, PageHeading, PageTransition } from '../components/ui';
import type { Mission } from '../types';

const toneFor = (difficulty: string) => difficulty === 'EXPERT' || difficulty === 'ADVANCED' ? 'orange' : difficulty === 'INTERMEDIATE' ? 'cyan' : 'green';
const dateText = (date: string) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function MissionLibrary() {
  const { user } = useAuth();
  const { db, refresh } = useData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'ALL' | 'READY' | 'COMPLETED'>('ALL');
  const [search, setSearch] = useState('');
  const missions = useMemo(() => db.missions.filter((mission) => mission.userId === user?.uid).filter((mission) => filter === 'ALL' || mission.status === filter).filter((mission) => mission.title.toLowerCase().includes(search.toLowerCase()) || mission.environment.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db.missions, user?.uid, filter, search]);
  if (!user) return null;
  const start = (mission: Mission) => { if (!user.baselineCompleted) { navigate('/assessment'); return; } navigate(`/simulation/${mission.id}`); };
  const abandon = (mission: Mission) => { saveMission({ ...mission, status: 'ABANDONED' }); refresh(); toast('Mission moved to archived sessions.', 'info'); };
  return <PageTransition><PageHeading eyebrow="MISSION SYSTEM / TRAINING LOG" title="Mission library" description="Review generated briefs, resume ready sessions, and inspect completed training." action={<Button onClick={() => navigate(user.baselineCompleted ? '/missions/generate' : '/assessment')}><Sparkles size={15} /> {user.baselineCompleted ? 'GENERATE MISSION' : 'COMPLETE BASELINE'}</Button>} />
    <div className="mission-library-stats"><div><span>ALL SESSIONS</span><b>{db.missions.filter((item) => item.userId === user.uid).length}</b></div><div><span>READY TO LAUNCH</span><b>{db.missions.filter((item) => item.userId === user.uid && item.status === 'READY').length}</b></div><div><span>COMPLETED</span><b>{db.missions.filter((item) => item.userId === user.uid && item.status === 'COMPLETED').length}</b></div><div><span>RECORDED EVENTS</span><b>{db.missionEvents.filter((event) => db.missions.some((item) => item.userId === user.uid && item.events.some((e) => e.id === event.id))).length}</b></div></div>
    <Card className="mission-library-card"><div className="library-toolbar"><div className="filter-tabs">{(['ALL', 'READY', 'COMPLETED'] as const).map((item) => <button key={item} className={filter === item ? 'filter-tab filter-tab-active' : 'filter-tab'} onClick={() => setFilter(item)}>{item}<span>{item === 'ALL' ? db.missions.filter((m) => m.userId === user.uid).length : db.missions.filter((m) => m.userId === user.uid && m.status === item).length}</span></button>)}</div><label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search missions" /></label></div>
      {missions.length ? <div className="mission-list">{missions.map((mission) => <MissionRow key={mission.id} mission={mission} onStart={() => start(mission)} onReview={() => navigate(`/review/${mission.id}`)} onArchive={() => abandon(mission)} />)}</div> : <EmptyState icon={Radio} title="No sessions found" body={search ? 'Try a different search term or switch the filter.' : 'Generate an adaptive mission to begin building your training history.'} action={<Button size="sm" onClick={() => navigate('/missions/generate')}>GENERATE MISSION <ArrowRight size={13} /></Button>} />}
    </Card>
  </PageTransition>;
}

function MissionRow({ mission, onStart, onReview, onArchive }: { mission: Mission; onStart: () => void; onReview: () => void; onArchive: () => void }) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const statusTone = mission.status === 'COMPLETED' ? 'green' : mission.status === 'READY' || mission.status === 'IN_PROGRESS' ? 'cyan' : 'muted';
  return <div className="mission-row"><div className="mission-row-icon">{mission.role === 'OPERATOR' ? <Radio size={18} /> : <Shield size={18} />}</div><div className="mission-row-main"><div className="mission-row-title"><h3>{mission.title}</h3><Badge tone={statusTone} dot>{mission.status.replace('_', ' ')}</Badge>{mission.score !== undefined && <span className="mission-row-score">{mission.score}<small>/100</small></span>}</div><div className="mission-row-meta"><span><Map size={13} /> {mission.environment}</span><span><Shield size={13} /> {mission.role}</span><Badge tone={toneFor(mission.difficulty)}>{mission.difficulty}</Badge><span><CalendarClock size={13} /> {dateText(mission.createdAt)}</span></div><p>{mission.objective}</p></div><div className="mission-row-actions">{mission.status === 'READY' || mission.status === 'IN_PROGRESS' ? <><Button size="sm" onClick={onStart}>{mission.status === 'IN_PROGRESS' ? 'RESUME' : 'START MISSION'} <ArrowRight size={13} /></Button><button className="small-action" onClick={() => setConfirmArchive((value) => !value)}>{confirmArchive ? 'CANCEL' : 'ARCHIVE'}</button>{confirmArchive && <button className="small-action small-action-danger" onClick={onArchive}>CONFIRM ARCHIVE</button>}</> : mission.status === 'COMPLETED' ? <Button variant="secondary" size="sm" onClick={onReview}><FileClock size={14} /> REVIEW &amp; REPLAY</Button> : <Badge>ARCHIVED</Badge>}</div></div>;
}

export function ReplayLibrary() {
  const { user } = useAuth();
  const { db } = useData();
  const navigate = useNavigate();
  if (!user) return null;
  const completed = db.missions.filter((mission) => mission.userId === user.uid && mission.status === 'COMPLETED').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  return <PageTransition><PageHeading eyebrow="MISSION RECORDS / REPLAY" title="Replay archive" description="Open an after-action replay, move along the event timeline, and inspect recorded simulation actions." action={<Badge tone="cyan">{completed.length} RECORDINGS</Badge>} />
    <Card className="replay-library-card"><div className="replay-library-head"><div><span className="panel-overline">LOCAL TRAINING ARCHIVE</span><h2>Completed sessions</h2><p>Mission events and replay points are stored on this device and sync when connected.</p></div><span className="replay-icon"><RotateCcw size={20} /></span></div>
      {completed.length ? <div className="replay-card-grid">{completed.map((mission) => <div className="replay-mission-card" key={mission.id}><div className="replay-card-top"><span className="replay-small-icon"><FileClock size={15} /></span><Badge tone={toneFor(mission.difficulty)}>{mission.difficulty}</Badge></div><h3>{mission.title}</h3><p>{mission.environment} · {mission.role} mode</p><div className="replay-card-meta"><span><Clock3 size={13} /> {Math.floor((mission.durationSeconds || 0) / 60)}m session</span><span><Target size={13} /> {mission.events.length} events</span></div><div className="replay-card-score"><span>OVERALL SCORE</span><b>{mission.score}<small>/100</small></b></div><Button variant="secondary" size="sm" onClick={() => navigate(`/review/${mission.id}`)}>OPEN REPLAY <ArrowRight size={13} /></Button></div>)}</div> : <EmptyState icon={FileClock} title="No replays available" body="Complete a practice mission to create your first replay and after-action record." action={<Button size="sm" onClick={() => navigate('/missions/generate')}>CREATE A MISSION <ArrowRight size={13} /></Button>} />}
    </Card>
  </PageTransition>;
}
