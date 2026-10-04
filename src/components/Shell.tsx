import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Bell, BookOpenCheck, ChevronDown, Command, Compass, FileClock, Gauge, Layers3, LogOut, Menu, Radio, Radar, Settings, Shield, ShieldCheck, SlidersHorizontal, UserRound, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Avatar, Badge, IconButton } from './ui';
import { markNotificationRead } from '../lib/store';
import type { UserRole } from '../types';

const traineeNav = [
  { label: 'COMMAND CENTER', to: '/dashboard', icon: Command },
  { label: 'MISSIONS', to: '/missions', icon: Compass },
  { label: 'SIMULATION', to: '/missions/generate', icon: Radio },
  { label: 'ANALYTICS', to: '/analytics', icon: Activity },
  { label: 'REPLAY', to: '/replay', icon: FileClock },
  { label: 'SKILL PASSPORT', to: '/passport', icon: BookOpenCheck },
  { label: 'CERTIFICATIONS', to: '/certifications', icon: ShieldCheck }
];
const instructorNav = [
  { label: 'TRAINEES', to: '/instructor', icon: Users },
  { label: 'ASSIGNMENTS', to: '/instructor?view=assignments', icon: Layers3 },
  { label: 'ANALYTICS', to: '/analytics', icon: Activity },
  { label: 'REPORTS', to: '/instructor?view=reports', icon: FileClock }
];
const adminNav = [
  { label: 'USER MANAGEMENT', to: '/admin', icon: Users },
  { label: 'SCENARIOS', to: '/admin?view=scenarios', icon: Layers3 },
  { label: 'SYSTEM', to: '/admin?view=system', icon: SlidersHorizontal },
  { label: 'AUDIT LOGS', to: '/admin?view=audit', icon: FileClock }
];

function navForRole(role: UserRole) { return role === 'ADMIN' ? adminNav : role === 'INSTRUCTOR' ? instructorNav : traineeNav; }
function homeForRole(role: UserRole | undefined) { return role === 'ADMIN' ? '/admin' : role === 'INSTRUCTOR' ? '/instructor' : '/dashboard'; }
function roleLabel(role: UserRole) { return role === 'ADMIN' ? 'SYSTEM ADMIN' : role === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'TRAINEE'; }
function breadcrumb(path: string) {
  const clean = path.split('?')[0];
  const labels: Record<string, string> = { '/dashboard': 'Command center', '/missions': 'Mission library', '/missions/generate': 'Mission generator', '/analytics': 'Skill analytics', '/replay': 'Mission replay', '/passport': 'Digital skill passport', '/certifications': 'Certifications', '/instructor': 'Instructor operations', '/admin': 'System administration', '/settings': 'Preferences', '/assessment': 'Baseline assessment', '/profile': 'Trainee profile' };
  return labels[clean] ?? (clean.startsWith('/simulation') ? 'Live simulation' : clean.startsWith('/review') ? 'After-action review' : 'Training operations');
}

export default function Shell() {
  const { user, signOut } = useAuth();
  const { db, online, refresh } = useData();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const immersive = location.pathname.startsWith('/simulation/');
  const navItems = user ? navForRole(user.role) : traineeNav;
  const notificationsEnabled = Boolean(user ? db.userPreferences[user.uid]?.notifications ?? true : true);
  const notices = notificationsEnabled ? db.notifications.filter((notice) => notice.userId === user?.uid).slice(0, 6) : [];
  const unread = notices.filter((notice) => !notice.read).length;

  const logout = async () => {
    await signOut();
    toast('Secure session closed. Local training progress is saved.', 'success');
    navigate('/login');
  };
  const followNotice = (id: string, href?: string) => {
    markNotificationRead(id);
    refresh();
    setNoticesOpen(false);
    if (href) navigate(href);
  };

  if (immersive) {
    return <div className="immersive-shell">
      <header className="sim-topbar"><Link to="/dashboard" className="sim-brand"><span className="brand-mark"><Radar size={20} /></span><span>SKYHAWK <b>ARENA</b></span></Link><div className="sim-top-center"><span className="live-dot" /> SIMULATION ENVIRONMENT <span className="tiny-divider" /> {online ? 'ONLINE' : 'OFFLINE MODE'}</div><div className="sim-top-user"><Avatar name={user?.name ?? 'Trainee'} size="sm" /><span>{user?.name}</span><button className="text-button" onClick={() => navigate('/dashboard')}>EXIT SIM</button></div></header>
      <main className="immersive-main"><Outlet /></main>
    </div>;
  }

  return <div className="app-shell">
    {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup"><Link to={homeForRole(user?.role)} className="brand-mark"><Radar size={21} strokeWidth={1.7} /></Link><div><span className="brand-name">SKYHAWK <b>ARENA</b></span><small>SIMULATION TRAINING SYSTEM</small></div><IconButton label="Close navigation" className="mobile-close" onClick={() => setMobileOpen(false)}><X size={19} /></IconButton></div>
      <div className="workspace-chip"><span className="workspace-pulse" /> TRAINING ENVIRONMENT <span className="workspace-lock">SIM</span></div>
      <div className="nav-label">OPERATIONS</div>
      <nav className="main-nav">
        {navItems.map(({ label, to, icon: Icon }, index) => <NavLink key={`${label}-${index}`} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => { const desiredView = new URLSearchParams(to.split('?')[1] ?? '').get('view'); const currentView = new URLSearchParams(location.search).get('view'); const searchMatches = desiredView === currentView; return `nav-link ${isActive && searchMatches ? 'nav-active' : ''}`; }}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === 'MISSIONS' && <span className="nav-count">{db.missions.filter((m) => m.userId === user?.uid && m.status === 'READY').length || ''}</span>}</NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        {user?.role === 'TRAINEE' && <div className="sidebar-readiness"><div className="readiness-row"><span>READINESS INDEX</span><strong>{user.overallScore}<small>/100</small></strong></div><div className="readiness-track"><i style={{ width: `${user.overallScore}%` }} /></div><span className="readiness-note"><Gauge size={12} /> {user.trainingLevel} TRACK</span></div>}
        <NavLink to={user?.role === 'TRAINEE' ? '/passport' : '/settings'} className="sidebar-user" onClick={() => setMobileOpen(false)}><Avatar name={user?.name ?? 'Guest'} size="md" /><span className="sidebar-user-info"><b>{user?.name ?? 'Local user'}</b><small>{roleLabel(user?.role ?? 'TRAINEE')}</small></span><ChevronDown size={14} /></NavLink>
        <button className="sidebar-logout" onClick={logout}><LogOut size={16} /> SIGN OUT <span>↗</span></button>
      </div>
    </aside>
    <div className="shell-main">
      <header className="topbar">
        <div className="topbar-left"><IconButton label="Open navigation" className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></IconButton><span className="crumb-root">SKYHAWK</span><span className="crumb-sep">/</span><span className="crumb-current">{breadcrumb(location.pathname)}</span></div>
        <div className="topbar-right"><div className={`connection-chip ${online ? 'is-online' : 'is-offline'}`}><span className="connection-dot" />{online ? 'ONLINE' : 'OFFLINE MODE'}{!online && db.pendingSync.length > 0 && <em>{db.pendingSync.length}</em>}</div><Badge tone={user?.role === 'ADMIN' ? 'orange' : user?.role === 'INSTRUCTOR' ? 'blue' : 'cyan'}>{roleLabel(user?.role ?? 'TRAINEE')}</Badge>
          <div className="topbar-menu-wrap"><IconButton label="Notifications" className={`notification-trigger ${unread ? 'has-unread' : ''}`} onClick={() => { setNoticesOpen((open) => !open); setProfileOpen(false); }}><Bell size={18} />{unread > 0 && <i>{unread}</i>}</IconButton>{noticesOpen && <div className="dropdown-panel notices-dropdown"><div className="dropdown-head"><strong>Notifications</strong><span>{unread} unread</span></div>{notices.length ? notices.map((notice) => <button key={notice.id} className={`notice-item ${notice.read ? '' : 'notice-unread'}`} onClick={() => followNotice(notice.id, notice.href)}><span className={`notice-indicator notice-${notice.type.toLowerCase()}`} /><span><b>{notice.title}</b><small>{notice.body}</small><time>{new Date(notice.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></span></button>) : <div className="dropdown-empty">{notificationsEnabled ? 'No notifications yet.' : 'Training notifications are paused in settings.'}</div>}<button className="dropdown-foot" onClick={() => { notices.forEach((n) => markNotificationRead(n.id)); refresh(); }}>MARK ALL AS READ</button></div>}</div>
          <div className="topbar-menu-wrap"><button className="user-menu-trigger" onClick={() => { setProfileOpen((open) => !open); setNoticesOpen(false); }}><Avatar name={user?.name ?? 'Trainee'} size="sm" /><ChevronDown size={14} /></button>{profileOpen && <div className="dropdown-panel profile-dropdown"><div className="profile-dropdown-head"><Avatar name={user?.name ?? 'Trainee'} /><span><b>{user?.name}</b><small>{user?.email}</small></span></div><Link to={user?.role === 'TRAINEE' ? '/passport' : '/settings'} onClick={() => setProfileOpen(false)}><UserRound size={15} /> My profile</Link><Link to="/settings" onClick={() => setProfileOpen(false)}><Settings size={15} /> Preferences</Link><button onClick={logout}><LogOut size={15} /> Sign out</button></div>}</div>
        </div>
      </header>
      <main className="content-area"><Outlet /></main>
      <footer className="shell-footer"><span>SKYHAWK ARENA <i>·</i> SIH 2026 PROTOTYPE</span><span>SIMULATION ONLY · NO REAL-WORLD CONTROL</span></footer>
    </div>
  </div>;
}
