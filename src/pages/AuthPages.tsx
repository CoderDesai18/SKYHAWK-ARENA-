import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, ArrowLeft, ArrowRight, Eye, EyeOff, Fingerprint, KeyRound, LockKeyhole, Mail, Radar, ShieldCheck, UserRound, UserRoundPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui';
import { firebaseConfigured } from '../lib/firebaseClient';
import { supabaseConfigured } from '../lib/supabaseClient';
import { sendResetOrSetLocal } from '../lib/auth';
import { getDb } from '../lib/store';
import type { UserRole } from '../types';

export function roleHome(role: UserRole): string { return role === 'ADMIN' ? '/admin' : role === 'INSTRUCTOR' ? '/instructor' : '/dashboard'; }

function AuthFrame({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return <div className="auth-screen"><div className="auth-ambient" /><div className="auth-wrap">
    <Link to="/" className="brand-lockup auth-brand"><span className="brand-mark"><Radar size={21} /></span><div><span className="brand-name">SKYHAWK <b>ARENA</b></span><small>SIMULATION TRAINING SYSTEM</small></div></Link>
    <div className="auth-card"><div className="auth-card-head"><div className="auth-card-icon"><Fingerprint size={22} /></div><span className="auth-step">SECURE ACCESS / SIH26247</span><h1>{title}</h1><p>{subtitle}</p></div>{children}<div className="auth-safe"><ShieldCheck size={14} /><span>Simulation-only training environment. Your session stays private.</span></div></div>
    <div className="auth-footer">MINISTRY OF DEFENCE · ROBOTICS &amp; DRONES <span>•</span> HACKATHON PROTOTYPE</div>
    {footer}
  </div></div>;
}

function Field({ label, icon: Icon, type = 'text', value, onChange, placeholder, autoComplete, required = true, hint, minLength }: { label: string; icon: typeof Mail; type?: string; value: string; onChange: (value: string) => void; placeholder?: string; autoComplete?: string; required?: boolean; hint?: string; minLength?: number }) {
  const [visible, setVisible] = useState(false);
  const inputType = type === 'password' && visible ? 'text' : type;
  return <label className="field"><span className="field-label">{label}</span><span className="input-shell"><Icon size={16} /><input type={inputType} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} required={required} minLength={minLength} />{type === 'password' && <button type="button" className="password-visibility" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button>}</span>{hint && <small className="field-hint">{hint}</small>}</label>;
}

export function LoginPage() {
  const { user, signIn, signInDemo, signInGoogle } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState<string | null>(null);
  if (user) return <Navigate to={roleHome(user.role)} replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try { const profile = await signIn(email, password); navigate(roleHome(profile.role)); toast(`Welcome back, ${profile.name.split(' ')[0]}.`, 'success'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not sign in. Check your details and try again.'); }
    finally { setBusy(false); }
  };
  const demo = async (role: 'TRAINEE' | 'INSTRUCTOR' | 'ADMIN') => {
    setError(''); setDemoBusy(role);
    try { const profile = await signInDemo(role); navigate(roleHome(profile.role)); toast(`${profile.role.toLowerCase()} demo session opened.`, 'success'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Demo account unavailable.'); }
    finally { setDemoBusy(null); }
  };
  const google = async () => {
    setError(''); setBusy(true);
    try { const profile = await signInGoogle(); if (profile) navigate(roleHome(profile.role)); else toast('Continue with Google in the opened authentication flow.', 'info'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Google sign-in could not start.'); }
    finally { setBusy(false); }
  };
  return <AuthFrame title="Welcome back" subtitle="Sign in to your training environment.">
    <form className="auth-form" onSubmit={submit}>
      <Field label="EMAIL ADDRESS" icon={Mail} value={email} onChange={setEmail} placeholder="name@organisation.com" autoComplete="email" type="email" />
      <Field label="PASSWORD" icon={LockKeyhole} value={password} onChange={setPassword} placeholder="Enter your password" autoComplete="current-password" type="password" />
      <div className="auth-between"><span>Protected with role-based access</span><Link to="/forgot-password">Forgot password?</Link></div>
      {error && <div className="form-error"><span>!</span>{error}</div>}
      <Button type="submit" size="lg" className="auth-submit" disabled={busy}>{busy ? <><span className="button-spinner" /> AUTHENTICATING</> : <>SIGN IN TO ARENA <ArrowRight size={16} /></>}</Button>
    </form>
    <div className="auth-or"><span>OR CONTINUE WITH</span></div>
    <Button variant="secondary" className="google-button" onClick={google} disabled={busy}><span className="google-g">G</span> GOOGLE SIGN-IN {!firebaseConfigured && !supabaseConfigured && <small>SETUP REQUIRED</small>}</Button>
    <div className="demo-access"><div className="demo-access-head"><div><b>DEMO ACCESS</b><span>Local simulation accounts · no external provider</span></div><span className="demo-live-dot" /></div><div className="demo-roles">
      <button onClick={() => demo('TRAINEE')} disabled={demoBusy !== null}><UserRound size={15} /><span>TRAINEE</span><small>{demoBusy === 'TRAINEE' ? 'OPENING' : 'AARAV / 8 MISSIONS'}</small></button>
      <button onClick={() => demo('INSTRUCTOR')} disabled={demoBusy !== null}><Activity size={15} /><span>INSTRUCTOR</span><small>{demoBusy === 'INSTRUCTOR' ? 'OPENING' : '7 TRAINEES'}</small></button>
      <button onClick={() => demo('ADMIN')} disabled={demoBusy !== null}><KeyRound size={15} /><span>ADMIN</span><small>{demoBusy === 'ADMIN' ? 'OPENING' : 'SYSTEM VIEW'}</small></button>
    </div><div className="demo-password-hint">Shared demo password: <code>Skyhawk2026!</code></div></div>
    <div className="auth-switch">New to SKYHAWK? <Link to="/register">Create a trainee profile <ArrowRight size={13} /></Link></div>
  </AuthFrame>;
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={user.emailVerified ? roleHome(user.role) : '/verify-email'} replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (!/^[\p{L}\p{M}][\p{L}\p{M}\p{N} .'-]{1,79}$/u.test(name.trim())) { setError('Enter a name using at least two letters.'); return; }
    setBusy(true);
    try { await register(name, email, password); navigate('/verify-email'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Registration could not be completed.'); }
    finally { setBusy(false); }
  };
  return <AuthFrame title="Create your profile" subtitle="Start as a trainee. Instructor and admin access is assigned separately.">
    <form className="auth-form" onSubmit={submit}>
      <Field label="FULL NAME" icon={UserRound} value={name} onChange={setName} placeholder="e.g. Ananya Sharma" autoComplete="name" />
      <Field label="EMAIL ADDRESS" icon={Mail} value={email} onChange={setEmail} placeholder="name@organisation.com" autoComplete="email" type="email" />
      <Field label="PASSWORD" icon={LockKeyhole} value={password} onChange={setPassword} placeholder="At least 8 characters" autoComplete="new-password" type="password" minLength={8} />
      <Field label="CONFIRM PASSWORD" icon={LockKeyhole} value={confirm} onChange={setConfirm} placeholder="Re-enter password" autoComplete="new-password" type="password" minLength={8} />
      {error && <div className="form-error"><span>!</span>{error}</div>}
      <Button type="submit" size="lg" className="auth-submit" disabled={busy}>{busy ? <><span className="button-spinner" /> CREATING PROFILE</> : <>CREATE TRAINEE PROFILE <UserRoundPlus size={16} /></>}</Button>
    </form>
    <div className="register-note"><ShieldCheck size={15} /><span>New accounts start with a baseline assessment. Role assignment is protected.</span></div>
    <div className="auth-switch">Already have an account? <Link to="/login">Sign in <ArrowRight size={13} /></Link></div>
  </AuthFrame>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isRecovery = searchParams.get('reset') === '1';
  const localReset = (!firebaseConfigured && !supabaseConfigured) || Boolean(getDb().credentials[email.trim().toLowerCase()]);
  const needsNewPassword = localReset || isRecovery;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true);
    try {
      await sendResetOrSetLocal(email, needsNewPassword ? newPassword : undefined);
      setMessage(localReset ? 'Local demo password updated. You can sign in with the new password.' : isRecovery ? 'Your password has been updated.' : 'If an account exists, a password reset email has been sent.');
      toast(needsNewPassword ? 'Password updated.' : 'Reset email request sent.', 'success');
    } catch (err) { setError(err instanceof Error ? err.message : 'Password reset could not be completed.'); }
    finally { setBusy(false); }
  };
  return <AuthFrame title="Recover access" subtitle="Reset your password to return to the training environment.">
    <form className="auth-form" onSubmit={submit}><Field label="EMAIL ADDRESS" icon={Mail} value={email} onChange={setEmail} placeholder="name@organisation.com" autoComplete="email" type="email" />
      {needsNewPassword && <Field label="NEW PASSWORD" icon={LockKeyhole} value={newPassword} onChange={setNewPassword} placeholder="At least 8 characters" autoComplete="new-password" type="password" minLength={8} hint={localReset ? 'In offline demo mode, your new password is saved locally.' : 'Choose a new password for your Supabase account.'} />}
      {error && <div className="form-error"><span>!</span>{error}</div>}{message && <div className="form-success"><ShieldCheck size={16} />{message}</div>}
      <Button type="submit" size="lg" className="auth-submit" disabled={busy}>{busy ? 'PROCESSING…' : needsNewPassword ? (localReset ? 'UPDATE LOCAL PASSWORD' : 'SET NEW PASSWORD') : 'SEND RESET EMAIL'} <ArrowRight size={16} /></Button>
    </form><Link to="/login" className="auth-back"><ArrowLeft size={14} /> Back to sign in</Link>
  </AuthFrame>;
}

export function VerifyEmailPage() {
  const { user, verifyEmail, resendEmailVerification, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!user) return <Navigate to="/login" replace />;
  const continueToArena = async () => {
    setBusy(true); setMessage('');
    try {
      const updated = await verifyEmail(); await refreshProfile();
      if ((firebaseConfigured || supabaseConfigured) && !updated?.emailVerified) { setMessage('Verification is still pending. Open the email link, then check again.'); return; }
      navigate(roleHome(user.role));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not confirm verification.'); }
    finally { setBusy(false); }
  };
  const resend = async () => { setBusy(true); try { await resendEmailVerification(); toast(firebaseConfigured || supabaseConfigured ? 'Verification email resent.' : 'Local demo verification is ready to confirm.', 'success'); } catch (error) { toast(error instanceof Error ? error.message : 'Could not resend verification.', 'error'); } finally { setBusy(false); } };
  return <AuthFrame title="Verify your email" subtitle="A verified address keeps your training record connected to the right profile.">
    <div className="verify-card"><div className="verify-icon"><Mail size={24} /></div><span className="verify-to">VERIFICATION DESTINATION</span><b>{user.email}</b><p>{user.emailVerified ? 'Your email is verified. You can continue to the arena.' : firebaseConfigured || supabaseConfigured ? 'Check your inbox for a verification link. You can continue after opening it.' : 'Offline demo mode has no mail provider. Confirm locally to continue the prototype flow.'}</p><div className={`verify-state ${user.emailVerified ? 'verified' : ''}`}><span />{user.emailVerified ? 'VERIFIED' : 'WAITING FOR CONFIRMATION'}</div></div>
    {message && <div className="form-error"><span>!</span>{message}</div>}
    <div className="verify-actions"><Button variant="secondary" onClick={resend} disabled={busy}>RESEND LINK</Button><Button size="lg" onClick={continueToArena} disabled={busy}>{busy ? 'CHECKING…' : 'CONTINUE TO ARENA'} <ArrowRight size={16} /></Button></div>
    <div className="auth-switch">Wrong email? <button className="inline-button" onClick={() => navigate('/register')}>Create a new profile</button></div>
  </AuthFrame>;
}
