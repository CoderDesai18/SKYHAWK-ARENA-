import { CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, Cell } from 'recharts';
import type { Mission, SkillProfile } from '../types';
import { SKILL_LABELS } from '../types';

const axisStyle = { fill: '#738495', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' };
const tooltipStyle = { background: '#111b27', border: '1px solid #2b3d4d', borderRadius: 9, color: '#eaf2f5', fontSize: 12 };

export function SkillRadar({ skills, compact = false }: { skills: SkillProfile; compact?: boolean }) {
  const data = (Object.keys(SKILL_LABELS) as Array<keyof SkillProfile>).filter((key) => key !== 'objectiveCompletion').map((key) => ({ skill: key === 'situationalAwareness' ? 'Awareness' : key === 'decisionMaking' ? 'Decision' : key === 'reactionTime' ? 'Reaction' : SKILL_LABELS[key], score: skills[key], full: SKILL_LABELS[key] }));
  return <div className={`chart-frame radar-chart ${compact ? 'chart-compact' : ''}`}>
    <ResponsiveContainer width="100%" height="100%"><RadarChart data={data} outerRadius={compact ? '68%' : '72%'}>
      <PolarGrid stroke="#283744" radialLines />
      <PolarAngleAxis dataKey="skill" tick={{ fill: '#8293a1', fontSize: compact ? 9 : 10 }} />
      <Radar name="Skill profile" dataKey="score" stroke="#55d3e1" fill="#44c7d6" fillOpacity={.19} strokeWidth={2} dot={{ r: 2, fill: '#8debf1', strokeWidth: 0 }} />
      {!compact && <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}%`, 'Score']} />}
    </RadarChart></ResponsiveContainer>
  </div>;
}

export function ScoreHistoryChart({ missions, compact = false }: { missions: Mission[]; compact?: boolean }) {
  const data = [...missions].filter((mission) => mission.score !== undefined).sort((a, b) => (a.completedAt ?? a.createdAt).localeCompare(b.completedAt ?? b.createdAt)).slice(-8).map((mission, i) => ({
    name: mission.title.length > 15 ? `M${i + 1}` : mission.title,
    score: mission.score,
    difficulty: mission.difficulty
  }));
  if (!data.length) data.push({ name: 'Baseline', score: 0, difficulty: 'BEGINNER' });
  return <div className={`chart-frame ${compact ? 'chart-compact' : ''}`}>
    <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
      <CartesianGrid stroke="#25333f" strokeDasharray="3 5" vertical={false} />
      <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} interval={compact ? 'preserveStartEnd' : 0} />
      <YAxis domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} ticks={[0, 25, 50, 75, 100]} />
      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}%`, 'Mission score']} />
      <Line type="monotone" dataKey="score" stroke="#59d6e4" strokeWidth={2.4} dot={{ r: 3.5, fill: '#59d6e4', stroke: '#101925', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#b1f3f6' }} />
    </LineChart></ResponsiveContainer>
  </div>;
}

export function ReactionChart({ missions }: { missions: Mission[] }) {
  const data = [...missions].filter((mission) => mission.status === 'COMPLETED').sort((a, b) => (a.completedAt ?? a.createdAt).localeCompare(b.completedAt ?? b.createdAt)).slice(-8).map((mission, i) => {
    const reaction = mission.events.find((event) => event.categories.includes('reactionTime'))?.timeElapsed;
    return { name: `M${i + 1}`, reaction: Math.round((reaction ? Math.max(800, reaction * 21) : 1700) / 100) / 10 };
  });
  if (!data.length) data.push({ name: '—', reaction: 0 });
  return <div className="chart-frame chart-small"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
    <CartesianGrid stroke="#25333f" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} /><YAxis reversed tick={axisStyle} axisLine={false} tickLine={false} />
    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toFixed(1)} s`, 'Response interval']} />
    <Line type="monotone" dataKey="reaction" stroke="#f0a45d" strokeWidth={2} dot={{ r: 3, fill: '#f0a45d' }} />
  </LineChart></ResponsiveContainer></div>;
}

export function SkillBars({ skills }: { skills: SkillProfile }) {
  const data = (Object.keys(SKILL_LABELS) as Array<keyof SkillProfile>).filter((key) => key !== 'objectiveCompletion').map((key) => ({ name: key === 'situationalAwareness' ? 'Awareness' : key === 'decisionMaking' ? 'Decision' : key === 'reactionTime' ? 'Reaction' : SKILL_LABELS[key], value: skills[key] }));
  return <div className="chart-frame bar-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 1, bottom: 0 }}>
    <CartesianGrid stroke="#25333f" strokeDasharray="3 5" horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={84} tick={axisStyle} axisLine={false} tickLine={false} />
    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}%`, 'Skill score']} />
    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>{data.map((entry) => <Cell key={entry.name} fill={entry.value < 65 ? '#e49a57' : entry.value >= 85 ? '#53c98b' : '#56c9d7'} />)}</Bar>
  </BarChart></ResponsiveContainer></div>;
}
