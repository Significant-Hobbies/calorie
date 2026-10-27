import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleAgentEdge } from '../src/agent-edge.mjs';
import { advertisePublic } from '../src/public-readability.mjs';
const origin = 'https://calorie.significanthobbies.com';
const assets = {
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    try {
      return new Response(await readFile(new URL(`../dist${pathname}`, import.meta.url)), {
        headers: {
          'Content-Type': pathname.endsWith('.md') ? 'text/markdown' : 'application/octet-stream',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  },
};
const env = { ASSETS: assets };
const fetch = (path, options) => handleAgentEdge(new Request(origin + path, options), env);
test('source registry covers15 public pages and retains main content/actions', async () => {
  const response = await fetch('/api/md/_catalog');
  const routes = await response.json();
  assert.equal(routes.length, 15);
  for (const route of routes) {
    const direct = await fetch(route.md.replace(origin, ''));
    const negotiated = await fetch(route.path, { headers: { accept: 'text/markdown' } });
    assert.equal(direct.status, 200);
    assert.equal(direct.headers.get('content-location'), route.url);
    assert.equal(await direct.text(), await negotiated.text());
    assert.match(direct.headers.get('link'), /canonical/);
    assert.match(direct.headers.get('x-robots-tag'), /noindex/);
  }
  const home = await (await fetch('/index.md')).text();
  assert.match(home, /See TestFlight status.*https:\/\/calorie.significanthobbies.com\/testflight/);
  assert.match(home, /Calorie Today on iPhone/);
  const full = await (await fetch('/llms-full.txt')).text();
  assert.match(full, /Included 15 of 15/);
  assert.ok(full.length < 500000);
});
test('private and actual-document boundaries preserve downstream behavior', async () => {
  for (const path of ['/app', '/v1/personal/entries', '/api/foods', '/auth', '/dashboard'])
    assert.equal(await fetch(path, { headers: { accept: 'text/markdown' } }), null);
  assert.match(await (await fetch('/skill.md')).text(), /Calorie/);
  assert.equal((await fetch('/missing.md')).status, 404);
  for (const accept of ['text/markdown;q=0', 'text/html, text/markdown', '*/*'])
    assert.equal(await fetch('/', { headers: { accept } }), null);
  const head = await fetch('/privacy.md', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(
    (await fetch('/api/md/privacy', { method: 'OPTIONS' })).headers.get(
      'access-control-allow-origin'
    ),
    '*'
  );
});
test('HTML receives alternate and Vary; crawler policy allows training only outside private paths', async () => {
  const response = await advertisePublic(
    new Request(origin + '/privacy/'),
    new Response('<main>privacy</main>', { headers: { 'content-type': 'text/html' } }),
    assets
  );
  assert.equal(await response.text(), '<main>privacy</main>');
  assert.match(response.headers.get('vary'), /Accept/);
  assert.match(response.headers.get('link'), /privacy\/index.md/);
  const robots = await (await fetch('/robots.txt')).text();
  for (const bot of [
    'GPTBot',
    'ClaudeBot',
    'Google-Extended',
    'Applebot-Extended',
    'CCBot',
    'Bytespider',
  ])
    assert.ok(robots.includes(`User-agent: ${bot}\nAllow: /\nDisallow: /api`));
});

test('unknown Markdown paths cannot advertise off-origin canonicals', async () => {
  const { createAgentSurfaceManifest } = await import('../src/agent-surfaces/manifest.mjs');
  const { createAgentSurfaceHandler } = await import('../src/agent-surfaces/handler.mjs');
  const fixtureOrigin = 'https://public.example';
  const manifest = createAgentSurfaceManifest({
    name: 'Public fixture',
    url: fixtureOrigin,
    summary: 'Public fixture',
    pages: { '/': '# Public' },
  });
  const handler = createAgentSurfaceHandler({ manifest });
  for (const path of ['/api/md//evil.example/x', '//evil.example/x.md']) {
    const response = await handler(new Request(fixtureOrigin + path));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('content-location'), fixtureOrigin + '//evil.example/x');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
    assert.ok(response.headers.get('link').includes(fixtureOrigin + '/llms.txt'));
  }
});

test('legacy agent discovery, sitemap dates and negotiated404 remain available', async () => {
  const index = await (
    await handleAgentEdge(new Request(origin + '/llms.txt'), { ASSETS: assets })
  ).text();
  for (const link of [
    '/skill.md',
    '/pricing.md',
    '/agents.md',
    '/.well-known/agent-skills/index.json',
    '/.well-known/ai-catalog.json',
  ])
    assert.ok(index.includes(origin + link), link);
  assert.ok(index.includes('Not a fit: medical, nutrition, or weight-loss prescriptions'));
  const before = await readFile(new URL('../marketing/sitemap.xml', import.meta.url), 'utf8');
  const after = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
  for (const [, entry] of before.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/g)) {
    const location = entry.match(/<loc>([^<]+)<\/loc>/)?.[1];
    const date = entry.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    if (date) {
      assert.ok(after.includes(`<loc>${location}</loc>`), `Missing dated source URL: ${location}`);
      assert.ok(after.includes(`<loc>${location}</loc><lastmod>${date}</lastmod>`));
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const missing = await handleAgentEdge(
      new Request(origin + '/unknown-public-path', {
        method,
        headers: { accept: 'text/markdown' },
      }),
      { ASSETS: assets }
    );
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('x-robots-tag'), 'noindex, follow');
    assert.equal(missing.headers.get('cache-control'), 'no-store');
    if (method === 'HEAD') assert.equal(await missing.text(), '');
  }
});
