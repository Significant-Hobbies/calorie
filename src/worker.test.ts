import { describe, expect, it } from 'vitest';
import { DASHBOARD_FOODS_QUERY } from './server/queries';

describe('dashboard food query', () => {
  it('returns every active food owned by the user in selector order', () => {
    const query = DASHBOARD_FOODS_QUERY.replace(/\s+/g, ' ').trim();

    expect(query).toContain('WHERE user_id = ? AND archived_at IS NULL');
    expect(query).toContain('ORDER BY last_used_at DESC, name ASC');
    expect(query).not.toMatch(/\bLIMIT\s+\d+\b/i);
  });
});
