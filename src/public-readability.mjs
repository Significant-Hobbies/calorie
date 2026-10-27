import { AGENT_GUIDANCE } from './public-agent-guidance.mjs';
import {
  createStaticAssetHandler,
  advertiseMarkdown,
} from './agent-surfaces/adapters/static-assets.mjs';

export const identity = {
  name: 'Calorie',
  url: 'https://calorie.significanthobbies.com',
  summary: 'A private, local-first iPhone and iPad food journal with transparent timing estimates.',
  contact: 'https://calorie.significanthobbies.com/support/',
  openapi: 'https://calorie.significanthobbies.com/openapi.json',
  sitemap: 'https://calorie.significanthobbies.com/sitemap.xml',
  notes: [AGENT_GUIDANCE],
  trainingAllowed: true,
  excludedPaths: ['/api', '/v1', '/app', '/auth', '/admin', '/dashboard'],
};
export function privatePath(path) {
  return /^\/(?:app|v1|auth|admin|dashboard)(?:\/|\.md$|$)/.test(path);
}
export const handlePublicReadability = createStaticAssetHandler({
  identity,
  preserveMarkdownPaths: ['/pricing.md', '/agents.md', '/skill.md'],
});
export function robots() {
  const bots = [
    '*',
    'GPTBot',
    'ClaudeBot',
    'Google-Extended',
    'Applebot-Extended',
    'CCBot',
    'Bytespider',
    'OAI-SearchBot',
    'ChatGPT-User',
    'Claude-SearchBot',
    'Claude-User',
    'PerplexityBot',
    'Perplexity-User',
  ];
  return (
    bots
      .map(
        (bot) =>
          `User-agent: ${bot}\nAllow: /\n${identity.excludedPaths.map((path) => `Disallow: ${path}`).join('\n')}\nAllow: /api/ai$\nAllow: /api/md$\nAllow: /api/md/`
      )
      .join('\n\n') + `\n\nSitemap: ${identity.sitemap}\n# Keep in sync with ai.txt and llms.txt.\n`
  );
}

const catalogs = new WeakMap();
export async function advertisePublic(request, response, assets) {
  if (!assets || !response.ok || !response.headers.get('content-type')?.includes('text/html'))
    return response;
  const pathname = new URL(request.url).pathname;
  if (privatePath(pathname) || pathname.startsWith('/api/')) return response;
  let pending = catalogs.get(assets);
  if (!pending) {
    pending = assets
      .fetch(new Request(`${identity.url}/api/md/_catalog`))
      .then(async (response) => {
        if (!response.ok) throw new Error('Catalog unavailable');
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error('Invalid catalog');
        return rows;
      });
    catalogs.set(assets, pending);
  }
  try {
    const rows = await pending;
    const row = rows.find(
      (entry) => entry.path === pathname || entry.path.replace(/\/$/, '') === pathname
    );
    return row ? advertiseMarkdown(response, identity.url, row.assetPath) : response;
  } catch {
    catalogs.delete(assets);
    return response;
  }
}
