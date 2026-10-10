import { spawnSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const result = spawnSync('pnpm', ['--dir', 'landing', 'build'], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Landing build failed with status ${result.status}.`);

const output = path.join(root, 'landing', 'dist');
const marketing = path.join(root, 'marketing');
if (!readFileSync(path.join(output, 'index.html'), 'utf8').includes('data-fleet-footer="studio"')) {
  throw new Error('Landing build is missing the StudioFooter. Marketing snapshot was not changed.');
}

rmSync(path.join(marketing, '_astro'), { recursive: true, force: true });
cpSync(path.join(output, '_astro'), path.join(marketing, '_astro'), { recursive: true });
cpSync(path.join(output, 'index.html'), path.join(marketing, 'index.html'));
console.log('Updated marketing home and Astro assets from landing/.');
