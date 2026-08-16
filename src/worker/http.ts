/**
 * Weak ETag helper for read-only API responses. Combines the user ID, request
 * query string, and a 30-second time bucket so responses are cacheable for 30s
 * on the client and via conditional requests (If-None-Match → 304).
 */
function etagFor(userId: string, query: string): string {
  const bucket = Math.floor(Date.now() / 30_000);
  return `W/"${userId}:${bucket}:${query.length}"`;
}

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export function conditionalJson<T>(
  c: {
    req: { url: string; header: (name: string) => string | undefined };
    get: (key: 'userId') => string;
    header: (name: string, value: string) => void;
    json: (data: T) => Response;
    body: (data: null, status: number) => Response;
  },
  data: T
): Response {
  const tag = etagFor(c.get('userId'), new URL(c.req.url).search);
  if (c.req.header('If-None-Match') === tag) return c.body(null, 304);
  c.header('ETag', tag);
  c.header('Cache-Control', 'private, max-age=30');
  return c.json(data);
}

export function finiteNumber(value: unknown, min: number, max: number): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export function optionalText(value: unknown, max = 80): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

export function requiredText(value: unknown, max = 80): string | null {
  return optionalText(value, max);
}

export function validTimestamp(value: unknown): number | null {
  const timestamp = finiteNumber(value, 0, Date.now() + 24 * 60 * 60 * 1000);
  return timestamp === null ? null : Math.round(timestamp);
}

export function jsonError(message: string, fields?: Record<string, string>) {
  return { code: 'VALIDATION_ERROR', message, fields };
}

export function validDateKey(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function parseRange(c: {
  req: { query: (name: string) => string | undefined };
}): { start: number; end: number } | null {
  const start = finiteNumber(c.req.query('start'), 0, Date.now() + 24 * 60 * 60 * 1000);
  const end = finiteNumber(c.req.query('end'), 0, Date.now() + 48 * 60 * 60 * 1000);
  if (start === null || end === null || end <= start || end - start > 366 * 24 * 60 * 60 * 1000) {
    return null;
  }
  return { start, end };
}

export function dateKey(timestamp: number, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp);
}
