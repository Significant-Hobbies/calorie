import { ArrowLeft } from 'lucide-react';
import { AppMark } from '../components/AppMark';

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const privacy = kind === 'privacy';

  return (
    <main className="legal-page" id="main-content">
      <a className="legal-back" href="/">
        <ArrowLeft size={18} aria-hidden="true" />
        Back to Calorie
      </a>
      <AppMark size="large" />
      <article>
        <p className="eyebrow">Calorie</p>
        <h1>{privacy ? 'Privacy policy' : 'Terms of use'}</h1>
        <p className="legal-date">Effective 25 July 2026</p>

        {privacy ? (
          <>
            <h2>The short version</h2>
            <p>
              Calorie is a private food, water, and weight journal. You can use it entirely on your
              device without an account. If you choose Google sign-in, your journal is stored in a
              private Cloudflare database linked to your account.
            </p>
            <h2>Data we process</h2>
            <p>
              Local mode stores profile answers, foods, meals, water, and weight only in this
              browser. Google mode also receives your Google account identifier, name, email
              address, and profile image, and stores journal data in the cloud so it can follow your
              account.
            </p>
            <h2>How data is used</h2>
            <p>
              Data is used only to operate your journal, sync it when you request cloud mode, and
              calculate the estimates shown in the app. Calorie does not sell personal data, display
              advertising, or train AI models on your journal.
            </p>
            <h2>Storage and choices</h2>
            <p>
              You can leave local mode or sign out at any time. Clearing browser storage removes
              local-mode data from that browser. Cloud data remains private to the signed-in account
              until deletion tooling is provided or a deletion request is fulfilled.
            </p>
            <h2>Health information</h2>
            <p>
              Food, weight, and routine data can be sensitive. Avoid entering information you do not
              want stored. Calorie provides mathematical estimates, not medical advice.
            </p>
          </>
        ) : (
          <>
            <h2>Using Calorie</h2>
            <p>
              You may use Calorie for personal food, water, weight, and routine tracking. Keep
              access to your device and Google account secure, and do not misuse the service or
              interfere with its operation.
            </p>
            <h2>Estimates, not medical advice</h2>
            <p>
              Calorie uses published equations and simple rules to produce energy, nutrient,
              fasting, gym, and sleep estimates. They are informational and are not diagnosis,
              treatment, or a substitute for a qualified healthcare professional.
            </p>
            <h2>Your data</h2>
            <p>
              You retain ownership of the information you enter. You grant Calorie only the limited
              permission needed to store, process, and display it back to you.
            </p>
            <h2>Availability</h2>
            <p>
              The service is provided as available and may change. Local mode is designed to keep
              working without an account, but browser storage can be cleared by you, the browser, or
              the operating system.
            </p>
            <h2>Responsible use</h2>
            <p>
              Do not rely on Calorie for urgent or high-stakes health decisions. Stop using a
              recommendation that feels unsafe and seek professional guidance when appropriate.
            </p>
          </>
        )}
      </article>
    </main>
  );
}
