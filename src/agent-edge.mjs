const PRODUCT_ORIGIN = 'https://calorie.significanthobbies.com';

export const AGENT_SURFACE = {
  name: 'Calorie',
  url: PRODUCT_ORIGIN,
  indexMd: `# Calorie

Native, local-first food, water, medication, and weight journal for iPhone and iPad.

## Public boundary

- The website is a static product, privacy, support, and beta-status surface.
- Optional Sign in with Apple adds private Cloudflare synchronization.
- No public food, water, weight, profile, or journal data.

## Agent entrypoint

- ${PRODUCT_ORIGIN}/llms.txt
`,
  llmsTxt: `# Calorie

> Native, local-first food, water, medication, and weight journal for iPhone and iPad.

## When to use this

- Best fit: tracking food, water, medication, and weight on iPhone/iPad with local-first privacy
- Best fit: deterministic, transparent calorie and nutrient guidance without a subscription
- Not a fit: social food logging, restaurant scanning, or web-based diet tracking
- Not a fit: medical nutrition therapy or replacing a registered dietitian

## Product

- [Home](${PRODUCT_ORIGIN}/): Native product landing
- [Privacy](${PRODUCT_ORIGIN}/privacy/): Local and cloud data handling
- [Support](${PRODUCT_ORIGIN}/support/): Product support
- [Beta status](${PRODUCT_ORIGIN}/testflight/): Honest distribution status

## Machine surfaces

- [Agent catalog](${PRODUCT_ORIGIN}/api/ai)
- [OpenAPI spec](${PRODUCT_ORIGIN}/openapi.json)
- [Homepage markdown](${PRODUCT_ORIGIN}/index.md)
- [This index](${PRODUCT_ORIGIN}/llms.txt)

## Developer docs

- [OpenAPI specification](${PRODUCT_ORIGIN}/openapi.json): Full API surface description (OpenAPI 3.1)
- [Agent catalog](${PRODUCT_ORIGIN}/api/ai): JSON inventory of public agent surfaces

## CLI

\`\`\`bash
# Fetch the agent catalog
curl -s ${PRODUCT_ORIGIN}/api/ai | jq .

# Get the OpenAPI spec
curl -s ${PRODUCT_ORIGIN}/openapi.json | jq .

# Fetch the homepage as markdown
curl -s -H 'Accept: text/markdown' ${PRODUCT_ORIGIN}/
\`\`\`
`,
  llmsFullTxt: `# Calorie — full agent brief

Calorie is a native, local-first food, water, medication, and weight journal with transparent deterministic guidance.

The public website is informational only. The private journal is available in the iPhone and iPad app, with optional authenticated Cloudflare synchronization. No personal journal records are public.

## Public links

- Home: ${PRODUCT_ORIGIN}/
- Privacy: ${PRODUCT_ORIGIN}/privacy/
- Support: ${PRODUCT_ORIGIN}/support/
- Accessibility: ${PRODUCT_ORIGIN}/accessibility/
- Beta status: ${PRODUCT_ORIGIN}/testflight/

## Machine surfaces

- ${PRODUCT_ORIGIN}/llms.txt
- ${PRODUCT_ORIGIN}/llms-full.txt
- ${PRODUCT_ORIGIN}/api/ai
- ${PRODUCT_ORIGIN}/index.md
- ${PRODUCT_ORIGIN}/sitemap.xml
- ${PRODUCT_ORIGIN}/robots.txt
`,
  catalog: {
    name: 'Calorie',
    version: '1',
    url: PRODUCT_ORIGIN,
    llms: `${PRODUCT_ORIGIN}/llms.txt`,
    llmsFull: `${PRODUCT_ORIGIN}/llms-full.txt`,
    sitemap: `${PRODUCT_ORIGIN}/sitemap.xml`,
    robots: `${PRODUCT_ORIGIN}/robots.txt`,
    markdown: { suffix: '.md', negotiation: true },
    openapi: `${PRODUCT_ORIGIN}/openapi.json`,
    surfaces: [
      surface('home', '/', 'Public native-product landing'),
      surface('privacy', '/privacy/', 'Local and cloud data handling'),
      surface('support', '/support/', 'Product support'),
      surface('terms', '/terms/', 'Product terms'),
      surface('accessibility', '/accessibility/', 'Native accessibility support'),
      surface('testflight', '/testflight/', 'Distribution status'),
    ],
    auth: {
      public: true,
      notes: 'Private journal APIs require authentication and are not agent-indexed.',
    },
  },
};

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Calorie public API',
    version: '1.0.0',
    description:
      'Calorie is a native, local-first food, water, medication, and weight journal for iPhone and iPad. The public web API exposes read-only agent surfaces: the agent catalog, sitemap, llms.txt, and per-page markdown alternates. The journal itself runs in the native app and does not expose a remote API.',
    contact: { name: 'Calorie', url: PRODUCT_ORIGIN },
  },
  servers: [{ url: PRODUCT_ORIGIN }],
  tags: [{ name: 'agent-surfaces', description: 'Machine-readable public surfaces' }],
  paths: {
    '/api/ai': {
      get: {
        operationId: 'getAgentCatalog',
        tags: ['agent-surfaces'],
        summary: 'Agent catalog',
        description: 'JSON inventory of public agent surfaces.',
        responses: {
          200: {
            description: 'Agent catalog',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  description: 'Bounded inventory of public agent surfaces.',
                },
              },
            },
          },
          404: {
            description: 'Not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/llms.txt': {
      get: {
        operationId: 'getLlmsTxt',
        tags: ['agent-surfaces'],
        summary: 'llms.txt index',
        description:
          'Concise, human-and-agent-readable index of the site and its machine surfaces.',
        responses: {
          200: {
            description: 'Markdown index',
            content: { 'text/plain': { schema: { type: 'string' } } },
          },
          404: {
            description: 'Not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/sitemap.xml': {
      get: {
        operationId: 'getSitemap',
        tags: ['agent-surfaces'],
        summary: 'Sitemap',
        description: 'XML sitemap of public, agent-readable routes.',
        responses: {
          200: {
            description: 'XML sitemap',
            content: { 'application/xml': { schema: { type: 'string' } } },
          },
          404: {
            description: 'Not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/openapi.json': {
      get: {
        operationId: 'getOpenApiSpec',
        tags: ['agent-surfaces'],
        summary: 'OpenAPI specification',
        description: 'This document: a machine-readable description of the public agent API.',
        responses: {
          200: {
            description: 'OpenAPI 3.1 spec',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          404: {
            description: 'Not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ApiError: {
        type: 'object',
        description: 'Error response for failed API requests.',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'not_found' },
              message: { type: 'string', example: 'Unknown API path: /api/unknown' },
              path: { type: 'string', example: '/api/unknown' },
            },
            required: ['code', 'message', 'path'],
          },
        },
        required: ['error'],
      },
    },
  },
};

function surface(id, path, description) {
  return {
    id,
    url: `${PRODUCT_ORIGIN}${path}`,
    kind: 'static',
    description,
  };
}

export function handleAgentEdge(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const path = url.pathname || '/';

  if (path === '/openapi.json' || path === '/openapi.yaml') {
    return json(OPENAPI_SPEC);
  }

  if (path === '/llms.txt') return text(AGENT_SURFACE.llmsTxt, 'text/plain; charset=utf-8');
  if (path === '/llms-full.txt') {
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
  if (path === '/api/ai') return json(catalogForOrigin(url.origin));

  if (path === '/' && wantsMarkdown(request)) {
    return text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8', {
      Link: '</index.md>; rel="alternate"; type="text/markdown"',
      Vary: 'Accept',
    });
  }

  // Agent-friendly 404: return a markdown recovery body for unknown paths
  // when the client asks for markdown.
  if (wantsMarkdown(request) && !path.includes('.') && !path.startsWith('/api/')) {
    return markdown404(path, request.method);
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
    surfaces: AGENT_SURFACE.catalog.surfaces.map((entry) => ({
      ...entry,
      url: entry.url.replace(PRODUCT_ORIGIN, origin),
    })),
  };
}

function sitemapForCatalog(catalog) {
  const routes = catalog.surfaces
    .map((entry) => `  <url><loc>${escapeXml(entry.url)}</loc></url>`)
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
  return value
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

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return withSlash.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
}

function markdown404(pathname, method) {
  const path = normalizePath(pathname);
  const body = `# 404 — Not Found

\`${path}\` does not exist on calorie.significanthobbies.com.

## Where to look next

- [Home](${PRODUCT_ORIGIN}/)
- [Sitemap](${PRODUCT_ORIGIN}/sitemap.xml)
- [Agent index](${PRODUCT_ORIGIN}/llms.txt)
- [Agent catalog (JSON)](${PRODUCT_ORIGIN}/api/ai)
- [OpenAPI spec](${PRODUCT_ORIGIN}/openapi.json)
`;
  return new Response(method === 'HEAD' ? null : body, {
    status: 404,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Accept',
    },
  });
}

function text(body, type, extra = {}) {
  return new Response(body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=300',
      ...extra,
    },
  });
}

function json(data) {
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'RateLimit-Limit': '120',
      'RateLimit-Remaining': '119',
      'RateLimit-Reset': '60',
    },
  });
}
