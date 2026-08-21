#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(currentFile), '..');
const productionPaths = ['src', 'ios/Sources', 'vitest.config.ts'];
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.mts', '.swift', '.ts', '.tsx']);
const baselines = {
  complexity: { violations: 4, maxCcn: 14, maxLength: 92, maxParams: 14 },
  duplication: { clones: 3, duplicatedLines: 36 },
  unused: {
    files: 0,
    exports: 0,
    types: 0,
    dependencies: 0,
    devDependencies: 0,
    unlisted: 0,
    unresolved: 0,
  },
  suppressions: 0,
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`${command} exited with status ${result.status}`);
  }
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function parseJson(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    process.stderr.write(result.stderr);
    throw new Error(`${label} did not return valid JSON`, { cause: error });
  }
}

function commandWithUvx(command, uvxArgs) {
  const probe = spawnSync(command, ['--version'], { encoding: 'utf8' });
  return probe.status === 0 ? { command, prefix: [] } : { command: 'uvx', prefix: uvxArgs };
}

function issueCount(issues, key) {
  return issues.reduce((sum, issue) => sum + (issue[key]?.length ?? 0), 0);
}

function failRegressions(label, observed, baseline) {
  const regressions = Object.entries(baseline).filter(([key, maximum]) => observed[key] > maximum);
  if (regressions.length > 0) {
    throw new Error(
      regressions
        .map(([key, maximum]) => `${label} ${key} regressed: ${observed[key]} > ${maximum}`)
        .join('\n')
    );
  }
  if (Object.entries(baseline).some(([key, maximum]) => observed[key] < maximum)) {
    console.log(`${label} improved; lower the checked-in baseline intentionally.`);
  }
}

function checkUnused() {
  const report = parseJson(
    run('pnpm', ['exec', 'knip', '--reporter', 'json', '--no-exit-code', '--no-progress'], {
      allowFailure: true,
    }),
    'Knip'
  );
  const issues = report.issues ?? [];
  const observed = Object.fromEntries(
    Object.keys(baselines.unused).map((key) => [key, issueCount(issues, key)])
  );
  console.log(
    `Unused: files=${observed.files}, exports=${observed.exports}, types=${observed.types}, ` +
      `dependencies=${observed.dependencies}, devDependencies=${observed.devDependencies}, ` +
      `unlisted=${observed.unlisted}, unresolved=${observed.unresolved}.`
  );
  failRegressions('Unused', observed, baselines.unused);
}

function checkComplexity() {
  const lizard = commandWithUvx('lizard', ['--from', 'lizard==1.23.0', 'lizard']);
  const result = run(lizard.command, [
    ...lizard.prefix,
    ...productionPaths,
    '-x',
    '**/*.test.*',
    '-x',
    'src/agent-edge.mjs',
    '--csv',
  ]);
  const rows = result.stdout
    .trim()
    .split('\n')
    .map((line) => line.match(/^(\d+),(\d+),(\d+),(\d+),(\d+),/u))
    .filter(Boolean)
    .map((match) => match.slice(1).map(Number));
  const observed = {
    functions: rows.length,
    nloc: rows.reduce((sum, row) => sum + row[0], 0),
    violations: rows.filter((row) => row[1] > 15 || row[4] > 100 || row[3] > 7).length,
    maxCcn: Math.max(...rows.map((row) => row[1])),
    maxLength: Math.max(...rows.map((row) => row[4])),
    maxParams: Math.max(...rows.map((row) => row[3])),
  };
  console.log(
    `Complexity: ${observed.functions} functions, ${observed.nloc} NLOC, ` +
      `${observed.violations} violations; max CCN ${observed.maxCcn}, ` +
      `max length ${observed.maxLength}, max params ${observed.maxParams}.`
  );
  failRegressions('Complexity', observed, baselines.complexity);
}

function checkDuplication() {
  const outputDirectory = mkdtempSync(join(tmpdir(), 'calorie-jscpd-'));
  run('pnpm', [
    'exec',
    'jscpd',
    ...productionPaths,
    '--min-lines',
    '8',
    '--min-tokens',
    '60',
    '--mode',
    'strict',
    '--ignore',
    '**/*.test.*,src/agent-edge.mjs,**/*.d.ts,**/*.d.mts,**/node_modules/**,**/dist/**,**/coverage/**',
    '--reporters',
    'json',
    '--output',
    outputDirectory,
    '--silent',
    '--no-tips',
  ]);
  const observed = JSON.parse(readFileSync(join(outputDirectory, 'jscpd-report.json'), 'utf8'))
    .statistics.total;
  console.log(
    `Duplication: ${observed.clones} groups, ${observed.duplicatedLines}/${observed.lines} lines ` +
      `(${observed.percentage.toFixed(4)}%) across ${observed.sources} server/native files.`
  );
  failRegressions('Duplication', observed, baselines.duplication);
}

function checkCycles() {
  const report = parseJson(
    run(
      'pnpm',
      ['exec', 'knip', '--cycles', '--reporter', 'json', '--no-exit-code', '--no-progress'],
      { allowFailure: true }
    ),
    'Knip cycle analysis'
  );
  const cycles = (report.issues ?? []).flatMap((issue) => issue.cycles ?? []);
  if (cycles.length > 0) throw new Error(`TypeScript dependency cycles detected: ${cycles.length}`);
  console.log('Cycles: zero TypeScript import cycles; native CI resolves the Swift target graph.');
}

function checkDependencies() {
  const report = parseJson(run('pnpm', ['audit', '--json'], { allowFailure: true }), 'pnpm audit');
  const severe = Object.values(report.advisories ?? {}).filter((advisory) =>
    ['critical', 'high'].includes(advisory.severity)
  );
  const critical = severe.filter((advisory) => advisory.severity === 'critical').length;
  const high = severe.filter((advisory) => advisory.severity === 'high').length;
  console.log(`Dependencies: ${critical} critical, ${high} high advisories.`);
  if (severe.length > 0) {
    throw new Error(
      `Critical/high advisories detected: ${severe
        .map((advisory) => advisory.github_advisory_id)
        .join(', ')}`
    );
  }
}

const suppressionPattern =
  /swiftlint:disable|swiftformat:disable|biome-ignore|eslint-disable|@ts-ignore|@ts-expect-error|istanbul ignore|c8 ignore|(?:test|base)\.skip\(|\bTODO\b|\bFIXME\b/u;

function sourceFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (entry.isFile() && sourceExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function checkSuppressions() {
  const files = ['src', 'ios/Sources', 'ios/Tests'].flatMap((root) =>
    sourceFiles(resolve(projectRoot, root))
  );
  const matches = files
    .filter((file) => file !== currentFile && !file.endsWith('/src/agent-edge.mjs'))
    .flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => suppressionPattern.test(line))
    );
  console.log(`Suppressions: ${matches.length} justified server/native source or test markers.`);
  if (matches.length > baselines.suppressions) {
    throw new Error(`Suppressions regressed: ${matches.length} > ${baselines.suppressions}.`);
  }
  if (matches.length < baselines.suppressions) {
    console.log('Suppressions improved; lower the checked-in baseline intentionally.');
  }
}

function checkHygiene() {
  const parent = run('git', ['rev-parse', '--verify', 'HEAD^'], { allowFailure: true });
  if (parent.status === 0) run('git', ['diff', '--check', 'HEAD^', 'HEAD']);
  else run('git', ['diff-tree', '--check', '--root', '-r', 'HEAD']);
  run('git', ['diff', '--check', 'HEAD', '--', '.']);
  const conflicts = run('git', ['grep', '-nE', '^(<<<<<<< |=======$|>>>>>>> )', '--', '.'], {
    allowFailure: true,
  });
  if (conflicts.status === 0) throw new Error(`Conflict markers found:\n${conflicts.stdout}`);
  if (conflicts.status > 1) throw new Error(`git grep failed with status ${conflicts.status}`);
  const generated = run('git', ['ls-files', '--others', '--exclude-standard'])
    .stdout.trim()
    .split('\n')
    .filter(Boolean)
    .filter((file) =>
      /(^|\/)(?:coverage|dist|build|\.next|\.open-next|\.wrangler)(?:\/|$)|(?:^|\/)\.DS_Store$|\.tsbuildinfo$/u.test(
        file
      )
    );
  if (generated.length > 0) {
    throw new Error(`Untracked generated artifacts found: ${generated.join(', ')}`);
  }
  console.log('Repository hygiene: whitespace, conflicts, and generated outputs pass.');
}

const checks = {
  unused: checkUnused,
  complexity: checkComplexity,
  duplication: checkDuplication,
  cycles: checkCycles,
  dependencies: checkDependencies,
  suppressions: checkSuppressions,
  hygiene: checkHygiene,
};
const selected = process.argv[2];

if (!Object.hasOwn(checks, selected)) {
  console.error(`Usage: check-code-health.mjs <${Object.keys(checks).join('|')}>`);
  process.exit(2);
}

try {
  checks[selected]();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
