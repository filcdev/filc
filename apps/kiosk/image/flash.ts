/**
 * Straight-to-disk flashing: enumerate candidate disks, refuse anything the box
 * needs, then `dd` the finished image.
 *
 * Every rule in here exists because under `sudo` a wrong pick is unrecoverable:
 * the write cannot be undone and the image does not carry a filesystem label
 * that would let a human undo it. Refusal is the default, not the confirmation.
 */

import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type BlockDevice = {
  /** Kernel name, e.g. `nvme0n1`. */
  name: string;
  /** Absolute path, e.g. `/dev/nvme0n1`. */
  path: string;
  /** Bytes, from sysfs (authoritative) rather than lsblk's rounded text. */
  sizeBytes: number;
  /** Manufacturer + model, trimmed. */
  model: string;
  /** Non-empty when any partition (or a child dm/lvm device above one) is mounted. */
  mountedPoints: string[];
  /** True for loop, ram, nbd, dm — never a flash target. */
  virtual: boolean;
  /** True when the device reports removable. */
  removable: boolean;
  /** Why this device must not be offered. Empty when it is a valid candidate. */
  blockedReason: string;
};

const PREFIXES_NEVER_SAFE = [
  'loop',
  'ram',
  'zram',
  'dm-',
  'md',
  'nbd',
  'sr',
  'fd',
];

const DEV_PREFIX_RE = /^\/dev\//;
const WHITESPACE_RE = /\s+/g;

/** A disk whose name starts with any of these is not a flash target. */
export function isVirtualName(name: string): boolean {
  return PREFIXES_NEVER_SAFE.some((prefix) => name.startsWith(prefix));
}

/** Bytes from sysfs `size` (in 512-byte sectors). */
export async function sysfsSizeBytes(name: string): Promise<number> {
  const text = await readFile(`/sys/block/${name}/size`, 'utf8').catch(
    () => null
  );
  if (text === null) {
    return 0;
  }
  return Number.parseInt(text.trim(), 10) * 512;
}

export async function sysfsModel(name: string): Promise<string> {
  const parts: string[] = [];
  for (const file of ['device/vendor', 'device/model']) {
    const text = await readFile(`/sys/block/${name}/${file}`, 'utf8').catch(
      () => null
    );
    if (text?.trim()) {
      parts.push(text.trim());
    }
  }
  return parts.join(' ').replace(WHITESPACE_RE, ' ') || 'unknown device';
}

/**
 * Mountpoints that live under a device, found through the partition tree: a
 * mount on `nvme0n1p2` means flashing `nvme0n1` destroys it, so parents must
 * inherit their children's mounts.
 */
export async function deviceMounts(path: string): Promise<string[]> {
  const parent = path.replace(DEV_PREFIX_RE, '');
  try {
    const { stdout } = await execFileAsync(
      'lsblk',
      ['-J', '-o', 'NAME,MOUNTPOINTS', path],
      { maxBuffer: 1024 * 1024 }
    );
    const parsed = JSON.parse(stdout) as {
      blockdevices?: LsblkNode[];
    };
    const points = new Set<string>();
    const walk = (nodes: LsblkNode[] | undefined) => {
      for (const node of nodes ?? []) {
        for (const point of node.mountpoints ?? []) {
          if (point) {
            points.add(point);
          }
        }
        walk(node.children);
      }
    };
    walk(parsed.blockdevices);
    // lsblk reports the device's own mounts on the parent node, so when it found
    // nothing, ask the kernel's table directly.
    if (points.size === 0) {
      for (const point of await scanProcMounts(parent)) {
        points.add(point);
      }
    }
    return [...points];
  } catch {
    return scanProcMounts(parent);
  }
}

type LsblkNode = {
  name?: string;
  mountpoints?: (string | null)[];
  children?: LsblkNode[];
};

/**
 * Reads /proc/self/mountinfo for any mount whose source resolves to `name` or
 * one of its partitions — the fallback when lsblk is missing, and the check that
 * catches dm-crypt mappings whose name lsblk does not nest.
 */
export async function scanProcMounts(name: string): Promise<string[]> {
  const text = await readFile('/proc/self/mountinfo', 'utf8').catch(() => null);
  if (text === null) {
    return [];
  }
  const mounts: string[] = [];
  for (const line of text.split('\n')) {
    const fields = line.split(' ');
    const source = fields[3] ?? '';
    const mountpoint = fields[4] ?? '';
    if (!source.startsWith('/dev/')) {
      continue;
    }
    const sourceName = source.replace(DEV_PREFIX_RE, '');
    if (sourceName === name || sourceName.startsWith(`${name}p`)) {
      mounts.push(mountpoint);
    }
  }
  return mounts;
}

/**
 * Why a device must not be offered. Checked in order of how final the failure is:
 * a mounted disk is destroyed outright, while a tiny one is merely useless.
 */
export function blockedReasonFor(
  sizeBytes: number,
  mountedPoints: string[]
): string {
  if (mountedPoints.length > 0) {
    return `in use (mounted at ${mountedPoints.join(', ')})`;
  }
  if (sizeBytes === 0) {
    return 'reports no size';
  }
  if (sizeBytes / 1e9 < 1) {
    return 'smaller than 1 GB';
  }
  return '';
}

/**
 * Every removable, non-virtual disk, with the reason each one is unsound. A
 * device with a `blockedReason` must never be offered in the picker — the
 * caller shows it only when a user asks why their disk is missing.
 */
export async function listFlashTargets(): Promise<BlockDevice[]> {
  const names = (await readdir('/sys/block').catch(() => []))
    .filter((name) => !isVirtualName(name))
    .sort();

  const devices: BlockDevice[] = [];
  for (const name of names) {
    const [sizeBytes, model, mounts, removableText] = await Promise.all([
      sysfsSizeBytes(name),
      sysfsModel(name),
      deviceMounts(`/dev/${name}`),
      readFile(`/sys/block/${name}/removable`, 'utf8').catch(() => '0'),
    ]);

    devices.push({
      blockedReason: blockedReasonFor(sizeBytes, mounts),
      model,
      mountedPoints: mounts,
      name,
      path: `/dev/${name}`,
      removable: removableText.trim() === '1',
      sizeBytes,
      virtual: isVirtualName(name),
    });
  }
  return devices;
}

/** Human-readable size for the picker: 476.9 GB, not 476934434816 bytes. */
export function formatSize(sizeBytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = sizeBytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

export type FlashPlan = {
  device: BlockDevice;
  imagePath: string;
  imageSize: number;
  /** Bytes `dd` will write, which never exceeds the device size. */
  bytesToWrite: number;
};

/** Builds the dd plan, refusing any mismatch that would leave a dead device. */
export async function planFlash(
  devicePath: string,
  imagePath: string
): Promise<FlashPlan | string> {
  const devices = await listFlashTargets();
  const device = devices.find((candidate) => candidate.path === devicePath);
  if (!device) {
    return `${devicePath} is not a flash target (missing, virtual, or in use)`;
  }
  if (device.blockedReason) {
    return `${devicePath} is unsafe: ${device.blockedReason}`;
  }

  const imageSize = await Bun.file(imagePath)
    .stat()
    .catch(() => null);
  if (!imageSize) {
    return `no image at ${imagePath}`;
  }
  if (imageSize.size > device.sizeBytes) {
    return `image is ${formatSize(imageSize.size)}, ${device.path} is only ${formatSize(device.sizeBytes)}`;
  }
  return {
    bytesToWrite: imageSize.size,
    device,
    imagePath,
    imageSize: imageSize.size,
  };
}

export type FlashResult = {
  bytesWritten: number;
  device: string;
  seconds: number;
};

/**
 * Writes the image to the device with `conv=fsync` so every block reaches the
 * platter before the command reports success — a cut power here otherwise leaves
 * a silently truncated image that boots nothing.
 *
 * The caller must already have run `planFlash` and had the user type the device
 * path; this function re-checks nothing, because anything it could check the
 * plan checked a moment earlier, and a re-check would only restart the race.
 */
export async function runFlash(plan: FlashPlan): Promise<FlashResult> {
  const startedAt = Date.now();
  await execFileAsync('dd', [
    `if=${plan.imagePath}`,
    `of=${plan.device.path}`,
    'bs=4M',
    'status=progress',
    'conv=fsync',
    'oflag=direct',
  ]);
  return {
    bytesWritten: plan.bytesToWrite,
    device: plan.device.path,
    seconds: (Date.now() - startedAt) / 1000,
  };
}
