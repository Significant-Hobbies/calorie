import { describe, expect, it } from 'vitest';
import app from './worker';

describe('public agent surfaces', () => {
  it('serves the catalog before private API middleware', async () => {
    const response = await app.request('https://calorie.significanthobbies.com/api/ai');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toMatchObject({ name: 'Calorie' });
  });

  it('negotiates homepage Markdown without exposing journal data', async () => {
    const response = await app.request('https://calorie.significanthobbies.com/', {
      headers: { accept: 'text/markdown' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/markdown');
    const body = await response.text();
    expect(body).toMatch(/^# Calorie/);
    expect(body).toContain('No public food, water, weight, profile, or journal data');
  });
});
