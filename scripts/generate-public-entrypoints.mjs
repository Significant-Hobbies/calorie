import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const PUBLIC_ENTRYPOINTS = [
  {
    file: 'privacy.html',
    path: '/privacy',
    title: 'Privacy policy · Calorie',
    description:
      'How Calorie handles local journal data, optional private cloud sync, connected accounts, and deletion choices.',
  },
  {
    file: 'changelog.html',
    path: '/changelog',
    title: 'Changelog · Calorie',
    description:
      'Verified product updates to Calorie, the private local-first food, water, medication, and weight journal.',
  },
];

function replaceTag(html, attribute, value) {
  const pattern = new RegExp(`(<meta\\s+${attribute}\\s+content=")[^"]*("\\s*\\/?>)`, 'i');
  if (!pattern.test(html)) throw new Error(`Missing metadata tag: ${attribute}`);
  return html.replace(pattern, `$1${value}$2`);
}

export function renderPublicEntrypoint(indexHtml, entry) {
  const canonical = `https://calorie.significanthobbies.com${entry.path}`;
  let html = replaceTag(indexHtml, 'name="description"', entry.description);
  html = replaceTag(html, 'property="og:url"', canonical);
  html = replaceTag(html, 'property="og:title"', entry.title);
  html = replaceTag(html, 'property="og:description"', entry.description);
  html = replaceTag(html, 'name="twitter:title"', entry.title);
  html = replaceTag(html, 'name="twitter:description"', entry.description);
  html = html.replace(
    /<link rel="canonical" href="[^"]+" \/>/,
    `<link rel="canonical" href="${canonical}" />`
  );
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${entry.title}</title>`);
  return html;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  await Promise.all(
    PUBLIC_ENTRYPOINTS.map((entry) =>
      writeFile(new URL(`../${entry.file}`, import.meta.url), renderPublicEntrypoint(indexHtml, entry))
    )
  );

  console.log(`Generated ${PUBLIC_ENTRYPOINTS.length} canonical public HTML entrypoints.`);
}
