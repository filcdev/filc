#!/usr/bin/env bun
/**
 * Builds the filc kiosk disk image: Alpine with a read-only rootfs that boots
 * straight into the kiosk SPA under cage + Chromium.
 *
 * Usage: sudo apps/kiosk/image/build.ts [--dry-run]
 *
 * Replaces build.sh. Same tool, same verification, plus a TUI that selects the
 * options the old script hardcoded (boot mode, size, orientation, …) and can
 * flash the finished image straight to a disk.
 *
 * --dry-run prints the plan without touching sudo, the network or a disk: the
 * whole flag list and the generated files, for review before a real build.
 */

import { execFile } from 'node:child_process';
import { rm, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { type BuildInvocation, planBuild, writeGeneratedFiles } from './config';
import { formatSize, listFlashTargets, planFlash, runFlash } from './flash';
import {
  ARCHS,
  BOOT_MODES,
  BRANCHES,
  type BuildOptions,
  DEFAULT_OPTIONS,
  IMAGE_FORMATS,
  KERNEL_FLAVORS,
  ORIENTATION_LABELS,
  ORIENTATIONS,
  TIMEZONES,
  validateOptions,
} from './options';
import {
  ANSI,
  confirmByTyping,
  disableRawMode,
  ExitError,
  enableRawMode,
  finishSpinner,
  isInteractive,
  multiSelect,
  println,
  renderSpinner,
  renderSummary,
  select,
  text,
  toggle,
} from './tui';

const execFileAsync = promisify(execFile);

const IMAGE_DIR = new URL('.', import.meta.url).pathname;
const IMAGE_FILE = 'kiosk.img';

/** alpine-make-vm-image, verified against the sha1 in its README. */
const TOOL_VERSION = '0.13.4';
const TOOL_SHA1 = '33b338dc0d2ce67a8dd4f1701862f051aed565f1';
const TOOL_URI = `https://raw.githubusercontent.com/alpinelinux/alpine-make-vm-image/v${TOOL_VERSION}/alpine-make-vm-image`;

/** apk does not fail the build tool when it runs out of space, so the image is
 * checked for the kiosk it is supposed to contain before we call it done. */
const REQUIRED_FILES = [
  '/etc/init.d/kiosk',
  '/etc/kiosk/url',
  '/usr/local/bin/kiosk-browser',
  '/usr/bin/cage',
  '/usr/bin/chromium',
  '/etc/udhcpc/udhcpc.conf',
];

const READ_ONLY_FSTAB_RE = /^UUID=\S+\s+\/\s+\S+\s+ro,noatime/;

const HOST_TOOLS = ['curl', 'qemu-img', 'qemu-nbd', 'rsync', 'sha1sum'];

class BuildError extends Error {}

function fail(message: string): never {
  throw new BuildError(message);
}

/** Root check up front: every later step needs it, and failing late wastes a build. */
function requireRoot(): void {
  if (process.getuid?.() !== 0) {
    fail(
      'this script needs root (it loop-mounts the image and chroots into it). Run: sudo bun apps/kiosk/image/build.ts'
    );
  }
}

async function checkHostTools(): Promise<void> {
  const missing: string[] = [];
  for (const tool of HOST_TOOLS) {
    try {
      await execFileAsync('sh', ['-c', `command -v ${tool}`]);
    } catch {
      missing.push(tool);
    }
  }
  if (missing.length > 0) {
    fail(
      `missing build dependencies: ${missing.join(', ')} (see image/README.md)`
    );
  }
}

/** Refuses to build over a block device — the build tool formats in place. */
async function guardImageTarget(path: string): Promise<void> {
  const info = await stat(path).catch(() => null);
  if (info?.isBlockDevice()) {
    fail(`${path} is a block device; refusing to build over it.`);
  }
}

/**
 * The TUI flow: every option is a picker whose default reproduces the old script,
 * so a run that changes nothing produces the old 2 GB BIOS image.
 */
async function collectOptions(): Promise<BuildOptions> {
  const options: BuildOptions = {
    ...DEFAULT_OPTIONS,
    arch: (await select(
      'Architecture',
      ARCHS.map((value) => ({ label: value, value })),
      ARCHS.indexOf(DEFAULT_OPTIONS.arch)
    )) as BuildOptions['arch'],
    bootMode: (await select(
      'Boot mode',
      BOOT_MODES.map((value) => ({
        hint:
          value === 'BIOS'
            ? 'whole-disk syslinux — the shape a Ventoy stick or dd takes'
            : 'GPT + ESP, for boards with no legacy BIOS',
        label: value,
        value,
      })),
      BOOT_MODES.indexOf(DEFAULT_OPTIONS.bootMode)
    )) as BuildOptions['bootMode'],
    branch: (await select(
      'Alpine branch',
      BRANCHES.map((value) => ({ label: value, value })),
      BRANCHES.indexOf(DEFAULT_OPTIONS.branch)
    )) as BuildOptions['branch'],
    extraPackages: await multiSelect(
      'Extra packages',
      EXTRA_PACKAGE_CHOICES,
      []
    ),
    hostname: await text(
      'Hostname',
      DEFAULT_OPTIONS.hostname,
      'the box name on the network'
    ),
    imageFormat: (await select(
      'Image format',
      IMAGE_FORMATS.map((value) => ({
        hint:
          value === 'raw' ? 'dd or Ventoy' : 'for a virtual disk on the server',
        label: value,
        value,
      })),
      IMAGE_FORMATS.indexOf(DEFAULT_OPTIONS.imageFormat)
    )) as BuildOptions['imageFormat'],
    imageSize: await text(
      'Image size',
      DEFAULT_OPTIONS.imageSize,
      'chromium dominates; below 2G apk runs out of space'
    ),
    kernelFlavor: (await select(
      'Kernel flavor',
      KERNEL_FLAVORS.map((value) => ({
        hint:
          value === 'lts'
            ? 'long-term stable, what a box ships'
            : 'smaller, virtualised hosts only',
        label: value,
        value,
      })),
      KERNEL_FLAVORS.indexOf(DEFAULT_OPTIONS.kernelFlavor)
    )) as BuildOptions['kernelFlavor'],
    kioskUrl: await text(
      'SPA origin',
      DEFAULT_OPTIONS.kioskUrl,
      'written to /etc/kiosk/url inside the image'
    ),
    orientation: (await select(
      'Display orientation',
      // ORIENTATIONS order, not the label map's: `normal` is the default and has
      // to be the row the initial index selects.
      ORIENTATIONS.map((value) => ({
        hint: value === 'normal' ? 'trust the panel' : 'forced transform',
        label: ORIENTATION_LABELS[value],
        value,
      })),
      ORIENTATIONS.indexOf(DEFAULT_OPTIONS.orientation)
    )) as BuildOptions['orientation'],
    outputMode: await text(
      'Preferred resolution',
      DEFAULT_OPTIONS.outputMode,
      'none to keep the panel preferred mode, else e.g. 1920x1080'
    ),
    outputScale: await text(
      'Display scale',
      DEFAULT_OPTIONS.outputScale,
      '1 for a TV; a navigator touch panel may want 1.5'
    ),
    partition: await toggle(
      'GPT partition table',
      DEFAULT_OPTIONS.partition,
      'whole-disk otherwise; UEFI always partitions'
    ),
    serialConsole: await toggle(
      'Serial console',
      DEFAULT_OPTIONS.serialConsole,
      'boot log on ttyS0 — the only log a headless box gives you'
    ),
    timezone: (await select(
      'Timezone',
      TIMEZONES.map((value) => ({ label: value, value })),
      TIMEZONES.indexOf(DEFAULT_OPTIONS.timezone)
    )) as BuildOptions['timezone'],
  };

  // Extra apk packages, kept as free text so an unlisted tool can still be asked
  // for. `none` is the sentinel for no more.
  if (options.extraPackages.includes('__custom__')) {
    options.extraPackages = options.extraPackages.filter(
      (pkg) => pkg !== '__custom__'
    );
    const custom = await text(
      'Extra apk packages (space separated)',
      '',
      'e.g. htop nano'
    );
    options.extraPackages.push(...custom.split(' ').filter(Boolean));
  }
  return options;
}

const EXTRA_PACKAGE_CHOICES = [
  {
    hint: 'runtime output control, apply kanshi by hand',
    label: 'wlr-randr',
    value: 'wlr-randr',
  },
  { hint: 'process viewer on the box', label: 'htop', value: 'htop' },
  { hint: 'pager for config inspection', label: 'less', value: 'less' },
  { hint: 'editor, only useful over serial', label: 'nano', value: 'nano' },
  { label: 'other…', value: '__custom__' },
];

/** Prints the issues and re-asks the affected fields, so no build starts invalid. */
async function resolveIssues(options: BuildOptions): Promise<BuildOptions> {
  let current = options;
  for (;;) {
    const issues = validateOptions(current);
    if (issues.length === 0) {
      return current;
    }
    println(`${ANSI.yellow}! fix these before building${ANSI.reset}`);
    for (const issue of issues) {
      println(`  ${issue.field}: ${issue.message}`);
    }
    println('');
    const retry = await select('Re-enter values?', [
      { hint: 'restart the option flow', label: 'yes', value: 'yes' },
      { hint: 'quit without building', label: 'no', value: 'no' },
    ]);
    if (retry === 'no') {
      fail('option validation failed');
    }
    current = { ...(await collectOptions()) };
  }
}

/**
 * Runs the build tool with a spinner, streaming its own output only on failure —
 * a successful build has nothing to say that the spinner does not.
 */
async function runBuild(flags: string[], workdir: string): Promise<void> {
  const tool = `${workdir}/alpine-make-vm-image`;
  let frame = 0;
  const spinner = setInterval(() => {
    renderSpinner(
      'building image (apk, kernel, syslinux — this takes minutes)',
      frame++
    );
  }, 120);

  try {
    await execFileAsync(tool, flags, {
      cwd: IMAGE_DIR,
      maxBuffer: 64 * 1024 * 1024,
    });
    finishSpinner('image built', true);
  } catch (error) {
    finishSpinner('build failed', false);
    clearInterval(spinner);
    // The child's own stderr is the useful part: a truncated apk unpack is the
    // failure this catches, and nothing else reports it.
    const stderr =
      error && typeof error === 'object' && 'stderr' in error
        ? String(error.stderr)
        : '';
    println(`${ANSI.red}${stderr}${ANSI.reset}`);
    const code =
      error && typeof error === 'object' && 'code' in error ? error.code : '?';
    fail(`alpine-make-vm-image failed (exit ${code})`);
  } finally {
    clearInterval(spinner);
  }
}

/** Downloads and sha1-verifies the build tool. */
async function fetchTool(workdir: string): Promise<void> {
  const tool = `${workdir}/alpine-make-vm-image`;
  const checksum = `${workdir}/alpine-make-vm-image.sha1`;
  await execFileAsync('curl', ['-fsSL', '-o', tool, TOOL_URI]);
  await writeFileSafe(checksum, `${TOOL_SHA1}  ${tool}\n`);
  await execFileAsync('sha1sum', ['-c', checksum], { cwd: workdir });
  await execFileAsync('chmod', ['+x', tool]);
}

async function writeFileSafe(path: string, content: string): Promise<void> {
  await Bun.write(path, content);
}

/**
 * Mounts the built root filesystem and returns what is missing from it. A
 * whole-disk image carries the filesystem at offset 0, but a partitioned one —
 * UEFI always partitions, `--partition` does it on BIOS — does not: those have
 * the ESP as partition 1 and the root filesystem as partition 2, so the root is
 * only reachable through a loop device with partition scanning. Without this a
 * correctly built UEFI image always failed verification.
 */
async function verifyImage(
  options: BuildOptions,
  path: string,
  mountDir: string
): Promise<string[]> {
  const problems: string[] = [];
  const partitioned = options.bootMode === 'UEFI' || options.partition;
  let loopDevice = '';

  try {
    if (partitioned) {
      const { stdout } = await execFileAsync('losetup', [
        '--find',
        '--partscan',
        '--show',
        path,
      ]);
      loopDevice = stdout.trim();
      // UEFI is ESP + root (p2); a partitioned BIOS image is one system
      // partition (p1) with syslinux on it — the tool creates the GPT either
      // way, so the root device depends on the boot mode, not on `partition`.
      const rootPartition = options.bootMode === 'UEFI' ? 'p2' : 'p1';
      await waitForDevice(`${loopDevice}${rootPartition}`);
      await execFileAsync('mount', [
        '-o',
        'ro',
        `${loopDevice}${rootPartition}`,
        mountDir,
      ]);
    } else {
      await execFileAsync('mount', ['-o', 'loop,ro', path, mountDir]);
    }

    for (const file of REQUIRED_FILES) {
      const found = await stat(`${mountDir}${file}`).catch(() => null);
      if (!found) {
        problems.push(`built image is missing ${file}`);
      }
    }
    const fstab = await Bun.file(`${mountDir}/etc/fstab`)
      .text()
      .catch(() => '');
    if (!READ_ONLY_FSTAB_RE.test(fstab)) {
      problems.push('root is not mounted read-only in the image /etc/fstab');
    }
  } finally {
    await ignoreCleanupError(['umount', mountDir]);
    if (loopDevice) {
      await ignoreCleanupError(['losetup', '--detach', loopDevice]);
    }
  }

  return problems;
}

/** `losetup --partscan` publishes loopNpX asynchronously on some kernels. */
async function waitForDevice(path: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await stat(path).catch(() => null)) {
      return;
    }
    await Bun.sleep(250);
  }
  fail(`partition device ${path} did not appear`);
}

/** Interactive flash step offered after a successful build. */
async function offerFlash(): Promise<void> {
  const devices = await listFlashTargets();
  const usable = devices.filter((device) => device.blockedReason === '');
  const blocked = devices.filter((device) => device.blockedReason !== '');

  if (usable.length === 0) {
    println(`${ANSI.dim}No flashable disk found.${ANSI.reset}`);
    if (blocked.length > 0) {
      println(`${ANSI.dim}Not offered:${ANSI.reset}`);
      for (const device of blocked) {
        println(
          `${ANSI.dim}  ${device.path} (${device.blockedReason})${ANSI.reset}`
        );
      }
    }
    return;
  }

  const answer = await select('Flash kiosk.img to a disk?', [
    { hint: 'skip, flash later with dd', label: 'no', value: 'no' },
    ...usable.map((device) => ({
      hint: `${formatSize(device.sizeBytes)} · ${device.model}`,
      label: device.path,
      value: device.path,
    })),
  ]);
  if (answer === 'no') {
    return;
  }

  const plan = await planFlash(answer, `${IMAGE_DIR}${IMAGE_FILE}`);
  if (typeof plan === 'string') {
    fail(plan);
  }

  const confirmed = await confirmByTyping(
    `This destroys ${plan.device.path}`,
    [
      `${formatSize(plan.device.sizeBytes)} · ${plan.device.model}`,
      `image ${formatSize(plan.imageSize)} will be written over it`,
      plan.device.mountedPoints.length > 0
        ? `MOUNTED: ${plan.device.mountedPoints.join(', ')}`
        : 'not mounted',
    ],
    plan.device.path
  );
  if (!confirmed) {
    println(`${ANSI.dim}Flash aborted.${ANSI.reset}`);
    return;
  }

  const result = await runFlash(plan);
  println(
    `${ANSI.green}✓${ANSI.reset} wrote ${formatSize(result.bytesWritten)} to ${result.device} in ${result.seconds.toFixed(0)}s`
  );
}

/** The one sequence a build follows; split out so --dry-run can reuse it. */
async function executeBuild(
  options: BuildOptions,
  workdir: string,
  dryRun: boolean
): Promise<void> {
  const invocation = await planBuild(options, IMAGE_FILE, IMAGE_DIR);

  if (dryRun) {
    renderDryRun(invocation);
    return;
  }

  await writeGeneratedFiles(options, IMAGE_DIR);
  await guardImageTarget(`${IMAGE_DIR}${IMAGE_FILE}`);

  // The build tool only creates the image when the file is absent, then formats
  // it in place: a leftover image would silently keep its old size, format and
  // partition layout. build.sh always started from a fresh file.
  if (await stat(`${IMAGE_DIR}${IMAGE_FILE}`).catch(() => null)) {
    await rm(`${IMAGE_DIR}${IMAGE_FILE}`, { force: true });
    println(`${ANSI.dim}removed the previous ${IMAGE_FILE}${ANSI.reset}`);
  }

  println('');
  let frame = 0;
  const spinner = setInterval(() => {
    renderSpinner(`fetching alpine-make-vm-image ${TOOL_VERSION}`, frame++);
  }, 120);
  try {
    await fetchTool(workdir);
    finishSpinner(`alpine-make-vm-image ${TOOL_VERSION} verified`, true);
  } finally {
    clearInterval(spinner);
  }

  await runBuild(invocation.flags, workdir);

  const mountDir = await makeTempDir();
  try {
    const problems = await verifyImage(
      options,
      `${IMAGE_DIR}${IMAGE_FILE}`,
      mountDir
    );
    if (problems.length > 0) {
      for (const problem of problems) {
        println(`${ANSI.red}✗ ${problem}${ANSI.reset}`);
      }
      fail('the built image failed verification');
    }
    println(
      `${ANSI.green}✓${ANSI.reset} image verified: kiosk service, browser, read-only root`
    );
  } finally {
    await ignoreCleanupError(['rmdir', mountDir]);
  }

  println(`\n${ANSI.dim}apps/kiosk/image/${IMAGE_FILE} is ready.${ANSI.reset}`);
  await offerFlash();
}

function renderDryRun(invocation: BuildInvocation): void {
  println(
    `${ANSI.bold}Dry run: nothing was written, mounted or downloaded.${ANSI.reset}\n`
  );
  renderSummary([
    ...invocation.summary.map((row) => `${row.label.padEnd(14)} ${row.value}`),
    '',
    `packages (${invocation.packages.length})`,
    ...invocation.packages.map((pkg) => `  ${pkg}`),
    '',
    'alpine-make-vm-image invocation',
    ...invocation.flags.map((flag) => `  ${flag}`),
  ]);
}

async function makeTempDir(): Promise<string> {
  const { stdout } = await execFileAsync('mktemp', ['-d']);
  return stdout.trim();
}

/**
 * Cleanup that must not fail the flow: an already-unmounted loop device or a
 * directory `rm` already took. Swallowed deliberately — the alternative is a
 * dying build reporting a cleanup problem instead of its own.
 */
async function ignoreCleanupError(command: string[]): Promise<void> {
  try {
    await execFileAsync(command[0], command.slice(1));
  } catch {
    // Nothing to undo.
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  if (!dryRun) {
    requireRoot();
    await checkHostTools();
  }

  if (!isInteractive()) {
    fail(
      'a terminal is required for the option prompts. Re-run from a TTY, or use --dry-run to print the plan.'
    );
  }

  enableRawMode();
  let options: BuildOptions;
  try {
    if (!dryRun) {
      println(
        `${ANSI.cyan}Filc kiosk image builder${ANSI.reset} ${ANSI.dim}— defaults reproduce the previous image${ANSI.reset}\n`
      );
    }
    options = await resolveIssues(await collectOptions());
  } finally {
    disableRawMode();
  }

  const workdir = dryRun ? '' : await makeTempDir();
  try {
    await executeBuild(options, workdir, dryRun);
  } finally {
    if (workdir) {
      await ignoreCleanupError(['rm', '-rf', workdir]);
    }
  }
}

main().catch((error: unknown) => {
  disableRawMode();
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(
    `\n${ANSI.red}${error instanceof ExitError ? 'aborted' : 'error'}${ANSI.reset} ${message}\n`
  );
  process.exit(error instanceof ExitError ? 0 : 1);
});
