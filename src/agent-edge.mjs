/**
 * Portable agent-edge handler — copy or generate into each product.
 * Spec: foundry/ops/docs/agent-indexing-standard.md
 *
 * Usage in worker.mjs (before openNext.fetch):
 *   import { handleAgentEdge } from './agent-edge.mjs'
 *   const agent = handleAgentEdge(request)
 *   if (agent) return agent
 */

/** @type {{ name: string, url: string, llmsTxt: string, llmsFullTxt?: string, indexMd: string, catalog: object }} */
// biome-ignore format: generated payload from apply-agent-surfaces (JSON keys/quotes)
export const AGENT_SURFACE = {
  "name": "Calorie",
  "url": "https://calorie.significanthobbies.com",
  "llmsFullTxt": "# Calorie — full agent brief\n\nPrivate, local-first food, water, and weight journal with transparent deterministic guidance.\n\n## Index\n\n# Calorie\n\nPrivate, local-first food, water, and weight journal.\n\n## Public boundary\n\n- Product explanation and optional Google or Apple sign-in\n- Deterministic methodology with visible assumptions\n- No public food, water, weight, profile, or journal data\n\n## Agent entrypoint\n\n- https://calorie.significanthobbies.com/llms.txt\n\n## Product links\n\n- Home: https://calorie.significanthobbies.com/ — Local-first journal and optional sign-in\n- Privacy: https://calorie.significanthobbies.com/privacy — Local and cloud data handling\n- Changelog: https://calorie.significanthobbies.com/changelog — Verified product releases\n\n## Machine surfaces\n\n- https://calorie.significanthobbies.com/llms.txt\n- https://calorie.significanthobbies.com/llms-full.txt\n- https://calorie.significanthobbies.com/api/ai\n- https://calorie.significanthobbies.com/index.md\n- https://calorie.significanthobbies.com/sitemap.xml\n- https://calorie.significanthobbies.com/robots.txt\n\n## Contact\n\n- Owner: https://sarthakagrawal.dev\n- Agent email for directory verification: sarthakagrawal@agentmail.to\n",
  "llmsTxt": "# Calorie\n\n> Private, local-first food, water, and weight journal with transparent deterministic guidance.\n\n## Product\n\n- [Home](https://calorie.significanthobbies.com/): Local-first journal and optional sign-in\n- [Privacy](https://calorie.significanthobbies.com/privacy): Local and cloud data handling\n- [Changelog](https://calorie.significanthobbies.com/changelog): Verified product releases\n\n## Machine surfaces\n\n- [Agent catalog](https://calorie.significanthobbies.com/api/ai): JSON inventory of public surfaces\n- [Homepage markdown](https://calorie.significanthobbies.com/index.md): Product brief without JS\n- [This index](https://calorie.significanthobbies.com/llms.txt)\n",
  "indexMd": "# Calorie\n\nPrivate, local-first food, water, and weight journal.\n\n## Public boundary\n\n- Product explanation and optional Google sign-in\n- Deterministic methodology with visible assumptions\n- No public food, water, weight, profile, or journal data\n\n## Agent entrypoint\n\n- https://calorie.significanthobbies.com/llms.txt\n",
  "catalog": {
    "name": "Calorie",
    "version": "1",
    "url": "https://calorie.significanthobbies.com",
    "llms": "https://calorie.significanthobbies.com/llms.txt",
    "llmsFull": "https://calorie.significanthobbies.com/llms-full.txt",
    "sitemap": "https://calorie.significanthobbies.com/sitemap.xml",
    "robots": "https://calorie.significanthobbies.com/robots.txt",
    "markdown": {
      "suffix": ".md",
      "negotiation": true
    },
    "surfaces": [
      {
        "id": "home",
        "url": "https://calorie.significanthobbies.com/",
        "md": "https://calorie.significanthobbies.com/index.md",
        "kind": "static",
        "description": "Public landing"
      },
      {
        "id": "journal",
        "url": "https://calorie.significanthobbies.com/app/",
        "md": "https://calorie.significanthobbies.com/index.md",
        "kind": "web-app",
        "description": "Private food journal"
      },
      {
        "id": "privacy",
        "url": "https://calorie.significanthobbies.com/privacy",
        "md": "https://calorie.significanthobbies.com/privacy.md",
        "kind": "static",
        "description": "Local and cloud data handling"
      },
      {
        "id": "changelog",
        "url": "https://calorie.significanthobbies.com/changelog",
        "md": "https://calorie.significanthobbies.com/changelog.md",
        "kind": "static",
        "description": "Verified product releases"
      }
    ],
    "auth": {
      "public": true,
      "notes": "Auth-walled app routes are not agent-indexed unless listed here."
    }
  }
};

/**
 * @param {Request} request
 * @returns {Response | null}
 */
export function handleAgentEdge(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const path = url.pathname === '' ? '/' : url.pathname;

  if (path === '/llms.txt') {
    return text(AGENT_SURFACE.llmsTxt, 'text/plain; charset=utf-8');
  }
  if (path === '/llms-full.txt' && AGENT_SURFACE.llmsFullTxt) {
    return text(AGENT_SURFACE.llmsFullTxt, 'text/plain; charset=utf-8');
  }
  if (path === '/index.md') {
    return text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8');
  }
  if (path === '/sitemap.xml') {
    return text(sitemapForCatalog(catalogForOrigin(url.origin)), 'application/xml; charset=utf-8');
  }
  if (path === '/robots.txt') {
    return text(robotsForOrigin(url.origin), 'text/plain; charset=utf-8');
  }
  if (path === '/api/ai') {
    return json(catalogForOrigin(url.origin));
  }

  // Homepage markdown negotiation
  if ((path === '/' || path === '') && wantsMarkdown(request)) {
    return text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8', {
      Link: '</index.md>; rel="alternate"; type="text/markdown"',
      Vary: 'Accept',
    });
  }

  return null;
}

function catalogForOrigin(origin) {
  return {
    ...AGENT_SURFACE.catalog,
    url: origin,
    llms: `${origin}/llms.txt`,
    llmsFull: `${origin}/llms-full.txt`,
    sitemap: `${origin}/sitemap.xml`,
    robots: `${origin}/robots.txt`,
    surfaces: (AGENT_SURFACE.catalog.surfaces || []).map((surface) => ({
      ...surface,
      url: forOrigin(surface.url, origin),
      md: forOrigin(surface.md, origin),
    })),
  };
}

function forOrigin(value, origin) {
  return String(value).split(AGENT_SURFACE.url).join(origin);
}

function sitemapForCatalog(catalog) {
  const routes = catalog.surfaces
    .map((surface) => `  <url><loc>${escapeXml(surface.url)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes}\n</urlset>\n`;
}

function robotsForOrigin(origin) {
  return `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
# Agent indexing
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /index.md
Allow: /api/ai
`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wantsMarkdown(request) {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  if (!accept.includes('text/markdown')) return false;
  if (!accept.includes('text/html')) return true;
  return accept.indexOf('text/markdown') < accept.indexOf('text/html');
}

function text(body, type, extra = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=300',
      ...extra,
    },
  });
}

function json(data) {
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
