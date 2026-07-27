import { cachePrivateValue, clearLocalData, deletePrivateValue, readPrivateValue } from './offline';
import { clearAllOnboardingDrafts } from './onboarding-draft';

export type AppSession = {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
} | null;

export async function getAuthConfig() {
  try {
    const response = await fetch('/api/auth/config', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) return { googleConfigured: false };
    return (await response.json()) as { googleConfigured: boolean };
  } catch {
    return { googleConfigured: false };
  }
}

export async function getSession(): Promise<AppSession> {
  if (localStorage.getItem('calorie-local-mode') === 'true') {
    return {
      user: {
        id: 'local-user',
        name: 'Local journal',
        email: '',
      },
    };
  }
  if (sessionStorage.getItem('calorie-demo')) {
    return {
      user: {
        id: 'demo-user',
        name: 'Sam',
        email: 'demo@calorie.local',
      },
    };
  }
  try {
    const response = await fetch('/api/auth/get-session', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) {
      if (response.status === 401) await deletePrivateValue('session');
      return null;
    }
    const session = (await response.json()) as AppSession;
    if (session?.user) await cachePrivateValue('session', session);
    return session?.user ? session : null;
  } catch {
    return navigator.onLine ? null : readPrivateValue<AppSession>('session');
  }
}

export function startLocalMode() {
  localStorage.setItem('calorie-local-mode', 'true');
  window.location.reload();
}

export async function signInWithGoogle() {
  const response = await fetch('/api/auth/sign-in/social', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'google',
      callbackURL: window.location.origin,
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    url?: string;
    message?: string;
  } | null;
  if (!response.ok) {
    throw new Error(data?.message ?? 'Google sign-in could not start.');
  }
  window.location.href = data?.url ?? '/';
}

export async function signOut() {
  if (localStorage.getItem('calorie-local-mode') === 'true') {
    localStorage.removeItem('calorie-local-mode');
    window.location.reload();
    return;
  }
  localStorage.removeItem('calorie-local-mode');
  clearAllOnboardingDrafts();
  sessionStorage.removeItem('calorie-demo');
  sessionStorage.removeItem('calorie-demo-onboarding');
  await clearLocalData();
  const response = await fetch('/api/auth/sign-out', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(result?.message ?? 'Sign out could not be completed.');
  }
  window.location.reload();
}
