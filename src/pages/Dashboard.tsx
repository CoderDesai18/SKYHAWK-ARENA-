import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, ArrowUpRight, Award, BatteryCharging, Brain, CheckCircle2, ChevronRight, Clock3, Crosshair, FileClock, Map, Radar, Radio, ShieldAlert, Sparkles, Target, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { PageTransition, Badge, Button, Card, MetricCard, PageHeading, ProgressBar, ScoreRing, SectionTitle } from '../components/ui';
import { ScoreHistoryChart, SkillRadar } from '../components/Charts';
import { eventTimeLabel } from '../lib/missionEngine';
import type { Mission } from '../types';

function difficultyTone(level?: string) { return level === 'EXPERT' || level === 'ADVANCED' ? 'orange' : level === 'INTERMEDIATE' ? 'cyan' : 'green'; }
function formatDate(date?: string) { return date ? new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'; }

export default function Dashboard() {
  const { user } = useAuth();
  const { db } = useData();
  const navigate = useNavigate();
  if (!user) return null;
  const missions = db.missions.filter((mission) => mission.userId === user.uid).sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt));
  const completed = missions.filter((mission) => mission.status === 'COMPLETED');
  const latest = completed[0];
  const successRate = completed.length ? Math.round(completed.filter((mission) => (mission.score ?? 0) >= 65).length / completed.length * 100) : user.successRate;
  const startMission = () => navigate(user.baselineCompleted ? '/missions/generate' : '/assessment');
  const reviewLatest = () => latest ? navigate(`/review/${latest.id}`) : navigate('/replay');
  const statusText = user.baselineCompleted ? 'READY FOR TRAINING' : 'BASELINE REQUIRED';

  return <PageTransition>
    <div className="dashboard-welcome"><div><div className="eyebrow">COMMAND CENTER / TRAINEE READINESS</div><h1>Good day, {user.name.split(' ')[0]}<span className="welcome-period">.</span></h1><p>Your training profile is <b>{statusText.toLowerCase()}</b>. {user.baselineCompleted ? 'An adaptive practice recommendation is ready.' : 'Complete a short baseline to unlock your first adaptive mission.'}</p></div><div className="welcome-actions"><Badge tone={user.baselineCompleted ? 'green' : 'orange'} dot>{user.baselineCompleted ? `${user.trainingLevel} TRACK` : 'ONBOARDING'}</Badge><Button onClick={startMission} size="lg">{user.baselineCompleted ? 'START MISSION' : 'BASELINE ASSESSMENT'} <ArrowRight size={16} /></Button></div></div>
    {!user.baselineCompleted && <div className="baseline-banner"><span className="baseline-banner-icon"><Brain size={18} /></span><div><b>Establish your baseline profile</b><span>Six quick decisions help tune your first mission to your starting skill level.</span></div><Button size="sm" onClick={() => navigate('/assessment')}>BEGIN ASSESSMENT <ArrowRight size={14} /></Button></div>}
    <div className="dashboard-metric-grid"><MetricCard label="OVERALL READINESS" value={user.overallScore} unit="/100" trend={completed.length > 1 ? '+4.2 this week' : undefined} icon={Activity} accent="cyan" detail="Readiness index" /><MetricCard label="MISSIONS COMPLETED" value={user.missionsCompleted} trend={`${completed.length} in this profile`} icon={Radio} accent="green" detail="Training sessions" /><MetricCard label="SUCCESS RATE" value={completed.length ? `${successRate}%` : '—'} icon={CheckCircle2} accent="orange" detail="Score ≥ 65" /><MetricCard label="AVG. REACTION" value={user.averageReactionMs ? (user.averageReactionMs / 1000).toFixed(1) : '—'} unit="s" icon={Zap} accent="green" detail="Simulated response interval" /></div>
    <div className="dashboard-main-grid">
      <Card className="readiness-panel"><div className="readiness-panel-head"><div><div className="panel-overline">PROFILE SNAPSHOT / 01</div><h2>Readiness index</h2><p>Weighted performance across your skill profile.</p></div><button className="icon-btn" aria-label="Open skill analytics" onClick={() => navigate('/analytics')}><ArrowUpRight size={17} /></button></div><div className="readiness-content"><div className="readiness-ring"><ScoreRing score={user.overallScore} /><div className="readiness-ring-caption"><span>OVERALL SCORE</span><b>{user.trainingLevel} LEVEL</b></div></div><div className="readiness-skills">{([
        ['detection', 'Detection', Radar], ['navigation', 'Navigation', Map], ['reactionTime', 'Reaction time', Clock3], ['accuracy', 'Accuracy', Crosshair], ['situationalAwareness', 'Situational awareness', EyeIcon], ['decisionMaking', 'Decision making', Brain]
      ] as const).map(([key, label, Icon]) => <div className="skill-line" key={key}><span className="skill-line-icon"><Icon size={14} /></span><span className="skill-line-label">{label}</span><ProgressBar value={user.skills[key]} color={user.skills[key] < 65 ? 'orange' : user.skills[key] >= 85 ? 'green' : 'cyan'} /><b>{user.skills[key]}%</b></div>)}</div></div><div className="readiness-panel-foot"><span><span className="tiny-live" /> ADAPTIVE PROFILE ACTIVE</span><Link to="/analytics">FULL SKILL ANALYTICS <ArrowRight size={13} /></Link></div></Card>
      <Card className="chart-panel"><div className="panel-header-inline"><div><div className="panel-overline">TRAINING HISTORY / 02</div><h2>Performance trend</h2><p>Mission scores across recent sessions.</p></div><Badge tone="cyan">LAST 8</Badge></div><ScoreHistoryChart missions={completed} compact /><div className="chart-foot"><span><i className="legend-dot cyan-dot" /> Mission score</span><span>0–100 INDEX</span></div></Card>
    </div>
    <div className="dashboard-lower-grid">
      <Card className="recent-missions-card"><SectionTitle title="Recent missions" detail="Your latest simulation sessions" action={<Link to="/missions" className="subtle-link">MISSION LOG <ArrowRight size={13} /></Link>} />
        {completed.length ? <div className="mission-table-wrap"><table className="data-table"><thead><tr><th>MISSION</th><th>MODE / LEVEL</th><th>SCORE</th><th>DATE</th><th /></tr></thead><tbody>{completed.slice(0, 4).map((mission) => <tr key={mission.id}><td><span className="mission-title-cell"><span className="mission-mini-icon"><Radio size={14} /></span><span><b>{mission.title}</b><small>{mission.environment}</small></span></span></td><td><span className="table-mode">{mission.role}</span><Badge tone={difficultyTone(mission.difficulty)}>{mission.difficulty}</Badge></td><td><span className={`table-score ${(mission.score ?? 0) >= 80 ? 'score-good' : ''}`}>{mission.score}<small>/100</small></span></td><td className="table-muted">{formatDate(mission.completedAt)}</td><td><button className="table-action" aria-label={`Review ${mission.title}`} onClick={() => navigate(`/review/${mission.id}`)}><ChevronRight size={16} /></button></td></tr>)}</tbody></table></div> : <div className="dashboard-empty"><span><FileClock size={20} /></span><b>No completed missions yet</b><small>Generate an adaptive mission to begin your training history.</small><Button size="sm" onClick={startMission}>START TRAINING <ArrowRight size={14} /></Button></div>}
      </Card>
      <Card className="recommend-panel"><div className="recommend-top"><span className="recommend-icon"><Sparkles size={18} /></span><Badge tone="orange">ADAPTIVE RECOMMENDATION</Badge></div><div className="panel-overline">NEXT BEST SESSION</div><h2>{user.baselineCompleted ? `Build your ${weakestLabel(user.skills)} skill` : 'Start with a baseline'}</h2><p>{user.baselineCompleted ? `Your current focus is ${weakestLabel(user.skills).toLowerCase()}. A short ${user.recommendedDifficulty.toLowerCase()} practice run is queued for your next session.` : 'Complete the assessment and your next mission will be tailored to your starting point.'}</p><div className="recommend-focus"><span>FOCUS AREA</span><b>{user.baselineCompleted ? weakestLabel(user.skills).toUpperCase() : 'BASELINE PROFILE'}</b><span className="recommend-focus-icon"><Target size={15} /></span></div><Button onClick={() => navigate(user.baselineCompleted ? '/missions/generate' : '/assessment')}>OPEN RECOMMENDED MISSION <ArrowRight size={14} /></Button><div className="recommend-engine"><span className="engine-pulse" /> PROCEDURAL ADAPTIVE ENGINE <span>READY</span></div></Card>
    </div>
    <div className="dashboard-action-strip"><div><span className="action-strip-icon"><Award size={18} /></span><span><b>Digital skill passport</b><small>{user.certificationStatus} · {user.missionsCompleted} missions recorded</small></span></div><div className="action-strip-buttons"><Button variant="quiet" size="sm" onClick={reviewLatest}>AFTER-ACTION REVIEW <ArrowRight size={14} /></Button><Button variant="secondary" size="sm" onClick={() => navigate('/certifications')}>CERTIFICATIONS <ChevronRight size={14} /></Button><Button variant="secondary" size="sm" onClick={() => navigate('/passport')}>OPEN PASSPORT <ChevronRight size={14} /></Button></div></div>
  </PageTransition>;
}

function weakestLabel(skills: Record<string, number>) {
  const names: Record<string, string> = { detection: 'Detection', tracking: 'Tracking', navigation: 'Navigation', accuracy: 'Accuracy', reactionTime: 'Reaction time', decisionMaking: 'Decision making', situationalAwareness: 'Situational awareness', objectiveCompletion: 'Objective completion' };
  const key = Object.keys(skills).filter((item) => item !== 'objectiveCompletion').reduce((weak, item) => skills[item] < skills[weak] ? item : weak, Object.keys(skills)[0]);
  return names[key] ?? 'Situational awareness';
}

function EyeIcon(props: { size?: number }) { return <Target {...props} />; }
