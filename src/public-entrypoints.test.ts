import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  PUBLIC_ENTRYPOINTS,
  renderPublicEntrypoint,
} from '../scripts/generate-public-entrypoints.mjs';

const indexHtml = readFileSync('index.html', 'utf8');

describe('public HTML entrypoints', () => {
  it.each(PUBLIC_ENTRYPOINTS)('gives $path route-specific indexable metadata', (entry) => {
    const html = renderPublicEntrypoint(indexHtml, entry);
    const canonical = `https://calorie.significanthobbies.com${entry.path}`;

    expect(html).toContain(`<link rel="canonical" href="${canonical}" />`);
    expect(html).toContain(`<meta property="og:url" content="${canonical}" />`);
    expect(html).toContain(`<title>${entry.title}</title>`);
    expect(html).toContain(entry.description);
  });
});
