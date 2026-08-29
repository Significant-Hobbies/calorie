const PRODUCT_ORIGIN = 'https://calorie.significanthobbies.com';

export const AGENT_SURFACE = {
  name: 'Calorie',
  url: PRODUCT_ORIGIN,
  indexMd: `# Calorie

A private, local-first iPhone and iPad journal that makes food logging fast and turns timestamps and personal targets into transparent fasting, exercise, and sleep estimates.

Calorie is for someone pursuing weight loss who wants practical daily context without an opaque coach. It records calories, carbs, protein, fibre, water, routine check-offs, weight, and goals. Every timing estimate remains informational rather than medical advice.

## Public boundary

- The website is a static product, privacy, support, and beta-status surface.
- Optional Sign in with Apple adds private Cloudflare synchronization.
- No public food, water, weight, profile, or journal data.
- Access is currently limited to invited internal TestFlight testers.
- There is no public invite, App Store listing, paid plan, subscription, or checkout.

## Agent entrypoint

- ${PRODUCT_ORIGIN}/llms.txt
`,
  llmsTxt: `# Calorie

> A private, local-first iPhone and iPad food and body journal with fast logging and transparent timing estimates.

## When to use this

- Best fit: understanding Calorie as a private native journal for someone pursuing weight loss
- Best fit: checking how food timestamps and personal targets produce transparent fasting, exercise, and sleep estimates
- Best fit: confirming local-first privacy, optional Apple sync, internal-beta access, and current commercial state
- Not a fit: medical, nutrition, or weight-loss prescriptions
- Not a fit: barcode scanning, social feeds, wearable sync, or web-based diet tracking
- Not a fit: public App Store or TestFlight installation links

## Product

- [Home](${PRODUCT_ORIGIN}/): Native product landing
- [Privacy](${PRODUCT_ORIGIN}/privacy/): Local and cloud data handling
- [Support](${PRODUCT_ORIGIN}/support/): Product support
- [Beta status](${PRODUCT_ORIGIN}/testflight/): Honest distribution status

## Machine surfaces

- [Agent catalog](${PRODUCT_ORIGIN}/api/ai)
- [AI catalog](${PRODUCT_ORIGIN}/.well-known/ai-catalog.json)
- [Agent Skill index](${PRODUCT_ORIGIN}/.well-known/agent-skills/index.json)
- [OpenAPI spec](${PRODUCT_ORIGIN}/openapi.json)
- [Homepage markdown](${PRODUCT_ORIGIN}/index.md)
- [Access and pricing](${PRODUCT_ORIGIN}/pricing.md)
- [Agent instructions](${PRODUCT_ORIGIN}/agents.md)
- [Calorie product-guide skill](${PRODUCT_ORIGIN}/skill.md)
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

Calorie is a private, native food and body journal for someone pursuing weight loss. It keeps meal logging fast, tracks four core nutrients plus water, routines, weight, and goals, and derives fasting, exercise, and sleep estimates from visible inputs and rules.

The public website is informational only. The private journal is available to invited internal TestFlight testers on iPhone and iPad, with optional Apple-authenticated Cloudflare synchronization. No personal journal records are public. There is no public invitation, App Store listing, paid plan, subscription, or checkout, and no permanent free-or-paid promise has been announced.

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

const PUBLIC_MARKDOWN = {
  '/': AGENT_SURFACE.indexMd,
  '/privacy': `# Calorie privacy

Calorie is local-first. Foods, entries, four nutrients, water, routine check-offs, weight, goals, and profile fields stay on the iPhone or iPad unless the user chooses Sign in with Apple and private Cloudflare D1 sync.

## Optional sync

- Sync is user-scoped and is not required to open or use the local journal.
- The service stores the account and reliability records needed for authentication and synchronization.
- One person's foods or entries must never be exposed to another person.

## Controls and boundaries

- The native app provides local export and deletion controls.
- Exported files become the user's responsibility outside the app.
- Calorie is not medical care; timing and target estimates can be incomplete or wrong.
- The static marketing page does not receive a local-only journal and does not run product analytics.

Last updated: 2026-08-28
`,
  '/support': `# Calorie support

Calorie is currently available only to invited internal TestFlight testers.

## Report a software problem

State the screen, action, device class, and whether the journal was local-only or signed in. For sync issues, confirm that the local journal still opens and say whether the problem affects one entry or the whole account. Do not delete local data as a troubleshooting step unless a verified export exists.

Do not include private food, weight, routine, account, or another person's details in a report. Support covers the software and data controls, not medical interpretation, diet prescriptions, medication guidance, or emergencies.

There is no paid support plan or guaranteed response time. Public product work is tracked at https://github.com/Significant-Hobbies/calorie/issues.
`,
  '/terms': `# Calorie terms

Calorie is personal tracking software. It records information the user chooses to enter and presents calculations, trends, and timing estimates.

## Boundaries

- Calorie does not diagnose, treat, prescribe, or replace a qualified professional.
- Do not use it for emergencies, medication dosage, eating-disorder treatment, or clinical nutrition decisions.
- The internal TestFlight beta may change, stop working, or lose access.
- There is no public distribution promise, paid plan, service-level commitment, or warranty that estimates are complete or accurate.
- Users must not access another person's account or store information they do not have permission to keep.

Last updated: 2026-08-28
`,
  '/accessibility': `# Calorie accessibility

The native iPhone and iPad app supports Dynamic Type, VoiceOver labels and reading order, comfortable touch targets, keyboard-contained sheets, and status cues that do not rely on colour alone.

Calorie respects Reduce Motion and offers Light, Dark, and System appearance choices. Progress charts include textual context and visible sample counts. The internal beta may still contain defects; reports should name the screen, text size, assistive technology, and failed action without attaching private journal details.
`,
  '/testflight': `# Calorie TestFlight status

Calorie has a working internal TestFlight build for invited testers. There is no public TestFlight invitation and no App Store listing.

Invited testers can complete onboarding, log a familiar food, verify Today totals and transparent timing, review Progress, and optionally test private Apple-sign-in sync without replacing the local journal.

## Not included

- Public enrollment or App Store installation
- A paid plan or checkout
- Barcode scanning, social feeds, wearable sync, or workout programming
- Medical or clinical nutrition guidance

Beta software can change. Export local data before deleting the app, clearing data, or testing account reconciliation.
`,
};

const MARKDOWN_PATHS = new Map([
  ['/index.md', '/'],
  ['/privacy/index.md', '/privacy'],
  ['/privacy.md', '/privacy'],
  ['/support/index.md', '/support'],
  ['/support.md', '/support'],
  ['/terms/index.md', '/terms'],
  ['/terms.md', '/terms'],
  ['/accessibility/index.md', '/accessibility'],
  ['/accessibility.md', '/accessibility'],
  ['/testflight/index.md', '/testflight'],
  ['/testflight.md', '/testflight'],
]);

const PRICING_MD = `---
title: Calorie access and pricing
description: Current distribution and commercial state for the Calorie native beta.
updated: 2026-08-28
---

# Access and pricing

Calorie has no paid plan, subscription, or checkout. Access is currently limited to invited internal TestFlight testers, and there is no public invitation or App Store listing.

This describes the current beta state. It is not a permanent promise that a future public release will be free or paid.

The local journal needs no account. Optional Sign in with Apple adds a private, user-scoped Cloudflare sync copy without making the network part of the launch path.
`;

const AGENTS_MD = `---
title: Calorie agent instructions
description: Public guidance for explaining Calorie without crossing privacy, medical, or distribution boundaries.
updated: 2026-08-28
---

# Agent instructions

Use Calorie's public pages to explain the native food-and-body journal, its transparent timing mechanism, its current internal-beta state, and its privacy boundaries.

## Good uses

- Explain how meal timestamps and personal targets produce fasting, exercise, and sleep estimates.
- Distinguish device-local use from optional Apple-authenticated private sync.
- Summarize the four tracked nutrients: calories, carbs, protein, and fibre.
- Point invited testers to the beta-status and support pages.

## Boundaries

- Do not claim access to a person's journal, foods, weight, routines, account, or sync state.
- Do not turn estimates into medical, nutrition, medication, or weight-loss prescriptions.
- Do not invent a public TestFlight invitation, App Store listing, barcode scanner, wearable sync, social feed, paid plan, subscription, or checkout.
- Do not call Calorie permanently free; its long-term commercial model is undeclared.
`;

export const PRODUCT_GUIDE_SKILL = `---
name: calorie-product-guide
description: Explain Calorie's private food-journal workflow, transparent timing estimates, access state, and safety boundaries without exposing user data or giving medical advice.
version: 1.0.0
homepage: https://calorie.significanthobbies.com/
---

# Calorie product guide

Use this skill when someone wants to understand whether Calorie fits their food-logging workflow or needs a concise explanation of its calculations, privacy, or current availability.

## Workflow

1. Establish that Calorie is a native iPhone and iPad journal for someone pursuing weight loss.
2. Describe the fast logging loop: saved or one-off food, amount, real eating time, and four nutrients.
3. Explain that timestamps and personal targets drive visible fasting, exercise, and sleep estimates.
4. Separate the device-local default from optional Apple-authenticated private Cloudflare sync.
5. State the current distribution boundary: invited internal TestFlight testers only.
6. End with the relevant public page: product, privacy, support, accessibility, terms, or beta status.

## Output format

\`\`\`markdown
## Calorie fit
- Need: <food-logging or product-understanding need>
- Workflow: <fast log and tracked inputs>
- Guidance: <visible timing rule or estimate>
- Data boundary: <local-only or optional private sync>
- Availability: <internal beta; no public install link>
- Safety: <informational estimate, not medical advice>
- Next public page: <canonical URL>
\`\`\`

## Product boundaries

Do not expose or imply access to private journal data. Do not prescribe a diet, deficit, medication action, or clinical outcome. Do not invent public distribution, payment, barcode, social, wearable, or workout-programming capabilities.
`;

const PRODUCT_GUIDE_DIGEST =
  'sha256:4a380ff01f3b2d3cb20efca4c40c981e9d00fbf71c7fe0e0b7ce4392bad926fd';

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
  const markdownPath = path === '/' ? '/index.md' : `${path}index.md`;
  return {
    id,
    url: `${PRODUCT_ORIGIN}${path}`,
    md: `${PRODUCT_ORIGIN}${markdownPath}`,
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

  if (path === '/pricing.md') return text(PRICING_MD, 'text/markdown; charset=utf-8');
  if (path === '/agents.md') return text(AGENTS_MD, 'text/markdown; charset=utf-8');
  if (path === '/skill.md') {
    return text(PRODUCT_GUIDE_SKILL, 'text/markdown; charset=utf-8');
  }
  if (path === '/.well-known/agent-skills/calorie-product-guide/SKILL.md') {
    return text(PRODUCT_GUIDE_SKILL, 'text/markdown; charset=utf-8');
  }
  if (path === '/.well-known/agent-skills/index.json') {
    return json(agentSkillIndexForOrigin(url.origin));
  }
  if (path === '/.well-known/ai-catalog.json') {
    return json(aiCatalogForOrigin(url.origin));
  }

  if (path === '/llms.txt') return text(AGENT_SURFACE.llmsTxt, 'text/plain; charset=utf-8');
  if (path === '/llms-full.txt') {
    return text(AGENT_SURFACE.llmsFullTxt, 'text/plain; charset=utf-8');
  }
  const directMarkdownRoute = MARKDOWN_PATHS.get(path);
  if (directMarkdownRoute) {
    return text(PUBLIC_MARKDOWN[directMarkdownRoute], 'text/markdown; charset=utf-8');
  }
  if (path === '/sitemap.xml') {
    return text(sitemapForCatalog(catalogForOrigin(url.origin)), 'application/xml; charset=utf-8');
  }
  if (path === '/robots.txt') {
    return text(robotsForOrigin(url.origin), 'text/plain; charset=utf-8');
  }
  if (path === '/api/ai') return json(catalogForOrigin(url.origin));

  const normalizedPublicPath = normalizePath(path);
  const negotiatedMarkdown = PUBLIC_MARKDOWN[normalizedPublicPath];
  if (negotiatedMarkdown && wantsMarkdown(request)) {
    const markdownPath =
      normalizedPublicPath === '/' ? '/index.md' : `${normalizedPublicPath}/index.md`;
    return text(negotiatedMarkdown, 'text/markdown; charset=utf-8', {
      Link: `<${markdownPath}>; rel="alternate"; type="text/markdown"`,
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
    aiCatalog: `${origin}/.well-known/ai-catalog.json`,
    agentSkills: `${origin}/.well-known/agent-skills/index.json`,
    pricing: `${origin}/pricing.md`,
    instructions: `${origin}/agents.md`,
    surfaces: AGENT_SURFACE.catalog.surfaces.map((entry) => ({
      ...entry,
      url: entry.url.replace(PRODUCT_ORIGIN, origin),
      md: entry.md.replace(PRODUCT_ORIGIN, origin),
    })),
  };
}

function agentSkillIndexForOrigin(origin) {
  return {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [
      {
        name: 'calorie-product-guide',
        type: 'skill-md',
        description:
          "Explain Calorie's private food-journal workflow, transparent timing estimates, access state, and safety boundaries without exposing user data or giving medical advice.",
        url: `${origin}/.well-known/agent-skills/calorie-product-guide/SKILL.md`,
        digest: PRODUCT_GUIDE_DIGEST,
      },
    ],
  };
}

function aiCatalogForOrigin(origin) {
  const host = new URL(origin).host;
  return {
    specVersion: '1.0',
    host: {
      displayName: 'Calorie',
      identifier: `did:web:${host}`,
      documentationUrl: `${origin}/llms-full.txt`,
    },
    entries: [
      {
        identifier: `urn:air:${host}:skill:calorie-product-guide`,
        displayName: 'Calorie product guide',
        type: 'text/markdown',
        url: `${origin}/.well-known/agent-skills/calorie-product-guide/SKILL.md`,
        description:
          'Bounded guidance for explaining the product, transparent timing mechanism, privacy, access state, and safety limits.',
      },
      {
        identifier: `urn:air:${host}:api:public-agent-surfaces`,
        displayName: 'Calorie public discovery surfaces',
        type: 'application/vnd.oai.openapi+json',
        url: `${origin}/openapi.json`,
        description:
          'Read-only discovery API for public product and legal surfaces; it does not expose private journal data.',
      },
    ],
  };
}

function sitemapForCatalog(catalog) {
  const routes = catalog.surfaces
    .map((entry) => `  <url><loc>${escapeXml(entry.url)}</loc><lastmod>2026-08-28</lastmod></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes}\n</urlset>\n`;
}

function robotsForOrigin(origin) {
  return `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

Sitemap: ${origin}/sitemap.xml
# Agent indexing
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /index.md
Allow: /api/ai
Allow: /.well-known/ai-catalog.json
Allow: /.well-known/agent-skills/
Allow: /agents.md
Allow: /pricing.md
Allow: /skill.md
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
