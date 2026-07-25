import { ArrowRight, Calculator, Cloud, Droplets, Leaf, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppMark } from '../components/AppMark';
import { getAuthConfig, signInWithGoogle, startLocalMode } from '../lib/auth-client';

export function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);

  useEffect(() => {
    void getAuthConfig().then((config) => setGoogleConfigured(config.googleConfigured));
  }, []);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google sign-in could not start.');
      setBusy(false);
    }
  };

  const startDemo = (onboarding: boolean) => {
    sessionStorage.setItem('calorie-demo', 'true');
    sessionStorage.setItem('calorie-demo-onboarding', String(onboarding));
    window.location.reload();
  };

  return (
    <main className="login-page" id="main-content">
      <section className="login-intro">
        <AppMark size="large" />
        <div className="login-copy">
          <h1>A little log for feeling good.</h1>
          <p>
            Track food, water, weight, and the four nutrients you care about—then see useful timing
            estimates without an AI coach watching over you.
          </p>
        </div>

        <ul className="login-benefits" aria-label="What Calorie tracks">
          <li>
            <Leaf aria-hidden="true" />
            <span>Food in one tap</span>
          </li>
          <li>
            <Droplets aria-hidden="true" />
            <span>Water & weight history</span>
          </li>
          <li>
            <Calculator aria-hidden="true" />
            <span>Math you can inspect</span>
          </li>
        </ul>
      </section>

      <section className="login-action" aria-labelledby="private-log-title">
        <div className="seed-cluster" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <h2 id="private-log-title">Your private daily log</h2>
        <p>
          {googleConfigured
            ? 'Start privately on this device with no account, or use a Google-backed cloud journal.'
            : 'Start privately on this device with no account. Your journal stays in this browser.'}
        </p>
        <button
          className="button button-primary button-large"
          type="button"
          onClick={startLocalMode}
        >
          <Smartphone size={19} aria-hidden="true" />
          Start on this device
          <ArrowRight size={19} aria-hidden="true" />
        </button>
        {googleConfigured ? (
          <button
            className="button button-secondary button-large google-button"
            type="button"
            disabled={busy}
            onClick={() => void signIn()}
          >
            <Cloud size={19} aria-hidden="true" />
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </button>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="privacy-note">
          Local mode stays in this browser. No ads. No social feed. No food judgment.
        </p>
        <nav className="legal-links" aria-label="Legal">
          <a href="/privacy">Privacy</a>
          <span aria-hidden="true">·</span>
          <a href="/terms">Terms</a>
        </nav>

        {import.meta.env.DEV ? (
          <div className="demo-actions">
            <span>Local previews</span>
            <button type="button" onClick={() => startDemo(false)}>
              Filled day
            </button>
            <button type="button" onClick={() => startDemo(true)}>
              Onboarding
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
