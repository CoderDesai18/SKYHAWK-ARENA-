import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CircleHelp, Contrast, Cpu, Globe2, LockKeyhole, MonitorCog, Moon, RotateCcw, Save, ShieldCheck, Sun, Volume2, Wifi, WifiOff } from 'lucide-react';
import { Avatar, Badge, Button, Card, PageHeading, PageTransition, SectionTitle } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { changeAccountPassword } from '../lib/auth';
import { getLocalValue, saveProfile, setLocalValue, updateDb } from '../lib/store';
import type { Difficulty } from '../types';

const GRAPHICS = ['LOW', 'MEDIUM', 'HIGH'] as const;

export default function SettingsPage() {
  const { user, updateUser, refreshProfile } = useAuth();
  const { db, online, syncNow, refresh } = useData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const pref = user ? db.userPreferences[user.uid] ?? {} : {};
  const [theme, setTheme] = useState(String(pref.theme ?? 'dark'));
  const [sound, setSound] = useState(Boolean(pref.sound ?? db.systemSettings.soundEnabled));
  const [notifications, setNotifications] = useState(Boolean(pref.notifications ?? true));
  const [language, setLanguage] = useState(String(pref.language ?? 'English'));
  const [graphics, setGraphics] = useState<(typeof GRAPHICS)[number]>((getLocalValue('skyhawk:graphics') as (typeof GRAPHICS)[number]) ?? (db.systemSettings.lowGraphicsDefault ? 'LOW' : 'MEDIUM'));
  const [name, setName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  if (!user) return null;
  const savePreferences = () => {
    updateDb((state) => { state.userPreferences[user.uid] = { ...(state.userPreferences[user.uid] ?? {}), theme, sound, notifications, language }; });
    setLocalValue('skyhawk:graphics', graphics);
    document.documentElement.dataset.theme = theme;
    refresh(); toast('Preferences saved for this device.', 'success');
  };
  const saveName = async () => {
    if (name.trim().length < 2) { toast('Enter at least two characters for your name.', 'error'); return; }
    await updateUser({ name: name.trim() }); toast('Profile details updated.', 'success');
  };
  const changePassword = async () => {
    if (newPassword.length < 8) { toast('New password must be at least 8 characters.', 'error'); return; }
    if (newPassword !== confirmPassword) { toast('New passwords do not match.', 'error'); return; }
    setPasswordBusy(true);
    try { await changeAccountPassword(user.uid, currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); toast('Account password updated.', 'success'); }
    catch (error) { toast(error instanceof Error ? error.message : 'Password could not be updated.', 'error'); }
    finally { setPasswordBusy(false); }
  };
  const sync = async () => { setSyncBusy(true); try { const count = await syncNow(); toast(count ? `${count} mission record(s) synchronized.` : online ? 'Local records are up to date.' : 'Offline mode: records are queued locally.', count ? 'success' : 'info'); } catch { toast('Sync is deferred until an internet connection is available.', 'info'); } finally { setSyncBusy(false); } };
  const clearLocalPreference = (key: string) => { updateDb((state) => { const current = state.userPreferences[user.uid] ?? {}; delete current[key]; state.userPreferences[user.uid] = current; }); refresh(); };

  return <PageTransition><PageHeading eyebrow="ACCOUNT / DEVICE PREFERENCES" title="Settings" description="Manage your account, simulation quality, notifications, and offline synchronization." action={<Badge tone={online ? 'green' : 'orange'} dot>{online ? 'ONLINE' : 'OFFLINE MODE'}</Badge>} />
    <div className="settings-layout"><div className="settings-main-column"><Card className="settings-card"><SectionTitle title="Display &amp; simulation" detail="Preference settings are stored on this device" /><div className="settings-row"><span className="settings-icon"><Contrast size={17} /></span><span><b>Appearance</b><small>Dark mode is the primary command-center theme.</small></span><div className="theme-select"><button className={theme === 'dark' ? 'theme-selected' : ''} onClick={() => setTheme('dark')}><Moon size={14} /> Dark</button><button className={theme === 'light' ? 'theme-selected' : ''} onClick={() => setTheme('light')}><Sun size={14} /> Light</button></div></div><div className="settings-row"><span className="settings-icon"><MonitorCog size={17} /></span><span><b>Graphics quality</b><small>Low reduces detail; high uses a higher render resolution.</small></span><div className="segmented-control">{GRAPHICS.map((item) => <button key={item} className={graphics === item ? 'segment-active' : ''} onClick={() => setGraphics(item)}>{item}</button>)}</div></div><div className="settings-row"><span className="settings-icon"><Volume2 size={17} /></span><span><b>Sound cues</b><small>Preference for optional interface cues. No real alerts are generated.</small></span><Toggle checked={sound} onChange={setSound} /></div><div className="settings-row"><span className="settings-icon"><Globe2 size={17} /></span><span><b>Language preference</b><small>Interface language preference for the prototype.</small></span><select className="settings-select" value={language} onChange={(event) => setLanguage(event.target.value)}><option>English</option><option>हिन्दी</option><option>मराठी</option></select></div><div className="settings-row"><span className="settings-icon"><Bell size={17} /></span><span><b>Training notifications</b><small>Mission, milestone, and certification updates.</small></span><Toggle checked={notifications} onChange={setNotifications} /></div><div className="settings-card-footer"><span><Check size={13} /> Preferences persist locally and remain available offline.</span><Button onClick={savePreferences}><Save size={14} /> SAVE PREFERENCES</Button></div></Card>
      <Card className="settings-card"><SectionTitle title="Account profile" detail="Your training identity and role access" /><div className="account-profile-row"><Avatar name={user.name} size="lg" photoURL={user.photoURL} /><div><span>AUTHENTICATED PROFILE</span><b>{user.name}</b><small>{user.email}</small></div><Badge tone={user.role === 'ADMIN' ? 'orange' : user.role === 'INSTRUCTOR' ? 'blue' : 'cyan'}>{user.role}</Badge></div><div className="account-form-row"><label className="select-field"><span className="field-label">DISPLAY NAME</span><input className="text-input" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="select-field"><span className="field-label">EMAIL ADDRESS</span><input className="text-input" value={user.email} disabled /></label><Button onClick={saveName}>UPDATE PROFILE <Save size={14} /></Button></div><div className="account-security-summary"><div><ShieldCheck size={15} /><span><b>Email verification</b><small>{user.emailVerified ? 'Verified' : 'Not verified'}</small></span><Badge tone={user.emailVerified ? 'green' : 'orange'}>{user.emailVerified ? 'VERIFIED' : 'PENDING'}</Badge></div><div><LockKeyhole size={15} /><span><b>Role-based access</b><small>{user.role} routes are protected by the client and Firestore rules.</small></span><Badge tone="cyan">ACTIVE</Badge></div></div></Card>
      <Card className="settings-card"><SectionTitle title="Security" detail="Update your account password" /><div className="password-form-grid"><label className="select-field"><span className="field-label">CURRENT PASSWORD</span><input className="text-input" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" /></label><label className="select-field"><span className="field-label">NEW PASSWORD</span><input className="text-input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" /></label><label className="select-field"><span className="field-label">CONFIRM NEW PASSWORD</span><input className="text-input" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /></label><Button variant="secondary" onClick={changePassword} disabled={passwordBusy || !currentPassword || !newPassword}>{passwordBusy ? 'UPDATING…' : 'CHANGE PASSWORD'} <LockKeyhole size={14} /></Button></div><p className="security-footnote">Demo accounts share the password <code>Skyhawk2026!</code>. Change it here or use the local password reset flow.</p></Card></div>
    <aside className="settings-side-column"><Card className="offline-settings-card"><div className="offline-settings-icon">{online ? <Wifi size={18} /> : <WifiOff size={18} />}</div><div className="panel-overline">OFFLINE-FIRST DEMO</div><h3>{online ? 'Training store ready.' : 'Working offline.'}</h3><p>Simulation sessions, mission events, and preferences are persisted in local storage. Pending cloud sync resumes when connectivity returns.</p><div className="offline-queue-row"><span>PENDING RECORDS</span><b>{db.pendingSync.length}</b></div><Button variant="secondary" onClick={sync} disabled={syncBusy}>{syncBusy ? 'CHECKING…' : online ? 'SYNC LOCAL RECORDS' : 'CHECK CONNECTION'} <RotateCcw size={14} /></Button></Card><Card className="storage-info-card"><div className="panel-overline">DEVICE STORAGE</div><h3>Local prototype data</h3><div><span>Users</span><b>{db.users.length}</b></div><div><span>Mission records</span><b>{db.missions.length}</b></div><div><span>Mission events</span><b>{db.missionEvents.length}</b></div><div><span>Simulation cache</span><b>3D / LOCAL</b></div><div className="storage-note"><Cpu size={14} /> Low / medium / high rendering applies on the next simulation load.</div></Card><Card className="settings-help-card"><CircleHelpIcon /><span><b>Need a different account?</b><small>Signing out preserves local demo progress on this device.</small></span><Button variant="quiet" size="sm" onClick={() => navigate(user?.role === 'ADMIN' ? '/admin' : user?.role === 'INSTRUCTOR' ? '/instructor' : '/dashboard')}>RETURN TO WORKSPACE</Button></Card></aside></div>
  </PageTransition>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) { return <button className={`toggle-switch ${checked ? 'toggle-on' : ''}`} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}><i /></button>; }
function CircleHelpIcon() { return <span className="settings-help-icon"><CircleHelp size={17} /></span>; }
