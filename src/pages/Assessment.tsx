import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowLeft, ArrowRight, Check, Clock3, Compass, Eye, Radar, RotateCcw, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { addNotification, makeId } from '../lib/store';
import { saveCloudNotification } from '../lib/cloud';
import { trainingLevelFromScore } from '../lib/missionEngine';
import { PageTransition, Badge, Button, Card, ProgressBar, ScoreRing } from '../components/ui';
import type { SkillKey } from '../types';

interface Choice { title: string; detail: string; score: number; }
interface AssessmentItem { key: SkillKey; label: string; question: string; context: string; icon: typeof Radar; choices: Choice[]; }

const questions: AssessmentItem[] = [
  { key: 'detection', label: 'Detection', question: 'A new training return appears at the edge of the awareness display. What is your first step?', context: 'Use the scene context before acting on a single signal.', icon: Radar, choices: [
    { title: 'Acknowledge and compare with nearby context', detail: 'Check persistence and surrounding cues before classifying.', score: 96 },
    { title: 'Mark it for later review', detail: 'Preserve the cue, but defer confirmation.', score: 72 },
    { title: 'Treat it as confirmed immediately', detail: 'Skip the verification stage.', score: 46 }
  ] },
  { key: 'navigation', label: 'Navigation', question: 'The next waypoint is temporarily obscured by simulated terrain. How do you continue?', context: 'This assessment rewards deliberate navigation, not speed.', icon: Compass, choices: [
    { title: 'Hold a safe training position and re-check the route', detail: 'Re-establish the route marker before continuing.', score: 95 },
    { title: 'Continue slowly using the last verified heading', detail: 'Proceed cautiously with a recent reference.', score: 75 },
    { title: 'Change direction until the waypoint reappears', detail: 'Move without a confirmed route reference.', score: 45 }
  ] },
  { key: 'reactionTime', label: 'Reaction time', question: 'A timed awareness cue appears. Which response best preserves a clear decision loop?', context: 'Select the most useful first training action. Response time is also measured.', icon: Clock3, choices: [
    { title: 'Acknowledge the cue, then assess its confidence', detail: 'Fast confirmation followed by a context check.', score: 96 },
    { title: 'Wait for the next update before acknowledging', detail: 'Avoid a premature label, but delay the cue.', score: 70 },
    { title: 'Ignore the cue until it repeats', detail: 'Acknowledge only after a second prompt.', score: 42 }
  ] },
  { key: 'decisionMaking', label: 'Decision making', question: 'Two low-priority training notices arrive at the same time. What is the clearest next step?', context: 'Balance attention without escalating an unverified item.', icon: Target, choices: [
    { title: 'Prioritize the time-sensitive cue and log the other', detail: 'Keep both cues visible with a clear order.', score: 94 },
    { title: 'Handle both sequentially without noting priority', detail: 'Complete each item but lose prioritization context.', score: 71 },
    { title: 'Dismiss one to reduce the display load', detail: 'Reduce workload by dropping useful information.', score: 44 }
  ] },
  { key: 'situationalAwareness', label: 'Situational awareness', question: 'A contact marker moves behind a terrain feature. What should remain in your mental model?', context: 'Use the entire scene, not just the current marker position.', icon: Eye, choices: [
    { title: 'Last-known position, movement trend, and objective context', detail: 'Retain a coherent picture while visibility changes.', score: 97 },
    { title: 'Only the most recent position', detail: 'Track the immediate cue without broader context.', score: 68 },
    { title: 'Assume the contact is no longer relevant', detail: 'Lose continuity when the marker is occluded.', score: 40 }
  ] },
  { key: 'accuracy', label: 'Accuracy', question: 'A simulated signature is ambiguous. How do you preserve classification quality?', context: 'The right answer uses uncertainty appropriately.', icon: ShieldCheck, choices: [
    { title: 'Keep it unclassified until supporting cues are available', detail: 'Maintain an uncertainty state and review again.', score: 96 },
    { title: 'Choose the most likely class and mark low confidence', detail: 'Offer a provisional class with a confidence note.', score: 78 },
    { title: 'Select a class to complete the step quickly', detail: 'Prioritize task completion over confidence.', score: 43 }
  ] }
];

export default function Assessment() {
  const { user, updateUser } = useAuth();
  const { db, refresh } = useData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [startedAt, setStartedAt] = useState(Date.now());
  const [reactionSeconds, setReactionSeconds] = useState(0);
  const [complete, setComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const active = questions[step];
  const CurrentIcon = active.icon;
  useEffect(() => { setStartedAt(Date.now()); }, [step]);
  useEffect(() => {
    const timer = window.setInterval(() => setReactionSeconds((Date.now() - startedAt) / 1000), 120);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  const progress = useMemo(() => Math.round((Object.keys(answers).length / questions.length) * 100), [answers]);

  const choose = (choice: Choice) => {
    const elapsed = (Date.now() - startedAt) / 1000;
    const latencyPenalty = active.key === 'reactionTime' ? (elapsed > 7 ? 14 : elapsed > 4 ? 7 : 0) : 0;
    setAnswers((current) => ({ ...current, [active.key]: Math.max(35, choice.score - latencyPenalty) }));
  };
  const finish = async () => {
    if (!user || saving) return;
    setSaving(true);
    const skillProfile = { ...user.skills };
    questions.forEach((question) => { skillProfile[question.key] = answers[question.key] ?? 50; });
    skillProfile.objectiveCompletion = Math.round(questions.reduce((total, question) => total + (answers[question.key] ?? 50), 0) / questions.length);
    const overallScore = Math.round(Object.values(skillProfile).reduce((sum, value) => sum + value, 0) / Object.keys(skillProfile).length);
    await updateUser({ skills: skillProfile, overallScore, trainingLevel: trainingLevelFromScore(overallScore), recommendedDifficulty: overallScore >= db.systemSettings.baselineThreshold ? 'INTERMEDIATE' : 'BEGINNER', baselineCompleted: true, baselineCompletedAt: new Date().toISOString(), certificationStatus: 'BASELINE COMPLETE' });
    const notification = { id: makeId('notice'), userId: user.uid, title: 'Baseline profile complete', body: `Your initial readiness profile is ${overallScore}. Adaptive training is ready.`, type: 'MILESTONE' as const, createdAt: new Date().toISOString(), read: false, href: '/missions/generate' };
    addNotification(notification);
    void saveCloudNotification(notification).catch((error) => console.warn('Baseline notification remains local until cloud access is available.', error));
    refresh(); setComplete(true); setSaving(false);
    toast('Baseline skill profile saved.', 'success');
  };

  if (!user) return null;
  if (complete) {
    const score = Math.round(Object.values(answers).reduce((sum, value) => sum + value, 0) / questions.length);
    return <PageTransition><div className="assessment-complete"><Card className="assessment-complete-card"><div className="complete-symbol"><Check size={28} /></div><Badge tone="green" dot>BASELINE RECORDED</Badge><h1>Profile established.</h1><p>Your baseline is now available to the adaptive mission engine. Every training score will build on this starting point.</p><div className="complete-score-row"><ScoreRing score={score} label="BASELINE" /><div className="complete-level"><span>INITIAL TRAINING LEVEL</span><b>{trainingLevelFromScore(score)}</b><small>Eight skill dimensions are saved to your passport.</small></div></div><div className="skill-chip-grid">{questions.map((question) => <div key={question.key}><span>{question.label}</span><b>{answers[question.key]}%</b><ProgressBar value={answers[question.key]} /></div>)}</div><div className="complete-actions"><Button size="lg" onClick={() => navigate('/missions/generate')}>GENERATE ADAPTIVE MISSION <ArrowRight size={16} /></Button><Button variant="secondary" onClick={() => navigate('/dashboard')}>RETURN TO COMMAND CENTER</Button></div></Card><div className="assessment-aside"><div className="assessment-aside-mark"><Sparkles size={24} /></div><span>WHAT HAPPENS NEXT</span><h3>Practice, review, adapt.</h3><p>Your mission difficulty and training focus will respond to this skill profile — and to every mission you complete.</p><Link to="/analytics" className="inline-link">VIEW SKILL ANALYTICS <ArrowRight size={14} /></Link></div></div></PageTransition>;
  }

  return <PageTransition><div className="assessment-layout"><div className="assessment-main"><div className="assessment-topline"><div><div className="eyebrow">TRAINEE ONBOARDING / STEP 01</div><h1>Baseline assessment</h1><p>Six scenario-based prompts establish your starting skill profile. No real-world procedures are used.</p></div><Badge tone="cyan">{step + 1} / {questions.length}</Badge></div><div className="assessment-progress"><div><span>PROFILE COMPLETION</span><b>{Math.round((step / questions.length) * 100)}%</b></div><ProgressBar value={(step / questions.length) * 100} /></div>
      <Card className="assessment-question"><div className="question-meta"><span><CurrentIcon size={17} /> SKILL DOMAIN</span><Badge>{active.label.toUpperCase()}</Badge>{active.key === 'reactionTime' && <span className="question-timer"><Clock3 size={13} /> {reactionSeconds.toFixed(1)}s</span>}</div><div className="question-context">{active.context}</div><h2>{active.question}</h2><div className="choice-list">{active.choices.map((choice, index) => <button key={choice.title} className={`choice-option ${answers[active.key] === choice.score ? 'choice-selected' : ''}`} onClick={() => choose(choice)}><span className="choice-index">0{index + 1}</span><span className="choice-copy"><b>{choice.title}</b><small>{choice.detail}</small></span><span className="choice-radio">{answers[active.key] === choice.score && <i />}</span></button>)}</div><div className="assessment-controls"><Button variant="ghost" onClick={() => step > 0 ? setStep(step - 1) : navigate('/dashboard')}><ArrowLeft size={15} /> {step > 0 ? 'PREVIOUS' : 'EXIT'}</Button><span className="assessment-save"><span /> PROGRESS HELD FOR THIS SESSION</span>{step < questions.length - 1 ? <Button disabled={answers[active.key] === undefined} onClick={() => setStep((i) => i + 1)}>NEXT DOMAIN <ArrowRight size={15} /></Button> : <Button disabled={answers[active.key] === undefined || saving} onClick={finish}>{saving ? 'SAVING…' : 'COMPLETE BASELINE'} <Check size={15} /></Button>}</div></Card>
      <div className="assessment-footnote"><ShieldCheck size={14} /><span>Assessment responses are used only to shape this fictional training prototype.</span></div>
    </div><aside className="assessment-aside"><div className="assessment-aside-mark"><CurrentIcon size={23} /></div><span>SKILL PROFILE / {String(step + 1).padStart(2, '0')}</span><h3>{active.label}</h3><p>Choose the response that best reflects your current approach. This is a baseline, not a pass/fail test.</p><div className="assessment-domain-list">{questions.map((question, index) => { const Icon = question.icon; return <div className={index === step ? 'domain-active' : answers[question.key] !== undefined ? 'domain-complete' : ''} key={question.key}><span>{answers[question.key] !== undefined ? <Check size={13} /> : <Icon size={13} />}</span><b>{question.label}</b><small>{index < step ? `${answers[question.key]}%` : index === step ? 'CURRENT' : 'PENDING'}</small></div>; })}</div><button className="assessment-reset" onClick={() => { setAnswers({}); setStep(0); }}> <RotateCcw size={13} /> RESET RESPONSES</button></aside></div></PageTransition>;
}
