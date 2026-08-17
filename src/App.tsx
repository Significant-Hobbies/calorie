import { lazy, type ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import { AppMark } from './components/AppMark';
import { AppShell, type AppTab } from './components/AppShell';
import { getBootstrap, refreshCloudState, startOfflineRetry } from './lib/api';
import { initPosthog, trackPageView } from './lib/analytics';
import type { AppSession } from './lib/auth-client';
import type { UserProfile } from './lib/types';
import { ChangelogPage } from './pages/ChangelogPage';
import { LegalPage } from './pages/LegalPage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { TodayPage } from './pages/TodayPage';

const FoodsPage = lazy(() =>
  import('./pages/FoodsPage').then((module) => ({ default: module.FoodsPage }))
);
const ProgressPage = lazy(() =>
  import('./pages/ProgressPage').then((module) => ({ default: module.ProgressPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage }))
);

type AppState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'onboarding'; session: NonNullable<AppSession>; profile: UserProfile }
  | { status: 'ready'; session: NonNullable<AppSession>; profile: UserProfile }
  | { status: 'error'; message: string };

export default function App() {
  const appPath = location.pathname.replace(/^\/app(?=\/|$)/, '') || '/';
  const legalKind =
    appPath === '/privacy' || appPath === '/privacy/'
      ? 'privacy'
      : appPath === '/terms' || appPath === '/terms/'
        ? 'terms'
        : null;
  const isChangelog = appPath === '/changelog' || appPath === '/changelog/';
  const [state, setState] = useState<AppState>({ status: 'loading' });
  const [tab, setTab] = useState<AppTab>(() =>
    new URLSearchParams(location.search).get('quick') === 'food' ? 'foods' : 'today'
  );
  const [cloudRevision, setCloudRevision] = useState(0);
  const lastCloudRefresh = useRef(0);

  useEffect(() => {
    const cleanup = initPosthog();
    trackPageView();
    return cleanup;
  }, []);

  useEffect(() => {
    if (legalKind || isChangelog) return;
    const stopRetry = startOfflineRetry();
    void (async () => {
      try {
        const bootstrap = await getBootstrap();
        if (!bootstrap) {
          setState({ status: 'signed-out' });
          return;
        }
        const { session, profile } = bootstrap;
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
  }, [isChangelog, legalKind]);

  const readyUserId = state.status === 'ready' ? state.session.user.id : null;
  useEffect(() => {
    if (!readyUserId) return;
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      const now = Date.now();
      if (now - lastCloudRefresh.current < 1_000) return;
      lastCloudRefresh.current = now;
      try {
        if (!(await refreshCloudState(readyUserId))) return;
        const bootstrap = await getBootstrap();
        if (!bootstrap) {
          setState({ status: 'signed-out' });
          return;
        }
        setState({
          status: bootstrap.profile.onboardingComplete ? 'ready' : 'onboarding',
          session: bootstrap.session,
          profile: bootstrap.profile,
        });
        setCloudRevision((revision) => revision + 1);
      } catch {
        // Keep the usable current view; its normal loading and offline states remain authoritative.
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [readyUserId]);

  if (legalKind) return <LegalPage kind={legalKind} />;
  if (isChangelog) return <ChangelogPage />;

  if (state.status === 'loading') {
    return (
      <main className="splash" aria-busy="true" aria-live="polite">
        <AppMark size="large" />
        <p className="splash-status" role="status">
          Opening your food journal…
        </p>
        <div className="skeleton skeleton-line" aria-hidden="true" />
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

  let content: ReactNode;
  switch (tab) {
    case 'today':
      content = (
        <TodayPage
          cloudRevision={cloudRevision}
          onOpenFoods={() => setTab('foods')}
          onOpenSettings={() => setTab('you')}
        />
      );
      break;
    case 'progress':
      content = <ProgressPage cloudRevision={cloudRevision} userId={state.session.user.id} />;
      break;
    case 'foods':
      content = <FoodsPage cloudRevision={cloudRevision} />;
      break;
    case 'you':
      content = (
        <SettingsPage
          profile={state.profile}
          cloudRevision={cloudRevision}
          onProfileChange={(profile) => setState({ ...state, profile })}
        />
      );
      break;
  }

  return (
    <AppShell
      tab={tab}
      onTabChange={setTab}
      user={state.session.user}
      displayName={state.profile.displayName}
    >
      <Suspense
        fallback={
          <div className="page-stack tab-loading" aria-busy="true">
            <span className="sr-only">Opening section</span>
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-line" />
          </div>
        }
      >
        {content}
      </Suspense>
    </AppShell>
  );
}
