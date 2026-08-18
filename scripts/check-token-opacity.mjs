#!/usr/bin/env node
/**
 * Fail the build on `bg-ink/15` and friends.
 *
 * Tailwind resolves an opacity modifier on a theme colour AT BUILD TIME. It
 * writes the light-mode hex straight into the stylesheet, so the class stops
 * following `[data-theme="dark"]` and the element turns invisible on a dark
 * ground. Plain `bg-ink` compiles to `var(--color-ink)` and is fine.
 *
 * This is worth a check rather than a note in a document because of how it
 * fails: typecheck passes, lint passes, the build passes, and the page looks
 * correct in the only theme most people have open. It surfaces as "why is that
 * bar missing in dark mode" weeks later.
 *
 * The token list is read out of globals.css rather than written here, so a
 * colour added tomorrow is covered without anyone remembering to update this.
 *
 * The fix is always the same: add a real token to both the `@theme` block and
 * the dark block, as `--color-inkghost` does.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = resolve(ROOT, 'apps/web');

/** Every colour token the theme defines, straight from the source of truth. */
const css = readFileSync(resolve(WEB, 'app/globals.css'), 'utf8');
const tokens = [...css.matchAll(/^\s*--color-([a-z0-9]+):/gim)].map((m) => m[1]);
if (tokens.length < 5) {
  console.error('  could not read the colour tokens from globals.css; refusing to pass vacuously');
  process.exit(1);
}

/** Any utility that takes a colour, followed by /<number>. */
const PREFIX = 'bg|text|border|ring|outline|decoration|fill|stroke|divide|accent|caret|placeholder|from|via|to|shadow';
const pattern = new RegExp(`\\b(?:${PREFIX})-(?:${tokens.join('|')})\\/\\d+`, 'g');

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(tsx|ts|css)$/.test(full)) yield full;
  }
}

const hits = [];
for (const file of walk(WEB)) {
  // globals.css itself explains the rule and names the classes; skip it.
  if (file.endsWith('app/globals.css')) continue;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      // The doc comment on Skeleton names the bad class on purpose.
      if (/^\s*\*|^\s*\/\//.test(line)) return;
      for (const m of line.matchAll(pattern)) hits.push({ file, line: i + 1, text: m[0] });
    });
}

if (!hits.length) {
  console.log(`  ok, no opacity modifiers on ${tokens.length} theme colours`);
  process.exit(0);
}

console.error(`  ${hits.length} opacity modifier${hits.length === 1 ? '' : 's'} on a theme colour:\n`);
for (const h of hits) console.error(`    ${relative(ROOT, h.file)}:${h.line}  ${h.text}`);
console.error('\n  These bake the light hex into the stylesheet and break dark mode silently.');
console.error('  Add a real token to the @theme block AND the dark block in globals.css instead,');
console.error('  the way --color-inkghost does. See rule 9 in apps/web/CLAUDE.md.');
process.exit(1);
