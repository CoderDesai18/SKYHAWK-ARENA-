import { Component, Suspense, lazy, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ArrowLeft, Radar, ShieldAlert } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { useData } from './context/DataContext';
import { Button } from './components/ui';
import Shell from './components/Shell';
const LoginPage = lazy(async () => ({ default: (await import('./pages/AuthPages')).LoginPage }));
const RegisterPage = lazy(async () => ({ default: (await import('./pages/AuthPages')).RegisterPage }));
const ForgotPasswordPage = lazy(async () => ({ default: (await import('./pages/AuthPages')).ForgotPasswordPage }));
const VerifyEmailPage = lazy(async () => ({ default: (await import('./pages/AuthPages')).VerifyEmailPage }));
const InstructorDashboard = lazy(async () => ({ default: (await import('./pages/Instructor')).InstructorDashboard }));
const TraineeProfilePage = lazy(async () => ({ default: (await import('./pages/Instructor')).TraineeProfilePage }));
const MissionLibrary = lazy(async () => ({ default: (await import('./pages/Missions')).MissionLibrary }));
const ReplayLibrary = lazy(async () => ({ default: (await import('./pages/Missions')).ReplayLibrary }));
const Passport = lazy(() => import('./pages/Passport'));
const CertificationsPage = lazy(async () => ({ default: (await import('./pages/Passport')).CertificationsPage }));

const Landing = lazy(() => import('./pages/Landing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Assessment = lazy(() => import('./pages/Assessment'));
const MissionGenerator = lazy(() => import('./pages/MissionGenerator'));
const Simulation = lazy(() => import('./pages/Simulation'));
const Review = lazy(() => import('./pages/Review'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Admin = lazy(() => import('./pages/Admin'));
const Settings = lazy(() => import('./pages/Settings'));

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Application view failed to render.', error, info.componentStack); }
  render() {
    if (this.state.error) return <div className="fatal-screen"><div className="fatal-card"><span><ShieldAlert size={22} /></span><div className="eyebrow">APPLICATION SAFETY / RECOVERABLE ERROR</div><h1>The training view needs a reset.</h1><p>Your locally saved missions remain available. Reload this view or return to the landing page.</p><Button onClick={() => window.location.reload()}>RELOAD APPLICATION <Activity size={14} /></Button><a href="/">RETURN TO LANDING</a><small>{this.state.error.message}</small></div></div>;
    return this.props.children;
  }
}

function roleHome(role: 'TRAINEE' | 'INSTRUCTOR' | 'ADMIN'): string { return role === 'ADMIN' ? '/admin' : role === 'INSTRUCTOR' ? '/instructor' : '/dashboard'; }

function AppLoading() {
  return <div className="app-loading"><span className="loading-radar"><Radar size={23} /></span><div className="eyebrow">SKYHAWK ARENA / LOADING</div><span className="loading-bar"><i /></span><small>PREPARING TRAINING ENVIRONMENT</small></div>;
}

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AppLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.emailVerified) return <Navigate to="/verify-email" replace />;
  return <Shell />;
}

function RoleGate({ roles, children }: { roles: Array<'TRAINEE' | 'INSTRUCTOR' | 'ADMIN'>; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Unauthorized />;
  return <>{children}</>;
}

function Unauthorized() {
  const { user } = useAuth();
  return <div className="unauthorized-state"><div className="unauthorized-icon"><ShieldAlert size={22} /></div><span>ROLE-BASED ACCESS</span><h1>That page is not part of your role.</h1><p>Instructor and admin workspaces are protected. Your training profile and mission data remain private.</p><a className="btn btn-secondary" href={user ? roleHome(user.role) : '/login'}><ArrowLeft size={14} /> RETURN TO AUTHORIZED HOME</a></div>;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <AppLoading />;
  return user ? <Navigate to={roleHome(user.role)} replace /> : <Suspense fallback={<AppLoading />}><Landing /></Suspense>;
}

function SettingsTheme() {
  const { user } = useAuth();
  const { db } = useData();
  useEffect(() => {
    const theme = user ? String(db.userPreferences[user.uid]?.theme ?? 'dark') : 'dark';
    document.documentElement.dataset.theme = theme;
  }, [user?.uid, db.userPreferences]);
  return null;
}

export default function App() {
  return <AppErrorBoundary><SettingsTheme /><Suspense fallback={<AppLoading />}><Routes>
    <Route path="/" element={<RootRedirect />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route element={<AuthenticatedLayout />}>
      <Route path="/dashboard" element={<RoleGate roles={['TRAINEE']}><Dashboard /></RoleGate>} />
      <Route path="/assessment" element={<RoleGate roles={['TRAINEE']}><Assessment /></RoleGate>} />
      <Route path="/missions" element={<RoleGate roles={['TRAINEE']}><MissionLibrary /></RoleGate>} />
      <Route path="/missions/generate" element={<RoleGate roles={['TRAINEE']}><MissionGenerator /></RoleGate>} />
      <Route path="/simulation/:missionId" element={<RoleGate roles={['TRAINEE']}><Simulation /></RoleGate>} />
      <Route path="/review/:missionId" element={<RoleGate roles={['TRAINEE', 'INSTRUCTOR', 'ADMIN']}><Review /></RoleGate>} />
      <Route path="/replay" element={<RoleGate roles={['TRAINEE']}><ReplayLibrary /></RoleGate>} />
      <Route path="/analytics" element={<RoleGate roles={['TRAINEE', 'INSTRUCTOR', 'ADMIN']}><Analytics /></RoleGate>} />
      <Route path="/passport" element={<RoleGate roles={['TRAINEE']}><Passport /></RoleGate>} />
      <Route path="/certifications" element={<RoleGate roles={['TRAINEE']}><CertificationsPage /></RoleGate>} />
      <Route path="/instructor" element={<RoleGate roles={['INSTRUCTOR', 'ADMIN']}><InstructorDashboard /></RoleGate>} />
      <Route path="/instructor/trainees/:userId" element={<RoleGate roles={['INSTRUCTOR', 'ADMIN']}><TraineeProfilePage /></RoleGate>} />
      <Route path="/admin" element={<RoleGate roles={['ADMIN']}><Admin /></RoleGate>} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/profile" element={<RoleProfileRedirect />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes></Suspense></AppErrorBoundary>;
}

function RoleProfileRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'TRAINEE' ? '/passport' : '/settings'} replace />;
}

function NotFound() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return <div className="not-found"><span className="not-found-icon"><Radar size={23} /></span><div className="eyebrow">ROUTE / NOT FOUND</div><h1>This coordinate is off the map.</h1><p>The page may have moved. Your training records remain safe.</p><Button onClick={() => navigate(user ? roleHome(user.role) : '/')}>RETURN TO AUTHORIZED HOME <ArrowLeft size={14} /></Button></div>;
}
