import { describe, expect, it } from 'vitest';
import app from './worker';

describe('public agent surfaces', () => {
  it.each(['/app', '/app/', '/app/today'])('retires the browser journal route %s', async (path) => {
    const response = await app.request(`https://calorie.significanthobbies.com${path}`);
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('/');
  });

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

  it.each(['https://calorie.significanthobbies.com', 'https://calorie-preview.example'])(
    'keeps sitemap and robots on the request origin: %s',
    async (origin) => {
      const [sitemap, robots] = await Promise.all([
        app.request(`${origin}/sitemap.xml`),
        app.request(`${origin}/robots.txt`),
      ]);

      expect(sitemap.status).toBe(200);
      expect(sitemap.headers.get('content-type')).toContain('application/xml');
      const sitemapBody = await sitemap.text();
      expect(sitemapBody).toContain(`<loc>${origin}/</loc>`);
      expect(sitemapBody).toContain(`<loc>${origin}/privacy/</loc>`);
      expect(sitemapBody).toContain(`<loc>${origin}/testflight/</loc>`);
      expect(sitemapBody).not.toContain('/app');
      if (origin !== 'https://calorie.significanthobbies.com') {
        expect(sitemapBody).not.toContain('https://calorie.significanthobbies.com');
      }

      expect(robots.status).toBe(200);
      expect(await robots.text()).toContain(`Sitemap: ${origin}/sitemap.xml`);
    }
  );
});
