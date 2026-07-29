import { useEffect } from 'react';
import { AppMark } from '../components/AppMark';

const REPOSITORY = 'https://github.com/Significant-Hobbies/calorie';
const RELEASES = [
  {
    date: '2026-07-29',
    title: 'Calendar days now show what you ate',
    outcomes: [
      'Selecting a date in history now reveals its food entries in chronological order.',
      'The same detail view works for device-only, demo, and private cloud journals.',
    ],
  },
  {
    date: '2026-07-28',
    title: 'Eating rhythm became visible',
    outcomes: [
      'Seven- and thirty-day views now turn food timestamps into transparent meal-timing patterns.',
      'Suggestions show their samples and assumptions instead of presenting timing as medical advice.',
    ],
  },
  {
    date: '2026-07-27',
    title: 'More honest daily tracking',
    outcomes: [
      'Calorie targets are now framed relative to maintenance, and water can be logged beyond the daily target.',
      'Private medication routines, dark mode, direct one-off foods, and editable entries joined the daily journal.',
    ],
  },
  {
    date: '2026-07-25',
    title: 'Calorie v1',
    outcomes: [
      'The first installable, local-first journal shipped with food, nutrient, water, weight, fasting, exercise, and sleep estimates.',
      'Optional Google sign-in adds a private account copy while device-only use remains a first-class path.',
    ],
  },
] as const;

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ChangelogPage() {
  useEffect(() => {
    document.title = 'Changelog · Calorie';
  }, []);

  return (
    <main className="changelog-page" id="main-content">
      <header className="changelog-header">
        <a href="/" aria-label="Calorie home">
          <AppMark size="large" />
        </a>
        <p className="eyebrow">Product history</p>
        <h1>What changed in Calorie</h1>
        <p>A concise record of meaningful improvements to the private food and timing journal.</p>
        <nav className="project-links" aria-label="Project links">
          <a href={`${REPOSITORY}/issues`}>Roadmap</a>
          <a href={REPOSITORY}>Source</a>
        </nav>
      </header>

      <ol className="changelog-list">
        {RELEASES.map((release) => (
          <li key={`${release.date}-${release.title}`}>
            <article className="changelog-entry">
              <time dateTime={release.date}>{formatDate(release.date)}</time>
              <h2>{release.title}</h2>
              <ul>
                {release.outcomes.map((outcome) => (
                  <li key={outcome}>{outcome}</li>
                ))}
              </ul>
            </article>
          </li>
        ))}
      </ol>
    </main>
  );
}
