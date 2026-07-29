#!/usr/bin/env node
/**
 * One command for every check in the repo: `npm run check`.
 *
 * There are three packages and each needs both a linter and a typechecker, so
 * verifying a change by hand meant six commands and remembering all six. Worse,
 * `npm run <script> --workspaces` stops at the first failure, so a broken lint
 * in the shared package hid whatever the two apps had to say. This runs
 * everything, in parallel, and reports all of it at once. That is the whole
 * point: one run should tell you everything that is wrong, not the first thing.
 *
 *   npm run check           lint, typecheck and the production web build
 *   npm run check -- --quick   skips the build, for the inner loop
 *   npm run check -- --fix     applies the autofixable lint fixes first
 *
 * Exit code is 0 only when every check passed. Warnings count as failures: the
 * lint scripts all run with --max-warnings 0, because a warning nobody has to
 * act on is a warning nobody reads.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const QUICK = args.includes('--quick');
const FIX = args.includes('--fix');

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

/**
 * Every check, as a workspace plus the npm script to run in it. Kept as script
 * names rather than raw commands so package.json stays the single definition of
 * what "lint" means for each package.
 */
const CHECKS = [
  { pkg: 'core', workspace: 'packages/core', script: 'lint' },
  { pkg: 'core', workspace: 'packages/core', script: 'typecheck' },
  { pkg: 'mobile', workspace: 'apps/mobile', script: 'lint' },
  // expo install --check: fails when a declared package drifts from the version
  // Expo Go ships natively. The worklets segfault was exactly this class of bug,
  // invisible until a phone produced a tombstone; now it fails the build instead.
  { pkg: 'mobile', workspace: 'apps/mobile', script: 'deps' },
  { pkg: 'mobile', workspace: 'apps/mobile', script: 'typecheck' },
  { pkg: 'web', workspace: 'apps/web', script: 'lint' },
  { pkg: 'web', workspace: 'apps/web', script: 'typecheck' },
  // Last because it is by far the slowest, and because it only makes sense to
  // read once the cheaper checks have had their say. It catches what neither of
  // them can: a route that fails to prerender, a server import pulled into a
  // client bundle, a page that throws while being statically generated.
  { pkg: 'web', workspace: 'apps/web', script: 'build', slow: true },
];

function run(cmd, cmdArgs, cwd = ROOT) {
  return new Promise((done) => {
    const started = Date.now();
    const child = spawn(cmd, cmdArgs, { cwd, shell: false });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => done({ code: code ?? 1, out, ms: Date.now() - started }));
    child.on('error', (err) => done({ code: 1, out: String(err), ms: Date.now() - started }));
  });
}

const label = (c) => `${c.pkg} · ${c.script}`;
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

/** npm prints its own banner for every script; --silent drops it. */
const npmRun = (c) => run('npm', ['run', '--silent', c.script, '--workspace', c.workspace]);

async function main() {
  const checks = QUICK ? CHECKS.filter((c) => !c.slow) : CHECKS;

  console.log(`\n${C.bold('MatricMate · check')}`);
  if (QUICK) console.log(C.dim('  quick mode, skipping the web build'));

  if (FIX) {
    console.log(C.dim('\n  applying autofixable lint fixes…'));
    await Promise.all(
      [...new Set(checks.filter((c) => c.script === 'lint').map((c) => c.workspace))].map((ws) =>
        run('npx', ['eslint', '.', '--fix'], resolve(ROOT, ws))
      )
    );
  }

  console.log(C.dim(`\n  running ${checks.length} checks in parallel…\n`));

  const pending = new Set(checks.map(label));
  const results = await Promise.all(
    checks.map(async (c) => {
      const r = await npmRun(c);
      pending.delete(label(c));
      const mark = r.code === 0 ? C.green('  ok  ') : C.red(' fail ');
      const left = pending.size ? C.dim(`   (${pending.size} still running)`) : '';
      console.log(`  ${mark} ${label(c).padEnd(18)} ${C.dim(secs(r.ms))}${left}`);
      return { ...c, ...r };
    })
  );

  const failed = results.filter((r) => r.code !== 0);

  for (const f of failed) {
    console.log(`\n${C.red('─'.repeat(64))}`);
    console.log(C.red(C.bold(`${label(f)} failed`)));
    console.log(C.red('─'.repeat(64)));
    console.log(f.out.trim() || C.dim('(no output)'));
  }

  const total = secs(results.reduce((m, r) => Math.max(m, r.ms), 0));
  console.log('');
  if (failed.length) {
    console.log(C.red(C.bold(`  ${failed.length} of ${results.length} checks failed`)), C.dim(`in ${total}`));
    console.log(C.dim(`  ${failed.map(label).join(', ')}\n`));
    process.exit(1);
  }
  console.log(C.green(C.bold(`  all ${results.length} checks passed`)), C.dim(`in ${total}`));
  if (QUICK) console.log(C.yellow('  the web build was not run, so this is not the full bar\n'));
  else console.log('');
}

main();
