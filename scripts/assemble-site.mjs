import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const marketing = path.join(root, 'marketing');

if (
  !existsSync(path.join(marketing, 'index.html')) ||
  !readFileSync(path.join(marketing, 'index.html'), 'utf8').includes('data-fleet-footer="studio"')
) {
  throw new Error('Gallery home missing from marketing/index.html. Run pnpm landing:build.');
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

if (existsSync(marketing)) {
  cpSync(marketing, dist, { recursive: true });
} else {
  mkdirSync(dist, { recursive: true });
}

if (!existsSync(path.join(dist, 'index.html'))) {
  throw new Error('Landing snapshot missing: dist/index.html. Run pnpm landing:build.');
}
console.log('Assembled the native Calorie product landing.');
