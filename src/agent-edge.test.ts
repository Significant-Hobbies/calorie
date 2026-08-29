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
    const catalog = (await response.json()) as {
      name: string;
      surfaces: Array<{ url: string; md: string }>;
    };
    expect(catalog).toMatchObject({ name: 'Calorie' });
    expect(catalog.surfaces).toHaveLength(6);
    expect(catalog.surfaces.every((surface) => surface.url && surface.md)).toBe(true);
  });

  it.each([
    ['/privacy/', '/privacy/index.md', 'Calorie privacy'],
    ['/support/', '/support/index.md', 'Calorie support'],
    ['/terms/', '/terms/index.md', 'Calorie terms'],
    ['/accessibility/', '/accessibility/index.md', 'Calorie accessibility'],
    ['/testflight/', '/testflight/index.md', 'Calorie TestFlight status'],
  ])('serves a truthful Markdown alternate for %s', async (route, markdownPath, heading) => {
    const [negotiated, direct] = await Promise.all([
      app.request(`https://calorie.significanthobbies.com${route}`, {
        headers: { accept: 'text/markdown' },
      }),
      app.request(`https://calorie.significanthobbies.com${markdownPath}`),
    ]);

    for (const response of [negotiated, direct]) {
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/markdown');
      expect(await response.text()).toContain(`# ${heading}`);
    }
  });

  it('serves truthful pricing, instructions, and digest-verified skill discovery', async () => {
    const [pricing, instructions, skill, index, aiCatalog] = await Promise.all([
      app.request('https://calorie.significanthobbies.com/pricing.md'),
      app.request('https://calorie.significanthobbies.com/agents.md'),
      app.request(
        'https://calorie.significanthobbies.com/.well-known/agent-skills/calorie-product-guide/SKILL.md'
      ),
      app.request('https://calorie.significanthobbies.com/.well-known/agent-skills/index.json'),
      app.request('https://calorie.significanthobbies.com/.well-known/ai-catalog.json'),
    ]);

    expect(await pricing.text()).toContain('no paid plan, subscription, or checkout');
    expect(await instructions.text()).toContain('Do not claim access');
    expect(await skill.text()).toContain('name: calorie-product-guide');
    expect(await index.json()).toMatchObject({
      skills: [
        {
          name: 'calorie-product-guide',
          digest: 'sha256:4a380ff01f3b2d3cb20efca4c40c981e9d00fbf71c7fe0e0b7ce4392bad926fd',
        },
      ],
    });
    const aiCatalogBody = await aiCatalog.json();
    expect(aiCatalogBody).toMatchObject({ specVersion: '1.0' });
    expect(aiCatalogBody.entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ displayName: 'Calorie product guide' })])
    );
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
