import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { templateMarkdown } from './template-markdown.mjs';
import { identity, robots } from '../src/public-readability.mjs';
import { absoluteMarkdownLinks } from '../src/agent-surfaces/format.mjs';
import { createAgentSurfaceManifest } from '../src/agent-surfaces/manifest.mjs';
import { createAgentSurfaceHandler } from '../src/agent-surfaces/handler.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const content = JSON.parse(
  await readFile(path.join(root, 'landing/src/content/calorie.json'), 'utf8')
);
const source = path.join(root, 'marketing');
const sourceSitemap = await readFile(path.join(source, 'sitemap.xml'), 'utf8');
const lastModifiedByUrl = new Map(
  [...sourceSitemap.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/g)]
    .map(([, entry]) => [
      entry.match(/<loc>([^<]+)<\/loc>/)?.[1],
      entry.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1],
    ])
    .filter(([url, date]) => url && date)
);
const routes = [];
const bodies = new Map();
const escape = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(file);
    else if (entry.name === 'index.html') {
      const relative = path.relative(source, directory).split(path.sep).join('/');
      const route = relative ? `/${relative}/` : '/';
      let html = await readFile(file, 'utf8');
      if (
        /<meta[^>]+(?:name=["']robots["'][^>]+content=["'][^"']*noindex|content=["'][^"']*noindex[^>]+name=["']robots)/i.test(
          html
        )
      )
        continue;
      let markdown = await readFile(path.join(directory, 'index.md'), 'utf8');
      const front = markdown.match(/^---\n([\s\S]*?)\n---/);
      const field = (name) =>
        front?.[1].match(new RegExp(`^${name}:\\s*(.*)$`, 'm'))?.[1].replace(/^"|"$/g, '');
      const title =
        route === '/' ? content.page.title : field('title') || markdown.match(/^# (.+)$/m)?.[1];
      const description =
        route === '/'
          ? content.page.description
          : field('description') ||
            markdown
              .split(/\n\s*\n/)
              .find(
                (paragraph) =>
                  !paragraph.startsWith('#') &&
                  !paragraph.startsWith('---') &&
                  !paragraph.includes('·') &&
                  !paragraph.startsWith('- ')
              ) ||
            title;
      if (!title || !description) throw new Error(`Missing source title/description for ${route}`);
      if (route === '/')
        markdown = `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\ncanonical: ${identity.url}/\n---\n\n# ${title}\n\n${templateMarkdown(content)}`;
      const canonical = identity.url + route;
      markdown = absoluteMarkdownLinks(markdown, canonical);
      if (!markdown.includes(canonical)) markdown += `\nCanonical HTML: ${canonical}\n`;
      const assetPath = route === '/' ? '/index.md' : `${route}index.md`;
      routes.push({
        path: route,
        title,
        description,
        url: canonical,
        md: identity.url + (route === '/' ? '/index.md' : `${route.slice(0, -1)}.md`),
        assetPath,
        aliases: [assetPath],
        ...(lastModifiedByUrl.has(canonical)
          ? { lastModified: lastModifiedByUrl.get(canonical) }
          : {}),
      });
      bodies.set(route, markdown);
      await writeFile(path.join(output, assetPath), markdown);
      html = html.replace(/<meta\b[^>]*name=["']ai-summary["'][^>]*>/gi, '');
      if (!/<link[^>]+type=["']text\/markdown["']/i.test(html))
        html = html.replace(
          '</head>',
          `<link rel="alternate" type="text/markdown" href="${identity.url}${assetPath}"></head>`
        );
      html = html.replace(
        '</head>',
        `<meta name="ai-summary" content="${escape(description)}"></head>`
      );
      await writeFile(path.join(output, relative, 'index.html'), html);
    }
  }
}
await visit(source);
routes.sort((a, b) => a.path.localeCompare(b.path));
const manifest = createAgentSurfaceManifest({ ...identity, pages: {} });
const handle = createAgentSurfaceHandler({
  manifest,
  listMarkdownRoutes: () => routes,
  loadMarkdown: (route) => bodies.get(route),
});
await mkdir(path.join(output, 'api/md'), { recursive: true });
await writeFile(path.join(output, 'api/md/_catalog'), JSON.stringify(routes));
await writeFile(path.join(output, 'api/md/_identity'), JSON.stringify(identity));
for (const file of ['llms.txt', 'llms-full.txt', 'ai.txt']) {
  const response = await handle(new Request(`${identity.url}/${file}`));
  if (response.status !== 200) throw new Error(`${file}: ${response.status}`);
  await writeFile(path.join(output, file), await response.text());
}
await writeFile(path.join(output, 'robots.txt'), robots());
await writeFile(
  path.join(output, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((route) => `<url><loc>${route.url}</loc>${route.lastModified ? `<lastmod>${route.lastModified}</lastmod>` : ''}</url>`).join('')}</urlset>\n`
);
console.log(
  `Generated ${routes.length} source-backed public Markdown routes and discovery documents.`
);
