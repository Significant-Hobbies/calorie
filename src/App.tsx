import { useEffect, useState } from 'react';
import { AppMark } from './components/AppMark';
import { AppShell, type AppTab } from './components/AppShell';
import { getProfile, startOfflineRetry } from './lib/api';
import { type AppSession, getSession } from './lib/auth-client';
import type { UserProfile } from './lib/types';
import { FoodsPage } from './pages/FoodsPage';
import { LegalPage } from './pages/LegalPage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ProgressPage } from './pages/ProgressPage';
import { SettingsPage } from './pages/SettingsPage';
import { TodayPage } from './pages/TodayPage';

type AppState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'onboarding'; session: NonNullable<AppSession>; profile: UserProfile }
  | { status: 'ready'; session: NonNullable<AppSession>; profile: UserProfile }
  | { status: 'error'; message: string };

export default function App() {
  const legalKind =
    location.pathname === '/privacy' ? 'privacy' : location.pathname === '/terms' ? 'terms' : null;
  const [state, setState] = useState<AppState>({ status: 'loading' });
  const [tab, setTab] = useState<AppTab>(() =>
    new URLSearchParams(location.search).get('quick') === 'food' ? 'foods' : 'today'
  );

  useEffect(() => {
    if (legalKind) return;
    const stopRetry = startOfflineRetry();
    void (async () => {
      const session = await getSession();
      if (!session) {
        setState({ status: 'signed-out' });
        return;
      }
      try {
        const profile = await getProfile();
        setState({
          status: profile.onboardingComplete ? 'ready' : 'onboarding',
          session,
          profile,
        });
      } catch (error) {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Calorie could not open.',
        });
      }
    })();
    return stopRetry;
  }, [legalKind]);

  if (legalKind) return <LegalPage kind={legalKind} />;

  if (state.status === 'loading') {
    return (
      <main className="splash" aria-busy="true">
        <AppMark size="large" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
      </main>
    );
  }

  if (state.status === 'signed-out') {
    return <LoginPage />;
  }

  if (state.status === 'error') {
    return (
      <main className="state-page">
        <AppMark size="large" />
        <h1>We couldn’t open your log</h1>
        <p>{state.message}</p>
        <button className="button button-primary" type="button" onClick={() => location.reload()}>
          Try again
        </button>
      </main>
    );
  }

  if (state.status === 'onboarding') {
    return (
      <OnboardingPage
        initialProfile={state.profile}
        onComplete={(profile) => setState({ status: 'ready', session: state.session, profile })}
      />
    );
  }

  const content =
    tab === 'today' ? (
      <TodayPage onOpenFoods={() => setTab('foods')} />
    ) : tab === 'progress' ? (
      <ProgressPage />
    ) : tab === 'foods' ? (
      <FoodsPage />
    ) : (
      <SettingsPage
        profile={state.profile}
        onProfileChange={(profile) => setState({ ...state, profile })}
      />
    );

  return (
    <AppShell
      tab={tab}
      onTabChange={setTab}
      user={state.session.user}
      displayName={state.profile.displayName}
    >
      {content}
    </AppShell>
  );
}
