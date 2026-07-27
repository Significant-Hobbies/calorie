import type { ThemePreference } from './types';

const THEME_KEY = 'calorie-theme';

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'system' || stored === 'dark' ? stored : 'light';
}

function resolvedTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(preference = getThemePreference()) {
  const theme = resolvedTheme(preference);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function setThemePreference(preference: ThemePreference) {
  localStorage.setItem(THEME_KEY, preference);
  applyTheme(preference);
}

export function watchSystemTheme() {
  const media = matchMedia('(prefers-color-scheme: dark)');
  const update = () => {
    if (getThemePreference() === 'system') applyTheme('system');
  };
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
}
