import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut as firebaseSignOut, updateProfile as updateFirebaseProfile, EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import type { AuthUser as SupabaseUser } from '@supabase/supabase-js';
import type { UserProfile } from '../types';
import { auth, firestore, firebaseConfigured } from './firebaseClient';
import { getSupabaseClient, supabaseConfigured } from './supabaseClient';
import { createCloudProfile, readCloudProfile, saveCloudProfile } from './cloud';
import { getDb, getLocalSession, saveProfile, setLocalSession, updateDb } from './store';

const DEMO_PASSWORD = 'Skyhawk2026!';

async function hashPassword(value: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(value);
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map((part) => part.toString(16).padStart(2, '0')).join('');
  }
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `fallback-${(hash >>> 0).toString(16)}`;
}

function makeLocalProfile(name: string, email: string, uid: string): UserProfile {
  const time = new Date().toISOString();
  return {
    uid, name, email, role: 'TRAINEE', createdAt: time, lastLogin: time, trainingLevel: 'BEGINNER', overallScore: 0, missionsCompleted: 0,
    certificationStatus: 'NOT STARTED', baselineCompleted: false,
    skills: { detection: 50, tracking: 50, navigation: 50, accuracy: 50, reactionTime: 50, decisionMaking: 50, situationalAwareness: 50, objectiveCompletion: 50 },
    averageReactionMs: 0, successRate: 0, recommendedDifficulty: 'BEGINNER', emailVerified: false, active: true
  };
}

export function profileFromSupabaseUser(user: SupabaseUser): UserProfile {
  const current = getDb().users.find((profile) => profile.uid === user.id);
  const metadata = user.user_metadata ?? {};
  const roleCandidate = user.app_metadata?.role;
  const role: UserProfile['role'] = roleCandidate === 'ADMIN' || roleCandidate === 'INSTRUCTOR' ? roleCandidate : 'TRAINEE';
  const name = String(metadata.full_name ?? metadata.name ?? current?.name ?? user.email?.split('@')[0] ?? 'Trainee');
  const profile: UserProfile = {
    ...(current ?? makeLocalProfile(name, user.email ?? '', user.id)),
    uid: user.id,
    name,
    email: user.email ?? current?.email ?? '',
    role,
    photoURL: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : current?.photoURL,
    emailVerified: Boolean(user.email_confirmed_at),
    lastLogin: new Date().toISOString()
  };
  saveProfile(profile);
  return profile;
}

async function signInWithSupabase(email: string, password: string): Promise<UserProfile> {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase authentication is not configured.');
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Supabase did not return an authenticated user.');
  const profile = profileFromSupabaseUser(data.user);
  setLocalSession(profile.uid);
  return profile;
}

export async function loginWithEmail(email: string, password: string): Promise<UserProfile> {
  const normalized = email.trim().toLowerCase();
  const localDb = getDb();
  const localExpected = localDb.credentials[normalized];
  const localProfile = localDb.users.find((item) => item.email.toLowerCase() === normalized);
  const localHashMatches = localExpected && localExpected === await hashPassword(password);
  const demoPasswordMatches = Boolean(localProfile?.uid.startsWith('demo-') && password === DEMO_PASSWORD);
  if (localExpected && (localHashMatches || demoPasswordMatches)) {
    const profile = localProfile;
    if (!profile) throw new Error('This account profile could not be found. Please register again.');
    const updated = { ...profile, lastLogin: new Date().toISOString() };
    updateDb((state) => { const i = state.users.findIndex((item) => item.uid === updated.uid); if (i >= 0) state.users[i] = updated; });
    setLocalSession(updated.uid);
    return updated;
  }
  if (firebaseConfigured && auth) {
    try {
      const credential = await signInWithEmailAndPassword(auth, normalized, password);
      const existing = await readCloudProfile(credential.user.uid);
      const profile = existing ? { ...existing, lastLogin: new Date().toISOString(), emailVerified: credential.user.emailVerified } : await createCloudProfile(credential.user);
      await saveCloudProfile(profile);
      setLocalSession(null);
      return profile;
    } catch (firebaseError) {
      if (supabaseConfigured) return signInWithSupabase(normalized, password);
      throw firebaseError;
    }
  }
  if (supabaseConfigured) return signInWithSupabase(normalized, password);
  throw new Error('Email or password is incorrect. Try a demo account or create a new trainee profile.');
}

export async function loginDemo(role: 'TRAINEE' | 'INSTRUCTOR' | 'ADMIN' = 'TRAINEE'): Promise<UserProfile> {
  const email = role === 'TRAINEE' ? 'pilot.demo@skyhawk.ai' : role === 'INSTRUCTOR' ? 'instructor.demo@skyhawk.ai' : 'admin.demo@skyhawk.ai';
  return loginWithEmail(email, DEMO_PASSWORD);
}

export async function registerWithEmail(name: string, email: string, password: string): Promise<UserProfile> {
  const normalized = email.trim().toLowerCase();
  if (firebaseConfigured && auth && firestore) {
    try {
      const credential = await createUserWithEmailAndPassword(auth, normalized, password);
      await updateFirebaseProfile(credential.user, { displayName: name.trim() });
      try { await sendEmailVerification(credential.user); } catch (error) { console.warn('Verification email could not be sent.', error); }
      const profile = await createCloudProfile(credential.user, { name: name.trim() });
      setLocalSession(null);
      return profile;
    } catch (firebaseError) {
      if (!supabaseConfigured) throw firebaseError;
      console.warn('Firebase registration failed; trying configured Supabase Auth.', firebaseError);
    }
  }
  if (supabaseConfigured) {
    const client = await getSupabaseClient();
    if (!client) throw new Error('Supabase authentication is not configured.');
    const { data, error } = await client.auth.signUp({
      email: normalized,
      password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/verify-email` }
    });
    if (error) throw error;
    if (!data.user) throw new Error('Supabase did not return a new account.');
    const profile = profileFromSupabaseUser(data.user);
    if (data.session) setLocalSession(profile.uid);
    else setLocalSession(null);
    return profile;
  }
  if (getDb().users.some((item) => item.email.toLowerCase() === normalized)) throw new Error('An account with this email already exists. Try signing in instead.');
  const uid = `local-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const user = makeLocalProfile(name.trim(), normalized, uid);
  const hash = await hashPassword(password);
  updateDb((db) => { db.users.unshift(user); db.credentials[normalized] = hash; });
  setLocalSession(uid);
  return user;
}

export async function loginWithGoogle(): Promise<UserProfile | null> {
  if (firebaseConfigured && auth) {
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const existing = await readCloudProfile(result.user.uid);
      const profile = existing ? { ...existing, lastLogin: new Date().toISOString(), emailVerified: result.user.emailVerified } : await createCloudProfile(result.user);
      await saveCloudProfile(profile);
      return profile;
    } catch (firebaseError) {
      if (!supabaseConfigured) throw firebaseError;
      console.warn('Firebase Google sign-in failed; redirecting through Supabase Auth.', firebaseError);
    }
  }
  const client = await getSupabaseClient();
  if (!client) throw new Error('Google sign-in is unavailable. Configure Supabase Auth as a fallback, or use a local demo account.');
  const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  if (error) throw error;
  return null;
}

export async function sendResetOrSetLocal(email: string, newPassword?: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (newPassword && supabaseConfigured) {
    const client = await getSupabaseClient();
    if (client) {
      const { data } = await client.auth.getUser();
      if (data.user) {
        const { error } = await client.auth.updateUser({ password: newPassword });
        if (error) throw error;
        return;
      }
    }
  }
  if (firebaseConfigured && auth && !getDb().credentials[normalized]) {
    await sendPasswordResetEmail(auth, normalized);
    return;
  }
  if (supabaseConfigured && !getDb().credentials[normalized]) {
    const client = await getSupabaseClient();
    if (!client) throw new Error('Supabase authentication is not configured.');
    const { error } = await client.auth.resetPasswordForEmail(normalized, { redirectTo: `${window.location.origin}/forgot-password?reset=1` });
    if (error) throw error;
    return;
  }
  if (!newPassword) throw new Error('Enter a new password to complete a local demo reset.');
  const db = getDb();
  if (!db.credentials[normalized]) throw new Error('No local account was found for that email.');
  const hash = await hashPassword(newPassword);
  updateDb((state) => { state.credentials[normalized] = hash; });
}

export async function verifyCurrentEmail(uid: string): Promise<UserProfile | null> {
  if (firebaseConfigured && auth?.currentUser?.uid === uid) {
    await auth.currentUser.reload();
    const verified = auth.currentUser.emailVerified;
    const existing = await readCloudProfile(uid);
    if (!existing) return null;
    const updated = { ...existing, emailVerified: verified };
    await saveCloudProfile(updated);
    return updated;
  }
  if (supabaseConfigured) {
    const client = await getSupabaseClient();
    if (client) {
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      if (data.user?.id === uid) return profileFromSupabaseUser(data.user);
    }
    return getDb().users.find((item) => item.uid === uid) ?? null;
  }
  const profile = getDb().users.find((item) => item.uid === uid);
  if (!profile) return null;
  const updated = { ...profile, emailVerified: true };
  updateDb((db) => { const index = db.users.findIndex((item) => item.uid === uid); if (index >= 0) db.users[index] = updated; });
  return updated;
}

export async function resendVerification(email?: string): Promise<void> {
  if (firebaseConfigured && auth?.currentUser) { await sendEmailVerification(auth.currentUser); return; }
  if (supabaseConfigured) {
    const client = await getSupabaseClient();
    if (!client) return;
    const { data } = await client.auth.getUser();
    const targetEmail = data.user?.email ?? email;
    if (targetEmail) {
      const { error } = await client.auth.resend({ type: 'signup', email: targetEmail, options: { emailRedirectTo: `${window.location.origin}/verify-email` } });
      if (error) throw error;
    }
  }
}

export async function logoutEverywhere(): Promise<void> {
  setLocalSession(null);
  try { if (firebaseConfigured && auth?.currentUser) await firebaseSignOut(auth); } catch (error) { console.warn('Firebase sign-out failed; local session was cleared.', error); }
  try { if (supabaseConfigured) { const client = await getSupabaseClient(); if (client) await client.auth.signOut(); } } catch (error) { console.warn('Supabase sign-out failed; local session was cleared.', error); }
}

export async function changeAccountPassword(uid: string, currentPassword: string, nextPassword: string): Promise<void> {
  if (firebaseConfigured && auth?.currentUser?.uid === uid && auth.currentUser.email) {
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, nextPassword);
    return;
  }
  if (supabaseConfigured) {
    const client = await getSupabaseClient();
    if (client) {
      const { data } = await client.auth.getUser();
      if (data.user?.id === uid && data.user.email) {
        const { error: verificationError } = await client.auth.signInWithPassword({ email: data.user.email, password: currentPassword });
        if (verificationError) throw new Error('Current password is incorrect, or this account uses Google-only sign-in.');
        const { error } = await client.auth.updateUser({ password: nextPassword });
        if (error) throw error;
        return;
      }
    }
  }
  const profile = getDb().users.find((item) => item.uid === uid);
  if (!profile) throw new Error('Account profile could not be found.');
  const expected = getDb().credentials[profile.email.toLowerCase()];
  if (!expected || expected !== await hashPassword(currentPassword)) throw new Error('Current password is incorrect.');
  const hash = await hashPassword(nextPassword);
  updateDb((db) => { db.credentials[profile.email.toLowerCase()] = hash; });
}

export async function getCurrentLocalProfile(): Promise<UserProfile | null> {
  const uid = getLocalSession();
  if (!uid) return null;
  return getDb().users.find((item) => item.uid === uid) ?? null;
}
