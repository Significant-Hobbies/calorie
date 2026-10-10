import { spawnSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
// The shared gallery emits a fixed-size mark; serve matching responsive assets locally.
const html = readFileSync(path.join(output, 'index.html'), 'utf8').replace(
  /<img\b[^>]*src="\/images\/brand\/mark\.png"[^>]*>/g,
  (tag) => {
    const width = tag.match(/width="(\d+)"/)[1];
    return tag.replace(
      'src="/images/brand/mark.png"',
      `src="/images/brand/mark-76.webp" srcset="/images/brand/mark-38.webp 38w, /images/brand/mark-76.webp 76w, /images/brand/mark-114.webp 114w" sizes="${width}px"`
    );
  }
);
writeFileSync(path.join(marketing, 'index.html'), html);
console.log('Updated marketing home and Astro assets from landing/.');
