import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  PUBLIC_ENTRYPOINTS,
  renderPublicEntrypoint,
} from '../scripts/generate-public-entrypoints.mjs';

const ORIGIN = 'https://calorie.significanthobbies.com';
const indexHtml = readFileSync('index.html', 'utf8');
const landingHtml = readFileSync('marketing/index.html', 'utf8');
const sitemapXml = readFileSync('public/sitemap.xml', 'utf8');

const CANONICAL_PATTERN = /<link rel="canonical" href="([^"]+)"\s*\/?>/;
const LOC_PATTERN = /<loc>([^<]+)<\/loc>/g;

function canonicalFromHtml(html: string): string {
  const match = html.match(CANONICAL_PATTERN);
  if (!match) throw new Error('Missing <link rel="canonical"> tag');
  return match[1];
}

function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(LOC_PATTERN)].map((match) => match[1]);
}

describe('sitemap/canonical parity', () => {
  // Regression guard for issue #37: every URL advertised in sitemap.xml must
  // ship an exact self-canonical, and every public entrypoint canonical must be
  // listed in the sitemap. Drift in either direction fails the build.
  it('matches every sitemap URL to an exact self-canonical entrypoint', () => {
    const canonicalUrls = new Set<string>([
      canonicalFromHtml(landingHtml),
      canonicalFromHtml(indexHtml),
    ]);
    for (const entry of PUBLIC_ENTRYPOINTS) {
      canonicalUrls.add(canonicalFromHtml(renderPublicEntrypoint(indexHtml, entry)));
    }

    expect([...canonicalUrls].sort()).toEqual(sitemapUrls(sitemapXml).sort());
  });

  it.each(PUBLIC_ENTRYPOINTS)(
    'serves $path with a route-specific self-canonical, not the homepage',
    (entry) => {
      const canonical = canonicalFromHtml(renderPublicEntrypoint(indexHtml, entry));
      expect(canonical).toBe(`${ORIGIN}${entry.path}`);
      expect(canonical).not.toBe(`${ORIGIN}/`);
    }
  );
});
