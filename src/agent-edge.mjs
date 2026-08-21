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

## Product

- [Home](${PRODUCT_ORIGIN}/): Native product landing
- [Privacy](${PRODUCT_ORIGIN}/privacy/): Local and cloud data handling
- [Support](${PRODUCT_ORIGIN}/support/): Product support
- [Beta status](${PRODUCT_ORIGIN}/testflight/): Honest distribution status

## Machine surfaces

- [Agent catalog](${PRODUCT_ORIGIN}/api/ai)
- [Homepage markdown](${PRODUCT_ORIGIN}/index.md)
- [This index](${PRODUCT_ORIGIN}/llms.txt)
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
    },
  });
}
