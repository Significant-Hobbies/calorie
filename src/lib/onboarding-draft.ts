import type { UserProfile } from './types';

export type OnboardingDraft = UserProfile & {
  initialWeightKg: number | null;
  initialWeightId: string;
};

type StoredDraft = {
  version: 2;
  step: number;
  draft: OnboardingDraft;
};

const PREFIX = 'calorie-onboarding-v2:';

function keyFor(userId: string) {
  return `${PREFIX}${userId}`;
}

export function readOnboardingDraft(userId: string): StoredDraft | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(keyFor(userId)) ?? 'null') as StoredDraft | null;
    if (
      parsed?.version !== 2 ||
      parsed.draft?.userId !== userId ||
      !Number.isInteger(parsed.step) ||
      parsed.step < 0 ||
      parsed.step > 2
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveOnboardingDraft(userId: string, step: number, draft: OnboardingDraft) {
  localStorage.setItem(keyFor(userId), JSON.stringify({ version: 2, step, draft }));
}

export function clearOnboardingDraft(userId: string) {
  localStorage.removeItem(keyFor(userId));
}

export function clearAllOnboardingDrafts() {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
  }
}
