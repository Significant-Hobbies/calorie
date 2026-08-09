export function normalizeIsPackaged(value: unknown, legacyFoodKind?: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1) return true;
  if (value === 0) return false;
  return legacyFoodKind === 'packaged';
}

export function normalizeFoodLabels(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(raw.map((label) => String(label).trim().toLocaleLowerCase()).filter(Boolean))]
    .slice(0, 8)
    .map((label) => label.slice(0, 24));
}
