import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, ArrowRight, Brain, Check, ChevronDown, Clock3, Compass, Crosshair, Eye, FileClock, Map, Radar, Radio, RotateCcw, Shield, ShieldCheck, Sparkles, Target, Zap } from 'lucide-react';
import { PageTransition, Badge, Button, Card, PageHeading, ProgressBar } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { getRecommendation, weakestSkill } from '../lib/missionEngine';
import { trainingEngine } from '../lib/trainingEngine';
import { addNotification, saveMission, makeId } from '../lib/store';
import { saveCloudNotification } from '../lib/cloud';
import type { Difficulty, Environment, MissionOptions, MissionRole, ScenarioType } from '../types';
import { SKILL_LABELS } from '../types';

const difficulties: Difficulty[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const objectives: MissionOptions['objective'][] = ['Detection', 'Tracking', 'Navigation', 'Response Timing', 'Threat Classification', 'Situational Awareness'];
const objectiveIcon: Record<MissionOptions['objective'], typeof Target> = { Detection: Radar, Tracking: Crosshair, Navigation: Compass, 'Response Timing': Zap, 'Threat Classification': ShieldCheck, 'Situational Awareness': Eye };

function objectiveForWeak(skill: string): MissionOptions['objective'] {
  return skill === 'reactionTime' ? 'Response Timing' : skill === 'navigation' ? 'Navigation' : skill === 'tracking' ? 'Tracking' : skill === 'accuracy' || skill === 'decisionMaking' ? 'Threat Classification' : skill === 'situationalAwareness' ? 'Situational Awareness' : 'Detection';
}

export default function MissionGenerator() {
  const { user } = useAuth();
  const { db, refresh } = useData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const weakest = user ? weakestSkill(user.skills) : 'detection';
  const queryDifficulty = searchParams.get('difficulty') as Difficulty | null;
  const queryObjective = searchParams.get('objective') as MissionOptions['objective'] | null;
  const [role, setRole] = useState<MissionRole>('DEFENDER');
  const [difficulty, setDifficulty] = useState<Difficulty>(queryDifficulty && ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'].includes(queryDifficulty) ? queryDifficulty : user?.recommendedDifficulty ?? 'BEGINNER');
  const [environment, setEnvironment] = useState<Environment>('Border Simulation');
  const [scenario, setScenario] = useState<ScenarioType>('Multiple Threats');
  const [objective, setObjective] = useState<MissionOptions['objective']>(queryObjective && objectives.includes(queryObjective) ? queryObjective : user ? objectiveForWeak(weakest) : 'Detection');
  const [generated, setGenerated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const recommendation = getRecommendation(user, db.missions);
  const activeTemplates = db.trainingScenarios.filter((item) => item.enabled);
  const availableEnvironments = Array.from(new Set(activeTemplates.map((item) => item.environment)));
  const availableScenarios = Array.from(new Set(activeTemplates.map((item) => item.scenario)));
  const selectedEnvironment = availableEnvironments.includes(environment) ? environment : availableEnvironments[0] ?? environment;
  const selectedScenario = availableScenarios.includes(scenario) ? scenario : availableScenarios[0] ?? scenario;
  const mission = generated ? db.missions.find((item) => item.id === generated) : undefined;

  const generate = async () => {
    if (!user.baselineCompleted) { navigate('/assessment'); return; }
    if (!activeTemplates.length) { toast('No training scenarios are enabled. Ask an administrator to enable a scenario template.', 'info'); return; }
    setBusy(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 380));
      const options: MissionOptions = { role, difficulty, environment: selectedEnvironment, scenario: selectedScenario, objective };
      const newMission = await trainingEngine.generateMission(user, options, db.missions);
      saveMission(newMission);
      const notification = { id: makeId('notice'), userId: user.uid, title: 'New adaptive mission available', body: `${newMission.title} is ready to launch.`, type: 'MISSION' as const, createdAt: new Date().toISOString(), read: false, href: `/simulation/${newMission.id}` };
      addNotification(notification);
      void saveCloudNotification(notification).catch((error) => console.warn('Mission notification remains local until cloud access is available.', error));
      refresh(); setGenerated(newMission.id);
      toast('Adaptive mission generated from your profile.', 'success');
    } catch (error) { toast(error instanceof Error ? error.message : 'Mission generation failed. Please try again.', 'error'); }
    finally { setBusy(false); }
  };

  return <PageTransition><PageHeading eyebrow="MISSION SYSTEM / PROCEDURAL GENERATION" title="Mission generator" description="Build a fictional training scenario from your profile, recent performance, and current objective." action={<Badge tone="green" dot>ADAPTIVE ENGINE READY</Badge>} />
    {!user.baselineCompleted && <div className="baseline-banner generator-baseline"><span className="baseline-banner-icon"><Brain size={18} /></span><div><b>Baseline assessment required</b><span>Complete six short prompts to personalize your first mission.</span></div><Button size="sm" onClick={() => navigate('/assessment')}>START BASELINE <ArrowRight size={14} /></Button></div>}
    {!activeTemplates.length && <div className="baseline-banner generator-baseline"><span className="baseline-banner-icon"><Activity size={18} /></span><div><b>No training scenarios are enabled</b><span>Mission generation is paused until an administrator enables a fictional scenario template.</span></div></div>}
    <div className="generator-layout"><div className="generator-form-column"><Card className="generator-card"><div className="generator-card-head"><div><div className="panel-overline">MISSION PARAMETERS / 01</div><h2>Training brief</h2><p>Choose the training lens. The engine tunes complexity against recent performance.</p></div><span className="generator-card-icon"><SlidersIcon /></span></div>
      <div className="form-section"><div className="form-section-head"><span>01</span><div><b>SIMULATION ROLE</b><small>Select a fictional training cockpit.</small></div></div><div className="role-options"><button className={`role-option ${role === 'OPERATOR' ? 'role-selected' : ''}`} onClick={() => setRole('OPERATOR')}><span className="role-option-icon"><Radio size={18} /></span><span><b>OPERATOR</b><small>Navigation &amp; objective practice</small></span><span className="option-check">{role === 'OPERATOR' && <Check size={13} />}</span></button><button className={`role-option ${role === 'DEFENDER' ? 'role-selected' : ''}`} onClick={() => setRole('DEFENDER')}><span className="role-option-icon"><Shield size={18} /></span><span><b>DEFENDER</b><small>Contact awareness console</small></span><span className="option-check">{role === 'DEFENDER' && <Check size={13} />}</span></button></div></div>
      <div className="form-section"><div className="form-section-head"><span>02</span><div><b>DIFFICULTY BAND</b><small>Adaptive difficulty may adjust by one level.</small></div></div><div className="difficulty-options">{difficulties.map((item, index) => <button className={`difficulty-option ${difficulty === item ? 'difficulty-selected' : ''}`} key={item} onClick={() => setDifficulty(item)}><span>0{index + 1}</span><b>{item}</b>{difficulty === item && <i />}</button>)}</div><div className="difficulty-caption"><span className="adaptive-mini"><span /> PROFILE-TUNED</span><span>Recommended: <b>{recommendation.difficulty}</b> · {recommendation.sentence}</span></div></div>
      <div className="form-row form-section"><label className="select-field"><span className="field-label">ENVIRONMENT</span><span className="select-shell"><Map size={15} /><select value={selectedEnvironment} onChange={(event) => setEnvironment(event.target.value as Environment)}>{availableEnvironments.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></span></label><label className="select-field"><span className="field-label">SCENARIO TYPE</span><span className="select-shell"><Activity size={15} /><select value={selectedScenario} onChange={(event) => setScenario(event.target.value as ScenarioType)}>{availableScenarios.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></span></label></div>
      <div className="form-section"><div className="form-section-head"><span>03</span><div><b>TRAINING OBJECTIVE</b><small>Recommended focus is based on your lowest skill dimension.</small></div><Badge tone="orange">GAP: {SKILL_LABELS[weakest].toUpperCase()}</Badge></div><div className="objective-select-grid">{objectives.map((item) => { const Icon = objectiveIcon[item]; return <button className={`objective-option ${objective === item ? 'objective-selected' : ''}`} key={item} onClick={() => setObjective(item)}><Icon size={16} /><span>{item}</span>{objective === item && <Check size={13} />}</button>; })}</div></div>
      <div className="generator-footer"><div><span className="ai-dot" /> PROCEDURAL MISSION ENGINE <span className="engine-version">v0.6 / OFFLINE READY</span></div><Button size="lg" onClick={generate} disabled={busy || !user.baselineCompleted || !activeTemplates.length}>{busy ? <><span className="button-spinner" /> BUILDING SCENARIO</> : <>GENERATE MISSION <Sparkles size={16} /></>}</Button></div>
    </Card></div>
      <aside className="generator-side-column"><Card className="adapt-panel"><div className="adapt-panel-heading"><div className="adapt-icon"><Sparkles size={17} /></div><Badge tone="cyan">ADAPTIVE CONTEXT</Badge></div><h3>Training profile</h3><p>The generator uses recent performance, skill gaps, mistakes, and difficulty trend. No trained AI model is required for this prototype.</p><div className="profile-context-list"><div><span>READINESS SCORE</span><b>{user.overallScore}<small> / 100</small></b><ProgressBar value={user.overallScore} /></div><div><span>PRIORITY SKILL GAP</span><b>{SKILL_LABELS[weakest]} <small>{user.skills[weakest]}%</small></b><ProgressBar value={user.skills[weakest]} color="orange" /></div><div><span>RECENT MISSIONS</span><b>{db.missions.filter((item) => item.userId === user.uid && item.status === 'COMPLETED').length} <small>completed</small></b></div><div><span>RESPONSE WINDOW</span><b>{difficulty === 'BEGINNER' ? 'WIDE' : difficulty === 'INTERMEDIATE' ? 'STANDARD' : difficulty === 'ADVANCED' ? 'TIGHT' : 'COMPACT'} <small>simulated</small></b></div></div><div className="adapt-note"><Brain size={15} /><span>{recommendation.sentence}</span></div></Card>
      <Card className="generation-safety"><ShieldCheck size={17} /><div><b>SIMULATION ONLY</b><p>Threats and responses are fictional, non-operational training events.</p></div></Card></aside>
    </div>
    {mission && <Card className="mission-brief-card"><div className="mission-brief-header"><div><div className="panel-overline">MISSION BRIEF / READY TO LAUNCH</div><h2>{mission.title}</h2></div><Badge tone="green" dot>{mission.status}</Badge></div><div className="brief-meta"><span><Radio size={14} /> {mission.role}</span><span><Map size={14} /> {mission.environment}</span><span><Shield size={14} /> {mission.scenario}</span><span><Clock3 size={14} /> ~{mission.estimatedMinutes} MIN</span></div><div className="brief-objectives"><div><span>OBJECTIVE</span><b>{mission.objective}</b></div><div><span>ADAPTIVE NOTE</span><p>{mission.adaptNote}</p></div></div><div className="brief-actions"><Button variant="secondary" onClick={() => setGenerated(null)}><RotateCcw size={14} /> EDIT BRIEF</Button><Button size="lg" onClick={() => navigate(`/simulation/${mission.id}`)}>ENTER SIMULATION <ArrowRight size={16} /></Button></div></Card>}
    {mission && <MissionFocusIcon mission={mission} />}
  </PageTransition>;
}

function SlidersIcon() { return <div className="mini-sliders"><span /><span /><span /></div>; }
function MissionFocusIcon({ mission }: { mission: { focus: keyof typeof SKILL_LABELS } }) { const Icon = mission.focus === 'navigation' ? Compass : mission.focus === 'reactionTime' ? Zap : mission.focus === 'situationalAwareness' ? Eye : Target; return <span className="sr-only"><Icon aria-hidden="true" /></span>; }
