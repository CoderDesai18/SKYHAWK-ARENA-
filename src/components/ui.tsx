import { motion } from 'framer-motion';
import { ArrowUpRight, Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function PageTransition({ children }: { children: ReactNode }) {
  return <motion.div className="page-content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .24, ease: 'easeOut' }}>{children}</motion.div>;
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading">
    <div><div className="eyebrow">{eyebrow ?? 'TRAINING OPERATIONS'}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {action && <div className="page-heading-action">{action}</div>}
  </div>;
}

export function SectionTitle({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="section-title"><div><h2>{title}</h2>{detail && <span>{detail}</span>}</div>{action}</div>;
}

export function Card({ children, className = '', noPad = false }: { children: ReactNode; className?: string; noPad?: boolean }) {
  return <section className={`panel ${noPad ? 'panel-no-pad' : ''} ${className}`}>{children}</section>;
}

export function MetricCard({ label, value, unit, trend, icon: Icon, accent = 'cyan', detail }: { label: string; value: string | number; unit?: string; trend?: string; icon: LucideIcon; accent?: 'cyan' | 'orange' | 'green' | 'red'; detail?: string }) {
  return <div className={`metric-card metric-${accent}`}>
    <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={16} strokeWidth={1.8} /></span></div>
    <div className="metric-value">{value}<small>{unit}</small></div>
    <div className="metric-foot">{trend && <span className="metric-trend"><ArrowUpRight size={13} />{trend}</span>}{detail && <span>{detail}</span>}</div>
  </div>;
}

export function Badge({ children, tone = 'muted', dot = false, className = '' }: { children: ReactNode; tone?: 'muted' | 'cyan' | 'green' | 'orange' | 'red' | 'blue'; dot?: boolean; className?: string }) {
  return <span className={`badge badge-${tone} ${className}`}>{dot && <i />}{children}</span>;
}

export function Button({ children, variant = 'primary', size = 'md', className = '', disabled, type = 'button', onClick, title }: {
  children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'; size?: 'sm' | 'md' | 'lg'; className?: string; disabled?: boolean; type?: 'button' | 'submit' | 'reset'; onClick?: () => void; title?: string;
}) {
  return <button type={type} title={title} disabled={disabled} onClick={onClick} className={`btn btn-${variant} btn-${size} ${className}`}>{children}</button>;
}

export function IconButton({ children, label, onClick, className = '', title }: { children: ReactNode; label: string; onClick?: () => void; className?: string; title?: string }) {
  return <button type="button" aria-label={label} title={title ?? label} onClick={onClick} className={`icon-btn ${className}`}>{children}</button>;
}

export function Modal({ title, subtitle, children, onClose, size = 'md' }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; size?: 'md' | 'lg' }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, y: 12, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
      <div className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><IconButton label="Close modal" onClick={onClose}><X size={18} /></IconButton></div>
      <div className="modal-body">{children}</div>
    </motion.div>
  </div>;
}

export function Avatar({ name, size = 'md', photoURL }: { name: string; size?: 'sm' | 'md' | 'lg'; photoURL?: string }) {
  const initials = name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return <span className={`avatar avatar-${size}`}>{photoURL ? <img src={photoURL} alt="" /> : initials}</span>;
}

export function ProgressBar({ value, color = 'cyan', showLabel = false }: { value: number; color?: 'cyan' | 'green' | 'orange' | 'red'; showLabel?: boolean }) {
  const width = Math.max(0, Math.min(100, value));
  return <div className="progress-wrap"><div className="progress-track"><div className={`progress-fill fill-${color}`} style={{ width: `${width}%` }} /></div>{showLabel && <span className="progress-label">{Math.round(value)}%</span>}</div>;
}

export function ScoreRing({ score, label = 'READINESS', size = 150 }: { score: number; label?: string; size?: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (Math.max(0, Math.min(100, score)) / 100);
  return <div className="score-ring-wrap" style={{ width: size, height: size }}>
    <svg viewBox="0 0 120 120" className="score-ring"><circle className="score-ring-track" cx="60" cy="60" r={radius} /><circle className="score-ring-value" cx="60" cy="60" r={radius} style={{ strokeDasharray: `${progress} ${circumference}` }} /></svg>
    <div className="score-ring-center"><strong>{Math.round(score)}</strong><span>{label}</span></div>
  </div>;
}

export function KeyCap({ children }: { children: ReactNode }) { return <kbd className="keycap">{children}</kbd>; }

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={24} /></span><h3>{title}</h3><p>{body}</p>{action}</div>;
}

export function CheckLine({ children, complete = false }: { children: ReactNode; complete?: boolean }) {
  return <div className={`check-line ${complete ? 'is-complete' : ''}`}><span>{complete ? <Check size={13} /> : null}</span>{children}</div>;
}
