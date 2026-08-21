import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const marketing = path.join(root, 'marketing');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

if (existsSync(marketing)) {
  cpSync(marketing, dist, { recursive: true });
} else {
  mkdirSync(dist, { recursive: true });
}

if (!existsSync(path.join(dist, 'index.html'))) {
  throw new Error(
    'Landing snapshot missing: dist/index.html. From ios-landings run scripts/sync-calorie-marketing.sh.'
  );
}
console.log('Assembled the native Calorie product landing.');
