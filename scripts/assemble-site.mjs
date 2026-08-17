import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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

const publicDir = path.join(root, 'public');
if (existsSync(publicDir)) {
  cpSync(publicDir, dist, { recursive: true });
}

const changelog = path.join(root, 'changelog.html');
if (existsSync(changelog)) {
  cpSync(changelog, path.join(dist, 'changelog.html'));
}

const vite = spawnSync('pnpm', ['exec', 'vite', 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
if (vite.status !== 0) {
  process.exit(vite.status ?? 1);
}

if (!existsSync(path.join(dist, 'index.html'))) {
  throw new Error(
    'Landing snapshot missing: dist/index.html. From ios-landings run scripts/sync-calorie-marketing.sh.'
  );
}
if (!existsSync(path.join(dist, 'app/index.html'))) {
  throw new Error('Journal build missing: dist/app/index.html');
}

console.log('Assembled landing at / and journal at /app/');
