type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let installPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    listeners.forEach((listener) => {
      listener();
    });
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    listeners.forEach((listener) => {
      listener();
    });
  });
}

export function canPromptInstall() {
  return installPrompt !== null;
}

export function isInstalledApp() {
  return matchMedia('(display-mode: standalone)').matches;
}

export function subscribeToInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function promptInstall() {
  if (!installPrompt) return false;
  await installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  if (choice.outcome === 'accepted') installPrompt = null;
  listeners.forEach((listener) => {
    listener();
  });
  return choice.outcome === 'accepted';
}
