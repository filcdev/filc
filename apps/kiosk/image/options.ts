/**
 * Every knob the TUI exposes. Defaults reproduce `build.sh`'s old hardcoded
 * invocation, so a build with no changes is byte-for-byte the old image.
 */

export const ARCHS = ['x86_64', 'aarch64', 'x86', 'armv7', 'riscv64'] as const;
export const BOOT_MODES = ['BIOS', 'UEFI'] as const;
export const BRANCHES = ['v3.24', 'v3.23', 'edge'] as const;
export const IMAGE_FORMATS = ['raw', 'qcow2', 'vmdk', 'vdi'] as const;
export const KERNEL_FLAVORS = ['lts', 'virt'] as const;
export const ORIENTATIONS = [
  'normal',
  '90',
  '180',
  '270',
  'flipped',
  'flipped-90',
  'flipped-180',
  'flipped-270',
] as const;

/** wlroots transform names kanshi accepts, mapped from picker values. */
export const ORIENTATION_LABELS: Record<(typeof ORIENTATIONS)[number], string> =
  {
    '90': '90° (portrait)',
    '180': '180°',
    '270': '270° (portrait)',
    flipped: 'Mirrored',
    'flipped-90': 'Mirror + 90°',
    'flipped-180': 'Mirror + 180°',
    'flipped-270': 'Mirror + 270°',
    normal: 'No rotation',
  };

export const TIMEZONES = [
  'Europe/Budapest',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Warsaw',
  'Europe/Bucharest',
  'Europe/Kyiv',
  'UTC',
] as const;

/** Packages that give the box runtime control of its outputs. */
export const KANSHI_PACKAGES = ['kanshi', 'wlr-randr'] as const;

export type BuildOptions = {
  arch: (typeof ARCHS)[number];
  /** BIOS/UEFI. UEFI forces GPT + ESP, which the tool requires. */
  bootMode: (typeof BOOT_MODES)[number];
  branch: (typeof BRANCHES)[number];
  /** Serial console. Off saves the boot log from `dmesg`-only diagnosis. */
  serialConsole: boolean;
  /** Single-partition GPT even on BIOS. Off keeps the whole-disk syslinux image. */
  partition: boolean;
  kernelFlavor: (typeof KERNEL_FLAVORS)[number];
  imageSize: string;
  imageFormat: (typeof IMAGE_FORMATS)[number];
  /** Written to `/etc/kiosk/url` in the image by setup.sh. */
  kioskUrl: string;
  hostname: string;
  timezone: (typeof TIMEZONES)[number];
  /** Applied to every output via kanshi; `normal` writes no kanshi config. */
  orientation: (typeof ORIENTATIONS)[number];
  /** Preferred resolution, or `none` for the output's own preferred mode. */
  outputMode: string;
  /** Display scale factor for the kiosk page. */
  outputScale: string;
  /** Extra apk packages appended to `packages`. */
  extraPackages: string[];
};

export const DEFAULT_OPTIONS: BuildOptions = {
  arch: 'x86_64',
  bootMode: 'BIOS',
  branch: 'v3.24',
  extraPackages: [],
  hostname: 'kiosk',
  imageFormat: 'raw',
  imageSize: '2G',
  kernelFlavor: 'lts',
  kioskUrl: 'https://kiosk.filc.petrik.hu',
  orientation: 'normal',
  outputMode: 'none',
  outputScale: '1',
  partition: false,
  serialConsole: true,
  timezone: 'Europe/Budapest',
};

/** Hostname: RFC 1123 label. Alpine accepts more, but the box is enrolled by name. */
const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
/** alpine-make-vm-image size: bytes, or a K/M/G/T suffix. */
const IMAGE_SIZE_RE = /^[0-9]+([KMGT]?)$/i;
const SCALE_RE = /^[0-9]+(\.[0-9]+)?$/;
/** `none` for the output's own preferred mode, else WIDTHxHEIGHT. */
const MODE_RE = /^(none|[0-9]{3,5}x[0-9]{3,5})$/;

export type ValidationIssue = {
  field: keyof BuildOptions;
  message: string;
};

/** Regexes validated against the TUI's free-text fields. */
const URL_RE = /^https?:\/\//i;
const APK_NAME_RE = /^[a-z0-9][a-z0-9._+-]*$/;
/** Trailing comment in the apk `packages` list, stripped like `sed` did. */
const COMMENT_RE = /#.*/;

const SCALAR_RULES: {
  field: keyof BuildOptions;
  test: (value: string) => boolean;
  message: string;
}[] = [
  {
    field: 'hostname',
    message: 'lowercase letters, digits and hyphens (RFC 1123 label)',
    test: (value) => HOSTNAME_RE.test(value),
  },
  {
    field: 'imageSize',
    message: 'bytes or a K/M/G/T suffix, e.g. 2048M or 2G',
    test: (value) => IMAGE_SIZE_RE.test(value),
  },
  {
    field: 'outputMode',
    message: 'none or WIDTHxHEIGHT, e.g. 1920x1080',
    test: (value) => MODE_RE.test(value),
  },
  {
    field: 'outputScale',
    message: 'a positive number, e.g. 1 or 1.5',
    test: (value) => SCALE_RE.test(value) && Number.parseFloat(value) > 0,
  },
  {
    field: 'kioskUrl',
    message: 'must start with http:// or https://',
    test: (value) => URL_RE.test(value),
  },
];

/**
 * BIOS is the only whole-disk layout: the tool forces GPT + ESP for UEFI, and
 * refuses BIOS on non-x86. Reject both here rather than inside a root chroot.
 */
function validateCombinations(options: BuildOptions): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const isX86 = options.arch === 'x86_64' || options.arch === 'x86';

  if (options.bootMode === 'BIOS' && !isX86) {
    issues.push({
      field: 'bootMode',
      message: `BIOS boot needs x86_64 or x86, not ${options.arch}`,
    });
  }
  if (options.bootMode === 'BIOS' && options.partition) {
    issues.push({
      field: 'partition',
      message: 'GPT is created automatically for UEFI; pick UEFI to use it',
    });
  }
  if (options.branch === 'edge' && options.arch !== 'x86_64') {
    issues.push({
      field: 'branch',
      message: `edge publishes no ${options.arch} packages`,
    });
  }
  return issues;
}

/**
 * Validates before any root command runs: a typo in the TUI must never become a
 * half-written 2 GB image or a `dd` to the wrong device.
 */
export function validateOptions(options: BuildOptions): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const rule of SCALAR_RULES) {
    const value = String(options[rule.field]).trim();
    if (!rule.test(value)) {
      issues.push({ field: rule.field, message: rule.message });
    }
  }

  for (const [index, pkg] of options.extraPackages.entries()) {
    if (!APK_NAME_RE.test(pkg.trim())) {
      issues.push({
        field: 'extraPackages',
        message: `package ${index + 1} ("${pkg}") is not a valid apk name`,
      });
    }
  }

  return issues.concat(validateCombinations(options));
}

/**
 * The apk package list, comments stripped — same reading the old `build.sh`
 * did with sed, kept so the file stays the source of truth one edit away.
 */
export async function readBasePackages(imageDir: string): Promise<string[]> {
  const text = await Bun.file(`${imageDir}/packages`).text();
  return text
    .split('\n')
    .map((line: string) => line.replace(COMMENT_RE, '').trim())
    .filter((line: string) => line.length > 0);
}

/** Base packages plus the TUI's extras, deduplicated, for one `--packages` flag. */
export async function resolvePackages(
  options: BuildOptions,
  imageDir: string
): Promise<string[]> {
  const base = await readBasePackages(imageDir);
  const seen = new Set(base);
  for (const pkg of options.extraPackages) {
    const name = pkg.trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      base.push(name);
    }
  }
  return base;
}
