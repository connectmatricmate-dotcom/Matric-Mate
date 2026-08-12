#!/usr/bin/env node
/**
 * Build the Android APK on this machine, with no EAS queue.
 *
 *   npm run apk                 preview profile, an installable .apk
 *   npm run apk -- --production production profile, an .aab for Play
 *
 * WHY LOCAL
 *
 * The free EAS tier queues, and a queue is dead time when the client is waiting
 * to see a build. `--local` runs the identical build on this machine: same
 * eas.json profile, same environment variables pulled from the Expo dashboard,
 * same artifact. Only the machine changes.
 *
 * WHY THIS WRAPPER
 *
 * A local build fails in Gradle's voice, several minutes in, when the toolchain
 * is not set up. The checks below fail in ours, immediately, and say what to
 * install. Each one is a real failure someone will otherwise spend an evening
 * on: no JDK at all, a JDK too old for Android Gradle Plugin 8, an SDK that was
 * installed but never exported, and being signed out of the account that holds
 * the signing key.
 */

import { execFile, spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { access, mkdir, readdir, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = resolve(ROOT, 'apps/mobile');
const OUT = resolve(ROOT, 'builds');

const PRODUCTION = process.argv.includes('--production');
const PROFILE = PRODUCTION ? 'production' : 'preview';

/** Android Gradle Plugin 8, which Expo 57 uses, needs 17 or newer. */
const MIN_JDK = 17;

/**
 * The newest Node the local build plugin actually runs on.
 *
 * eas-cli-local-build-plugin logs through bunyan, which loads dtrace-provider,
 * whose native binding does not build on Node 23 or newer. It fails as
 * `dtrace.createDTraceProvider is not a function` before any build work starts,
 * and eas reports it as an empty non-zero exit with no stdout at all, which
 * tells you nothing. The rest of the repo is happy on a newer Node, so rather
 * than hold the whole project back, the build alone is run on an older one.
 */
const MAX_BUILD_NODE = 22;

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

const ok = (label, detail) => console.log(`${C.green('  ok  ')} ${label.padEnd(14)} ${C.dim(detail)}`);

function fail(label, why, fix) {
  console.log(`${C.red(' need ')} ${label.padEnd(14)} ${C.dim(why)}`);
  console.log(`\n${fix}\n`);
  process.exit(1);
}

async function checkJdk() {
  let out;
  try {
    // java -version writes to stderr, which is not an error here.
    const r = await run('java', ['-version']);
    out = `${r.stdout}${r.stderr}`;
  } catch {
    fail(
      'jdk',
      'java is not installed',
      `Install a JDK, then run this again:\n\n  sudo apt install -y openjdk-${MIN_JDK}-jdk`,
    );
  }
  const major = Number(out.match(/version "(\d+)/)?.[1] ?? 0);
  if (major < MIN_JDK) {
    fail(
      'jdk',
      `java ${major}, need ${MIN_JDK} or newer`,
      `Android Gradle Plugin 8 will not run on this JDK:\n\n  sudo apt install -y openjdk-${MIN_JDK}-jdk\n  sudo update-alternatives --config java`,
    );
  }
  ok('jdk', `java ${major}`);
}

/**
 * Where the SDK is, without needing a shell profile edit.
 *
 * `sdkmanager` installs to ~/Android/Sdk unless told otherwise, so falling back
 * to it means a fresh terminal builds without exporting anything. An explicit
 * ANDROID_HOME still wins, for anyone who put the SDK somewhere else.
 */
function androidHome() {
  const set = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  return set || resolve(homedir(), 'Android/Sdk');
}

async function checkAndroidSdk() {
  const home = androidHome();
  if (!home) {
    fail(
      'android sdk',
      'ANDROID_HOME is not set',
      [
        'Install the SDK once, then export it from your shell profile:',
        '',
        '  # Android Studio, or just the command line tools:',
        '  #   https://developer.android.com/studio#command-line-tools-only',
        '  #   unzip into ~/Android/Sdk/cmdline-tools/latest',
        '',
        '  export ANDROID_HOME=$HOME/Android/Sdk',
        '  export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin',
        '',
        '  sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"',
        '',
        'Add the two exports to ~/.bashrc so they survive a new terminal.',
      ].join('\n'),
    );
  }
  try {
    await access(resolve(home, 'platform-tools'));
  } catch {
    fail(
      'android sdk',
      `nothing at ${home}/platform-tools`,
      `ANDROID_HOME points at ${home}, but the SDK is not there. Install it:\n\n  sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"`,
    );
  }
  ok('android sdk', home);
}

/**
 * A Node the build plugin can run on: this one if it is old enough, otherwise
 * the newest suitable version nvm has. Returns the bin directory to put at the
 * front of the child's PATH, or null to use the current Node.
 */
function buildNodeBin() {
  if (Number(process.versions.node.split('.')[0]) <= MAX_BUILD_NODE) return null;
  const versions = resolve(homedir(), '.nvm/versions/node');
  let best = null;
  try {
    for (const dir of readdirSync(versions)) {
      const major = Number(dir.replace(/^v/, '').split('.')[0]);
      if (major > MAX_BUILD_NODE || major < 20) continue;
      if (!best || major > best.major) best = { major, dir };
    }
  } catch {
    return null;
  }
  return best ? resolve(versions, best.dir, 'bin') : null;
}

async function checkBuildNode() {
  const current = Number(process.versions.node.split('.')[0]);
  if (current <= MAX_BUILD_NODE) {
    ok('node', `node ${current}`);
    return null;
  }
  const bin = buildNodeBin();
  if (!bin) {
    fail(
      'node',
      `node ${current}, and the build plugin cannot run above ${MAX_BUILD_NODE}`,
      `Install a supported Node once. Nothing else in the repo changes, the build alone uses it:\n\n  nvm install ${MAX_BUILD_NODE}`,
    );
  }
  const { stdout } = await run(resolve(bin, 'node'), ['-v']);
  ok('node', `${stdout.trim()} for the build, ${process.version} everywhere else`);
  return bin;
}

async function checkEasLogin() {
  try {
    const { stdout } = await run('npx', ['eas-cli', 'whoami'], { cwd: MOBILE });
    ok('eas account', stdout.trim().split('\n')[0]);
  } catch {
    fail(
      'eas account',
      'not signed in',
      'The signing key and the environment variables live on the Expo account:\n\n  npx eas-cli login',
    );
  }
}

/**
 * Moves the artifact into builds/ under a name that says what it is.
 *
 * eas leaves it in the working directory as build-<timestamp>.apk, which tells
 * nobody which commit or profile it came from, and the folder is gitignored so
 * a 100 MB binary never reaches the repo.
 */
async function collect() {
  const files = (await readdir(MOBILE)).filter((f) => /^build-\d+\.(apk|aab)$/.test(f));
  if (!files.length) return null;

  const [newest] = files.sort().reverse();
  const ext = newest.endsWith('.aab') ? 'aab' : 'apk';
  const sha = (await run('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT })).stdout.trim();

  await mkdir(OUT, { recursive: true });
  const dest = resolve(OUT, `MatricMate-${PROFILE}-${sha}.${ext}`);
  await rename(resolve(MOBILE, newest), dest);
  return dest;
}

async function main() {
  console.log(C.bold(`\n  local android build · ${PROFILE}\n`));

  await checkJdk();
  await checkAndroidSdk();
  const nodeBin = await checkBuildNode();
  await checkEasLogin();

  console.log(C.dim('\n  building. First run downloads Gradle and takes a while; later ones are faster.\n'));

  const code = await new Promise((done) => {
    const home = androidHome();
    const child = spawn(
      'npx',
      ['eas-cli', 'build', '--profile', PROFILE, '--platform', 'android', '--local', '--non-interactive'],
      {
        cwd: MOBILE,
        stdio: 'inherit',
        // Gradle reads these, and they are not in the shell profile.
        env: {
          ...process.env,
          ANDROID_HOME: home,
          ANDROID_SDK_ROOT: home,
          // The build Node goes at the FRONT, the Android tools at the back.
          PATH: [
            ...(nodeBin ? [nodeBin] : []),
            process.env.PATH,
            resolve(home, 'platform-tools'),
            resolve(home, 'cmdline-tools/latest/bin'),
          ].join(':'),
        },
      },
    );
    child.on('close', done);
  });

  if (code !== 0) {
    console.log(C.red(`\n  build failed (exit ${code})\n`));
    process.exit(code ?? 1);
  }

  const artifact = await collect();
  console.log(
    artifact
      ? C.green(`\n  ${artifact}\n`)
      : C.dim('\n  built, but no artifact found in apps/mobile. Check the output above.\n'),
  );
}

main().catch((e) => {
  console.error(C.red(`\n${e.message}\n`));
  process.exit(1);
});
