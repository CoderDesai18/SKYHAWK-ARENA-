import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { UserProfile } from '../types';
import { auth, firebaseConfigured } from '../lib/firebaseClient';
import { getSupabaseClient, supabaseConfigured } from '../lib/supabaseClient';
import { createCloudProfile, readCloudProfile, saveProfileBoth } from '../lib/cloud';
import { getCurrentLocalProfile, loginDemo as demoLogin, loginWithEmail, loginWithGoogle, logoutEverywhere, profileFromSupabaseUser, registerWithEmail, resendVerification, verifyCurrentEmail } from '../lib/auth';
import { getDb, isDemoProfile, saveProfile } from '../lib/store';

interface AuthContextShape {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<UserProfile>;
  signInDemo: (role?: 'TRAINEE' | 'INSTRUCTOR' | 'ADMIN') => Promise<UserProfile>;
  signInGoogle: () => Promise<UserProfile | null>;
  register: (name: string, email: string, password: string) => Promise<UserProfile>;
  signOut: () => Promise<void>;
  verifyEmail: () => Promise<UserProfile | null>;
  resendEmailVerification: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUser: (patch: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextShape | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let firebaseReady = !firebaseConfigured || !auth;
    let supabaseReady = !supabaseConfigured;
    let unsubscribeFirebase: (() => void) | undefined;
    let unsubscribeSupabase: (() => void) | undefined;
    const finishLoading = () => { if (active && firebaseReady && supabaseReady) setLoading(false); };
    const restoreLocalOrSupabase = async () => {
      if (supabaseConfigured) {
        try {
          const client = await getSupabaseClient();
          const { data } = client ? await client.auth.getUser() : { data: { user: null } };
          if (data.user) {
            const profile = profileFromSupabaseUser(data.user);
            if (active) setUser(profile);
            return;
          }
        } catch (error) { console.warn('Supabase session restore is unavailable.', error); }
      }
      const local = await getCurrentLocalProfile();
      const allowedLocal = local && (isDemoProfile(local.uid) || (!firebaseConfigured && !supabaseConfigured));
      if (active) setUser(allowedLocal ? local : null);
    };

    if (firebaseConfigured && auth) {
      unsubscribeFirebase = onAuthStateChanged(auth, async (firebaseUser) => {
        try {
          if (firebaseUser) {
            const existing = await readCloudProfile(firebaseUser.uid);
            const current = existing ?? await createCloudProfile(firebaseUser);
            if (active) setUser({ ...current, emailVerified: firebaseUser.emailVerified });
          } else {
            await restoreLocalOrSupabase();
          }
        } catch (error) {
          console.warn('Profile could not be fetched from Firebase; a local or Supabase session may still be available.', error);
          await restoreLocalOrSupabase();
        } finally { firebaseReady = true; finishLoading(); }
      });
    }

    if (supabaseConfigured) {
      void getSupabaseClient().then((client) => {
        if (!active) return;
        if (!client) { supabaseReady = true; finishLoading(); return; }
        const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            const profile = profileFromSupabaseUser(session.user);
            if (active) setUser(profile);
            supabaseReady = true;
            finishLoading();
          } else if (!auth?.currentUser) {
            void restoreLocalOrSupabase().finally(() => { supabaseReady = true; finishLoading(); });
          } else {
            supabaseReady = true;
            finishLoading();
          }
        });
        unsubscribeSupabase = () => subscription.unsubscribe();
      }).catch((error) => { console.warn('Supabase Auth is unavailable; Firebase or local demo access can still be used.', error); void restoreLocalOrSupabase().finally(() => { supabaseReady = true; finishLoading(); }); });
    }

    if (!firebaseConfigured && !supabaseConfigured) {
      getCurrentLocalProfile().then((profile) => { if (active) setUser(profile); }).finally(() => { if (active) setLoading(false); });
    } else {
      finishLoading();
    }

    return () => {
      active = false;
      unsubscribeFirebase?.();
      unsubscribeSupabase?.();
    };
  }, []);

  const value = useMemo<AuthContextShape>(() => ({
    user,
    loading,
    signIn: async (email, password) => {
      const profile = await loginWithEmail(email, password);
      setUser(profile);
      return profile;
    },
    signInDemo: async (role = 'TRAINEE') => {
      const profile = await demoLogin(role);
      setUser(profile);
      return profile;
    },
    signInGoogle: async () => {
      const profile = await loginWithGoogle();
      if (profile) setUser(profile);
      return profile;
    },
    register: async (name, email, password) => {
      const profile = await registerWithEmail(name, email, password);
      setUser(profile);
      return profile;
    },
    signOut: async () => {
      await logoutEverywhere();
      setUser(null);
    },
    verifyEmail: async () => {
      if (!user) return null;
      const updated = await verifyCurrentEmail(user.uid);
      if (updated) setUser(updated);
      return updated;
    },
    resendEmailVerification: async () => { await resendVerification(user?.email); },
    refreshProfile: async () => {
      if (!user) return;
      if (supabaseConfigured) {
        const client = await getSupabaseClient();
        const { data } = client ? await client.auth.getUser() : { data: { user: null } };
        if (data.user?.id === user.uid) { setUser(profileFromSupabaseUser(data.user)); return; }
      }
      const local = getDb().users.find((profile) => profile.uid === user.uid);
      if (local) setUser(local);
      else if (firebaseConfigured) {
        const remote = await readCloudProfile(user.uid);
        if (remote) setUser(remote);
      }
    },
    updateUser: async (patch) => {
      if (!user) return;
      const next = { ...user, ...patch, uid: user.uid, role: user.role };
      saveProfile(next);
      setUser(next);
      if (supabaseConfigured) {
        const client = await getSupabaseClient();
        const { data } = client ? await client.auth.getUser() : { data: { user: null } };
        if (data.user?.id === user.uid && client) {
          const { error } = await client.auth.updateUser({ data: { full_name: next.name, avatar_url: next.photoURL } });
          if (error) console.warn('Supabase profile metadata update is deferred.', error);
          return;
        }
      }
      if (firebaseConfigured && auth?.currentUser?.uid === user.uid) {
        try { await saveProfileBoth(next); } catch (error) { console.warn('Profile update queued locally.', error); }
      }
    }
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextShape {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
