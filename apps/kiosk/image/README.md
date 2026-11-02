# Kiosk disk image

An Alpine image with a read-only rootfs that boots straight into the kiosk SPA
(`apps/kiosk`) in Chromium under [cage](https://www.hjdskes.nl/projects/cage/),
a Wayland kiosk compositor. There is no release pipeline and no Ansible: a box
identifies itself, pulls its page and its display configuration from Chronos, so
changing what a box shows is a server-side change and a box only ever needs a
reflash when this image changes.

## What is in here

| Path | Purpose |
| --- | --- |
| `build.ts` | TUI build tool: options, build, verification, flash. Replaces `build.sh`. |
| `options.ts` | `BuildOptions`: the option set, its defaults and its validation. |
| `tui.ts` | Zero-dependency terminal UI (raw-mode keys, ANSI block renderer). |
| `config.ts` | `BuildOptions` → `alpine-make-vm-image` flags and generated files. |
| `flash.ts` | Disk enumeration, `dd` planning and the guarded write. |
| `packages` | Packages installed into the image. |
| `repositories` | Pinned Alpine branch repositories (`cage` is in `community`). |
| `setup.sh` | Runs **chrooted inside the image**: kiosk user, service enablement, timezone, `/etc/fstab`. |
| `skel/` | Files copied into the image root before `setup.sh` runs. |
| `skel/etc/udhcpc/udhcpc.conf` | Points DHCP's resolver file at tmpfs (`/etc` is read-only). |

`build.ts` is TypeScript on the Bun runtime (the repo already runs `bun run`
scripts this way), with **no added dependencies**: under `sudo` there is no
`node_modules` to read, so `tui.ts` renders with ANSI escapes and
`node:readline`'s keypress events directly.

## Build

Prerequisites (all on the build host, not in the image):

- root, or `sudo` (the tool loop-mounts the image and chroots into it)
- `qemu-img`, `qemu-nbd` (qemu-utils)
- `rsync`, `sha1sum`, `curl`
- `sfdisk`, `e2fsprogs`, `util-linux` (loop devices must be available)

```sh
sudo bun apps/kiosk/image/build.ts          # interactive
sudo bun apps/kiosk/image/build.ts --dry-run # print the plan, touch nothing
```

`sudo bun`, not `sudo bunx`: root has no `bun` on `PATH` here, so run it through
an absolute Bun or keep the same shell that has `bun`.

### Options

The TUI's defaults reproduce the previous hardcoded build exactly, so a run that
changes nothing produces the same image. Everything it asks for:

| Option | Effect |
| --- | --- |
| Architecture | `--arch`: x86_64, aarch64, x86, armv7, riscv64 |
| Boot mode | BIOS (whole-disk syslinux) or UEFI (forces GPT + 128M ESP) |
| Alpine branch | `--branch` |
| Kernel flavor | `--kernel-flavor`: lts or virt |
| Serial console | `--serial-console`; off hides the boot log entirely |
| Display orientation | Transform applied by kanshi (see below) |
| Preferred resolution | kanshi `mode`, or the panel's own preferred mode |
| Display scale | kanshi `scale` |
| Image format | raw for `dd`/Ventoy, qcow2/vmdk/vdi for a virtual disk |
| Image size | `--image-size` |
| GPT partition table | Only meaningful with UEFI, which always partitions |
| Timezone | `/etc/localtime` and `/etc/timezone` in the image |
| Hostname | `/etc/hostname` |
| Extra packages | Appended to `packages` |
| SPA origin | Written to `/etc/kiosk/url` |

Invalid combinations are refused before any root command runs — a stray value
must never become a half-written 2 GB image.

### Display configuration

Cage has no rotation flag (its man page offers only `-m last|extend`), so
orientation is applied with [kanshi](https://wayland.emersion.fr/kanshi/)
through the `wlr-output-management` protocol. Choosing any non-default
orientation, resolution or scale adds `kanshi` and `wlr-randr` to the image and
generates three files into `skel/`:

- `skel/etc/kiosk/kanshi/config` — `output * transform 90 [mode MxN] [scale S]`,
  wildcarded because a box has no console to name its output.
- `skel/etc/init.d/kanshi` — an OpenRC service. **Alpine's kanshi package ships
  no init script**, so this is generated: it runs kanshi as the `kiosk` user
  (the protocol needs the same seat cage takes) and is ordered `before kiosk`, so
  the transform is applied before cage claims the outputs.
- `build.env` — the `KEY=value` file `setup.sh` reads, bind-mounted at `/mnt`.

Because the settings are compiled into the image, a deployed box needs a reflash
for its display to change — the same rule the image already followed.

## Flash

After a successful build the tool offers to write `kiosk.img` straight to a disk.
Refusal is the default there, not the confirmation:

- Only non-virtual devices are listed at all (`loop`, `ram`, `zram`, `dm-`, `md`,
  `nbd`, `sr`, `fd` can never be a target).
- A device is blocked when anything under it is mounted — a mount on
  `nvme0n1p2` blocks flashing `nvme0n1` — found by walking lsblk's partition
  tree *and* `/proc/self/mountinfo`, which is what catches dm-crypt mappings.
- Zero-size and sub-1 GB devices are blocked.
- Flashing asks you to type the device path: a stray keypress cannot reach `dd`.
- `dd` runs with `bs=4M status=progress conv=fsync oflag=direct`, so a power cut
  cannot leave a silently truncated image.

Manual flashing still works:

```sh
sudo dd if=apps/kiosk/image/kiosk.img of=/dev/sdX bs=4M status=progress conv=fsync
```

Or drop `kiosk.img` onto a Ventoy USB stick. The image is a raw, unpartitioned
ext4 filesystem with a Syslinux BIOS boot sector; the disk is 2 GB, of which
the packages use roughly 700 MB (chromium dominates).

Boot chain: `seatd` (seat for DRM/input) → `chronyd` (clock) → `kiosk`
(`cage -- /usr/local/bin/kiosk-browser`, supervised by OpenRC's
`supervise-daemon`, so a crashed Chromium is restarted without a reboot).
`eth0` comes up over DHCP (`skel/etc/network/interfaces`) — a box has no shell
to configure a static address in. A build that selected display configuration
inserts `kanshi` before `kiosk`.

## Enroll a box

1. Boot the box with its display and keyboard attached. With no kiosk row for
   its machine id the SPA shows the enrolment screen, which prints the machine
   id in large monospace text (DMI product UUID, or the first non-loopback MAC
   address where the board's UUID is empty).
2. In Iris, add the box under **Admin → Kiosks** with that machine id, a `kind`
   (`tv` or `navigator`) and the matching configuration (departure groups for
   `tv`; idle reset and start location for `navigator`).
3. The enrolment screen keeps polling the heartbeat, so the box starts showing
   its page within a few seconds — no reboot. Disabling the row in Iris makes
   the box show a "disabled" screen the same way.

## Customise

- **Point a box somewhere else**: edit `/etc/kiosk/url` on the box, or answer
  the SPA-origin prompt differently next time you build.
- **The API origin is compiled in**, not derived from `/etc/kiosk/url`: the box
  serves only static files, so nothing proxies `/api`. A production build calls
  `https://filc.petrik.hu/api` (dev calls `http://localhost:3001/api`), and a box
  pointed at another Chronos needs `VITE_API_BASE_URL` at build time. Because
  that makes every API call cross-origin, the SPA's own origin
  (`https://kiosk.filc.petrik.hu`) has to be listed in the Chronos
  `CHRONOS_TRUSTED_ORIGINS`.
- **Change what a box shows**: change the kiosk row's config in Iris. Page
  changes are a deploy of the `apps/kiosk` image and reach every box on reload.
- **Fix the clock**: `chronyd` is enabled at `default` and steps the clock at
  boot (`makestep 1.0 3`), because a box that lost power must not show
  yesterday's timetable.

## Notes and deliberate deviations

- `setup.sh` keeps the `/etc/fstab` root entry that `alpine-make-vm-image`
  generated (it carries the filesystem UUID the Syslinux config boots with) and
  only rewrites its options to `ro,noatime`, then appends the tmpfs mounts from
  `skel/etc/kiosk/fstab.tmpfs`. Shipping a whole `/etc/fstab` in `skel/` would
  have replaced that generated line with a hardcoded device name.
  OpenRC's `root` service remounts `/` read-write only when fstab does not say
  `ro`, so the rootfs stays read-only for the life of the box.
- The launcher runs Chromium on **X11** (`--ozone-platform=x11`) even though
  cage is a Wayland compositor: kiosk mode does not hide Chromium's own UI under
  Wayland in the Chromium this image ships (152), so the box showed a tab strip
  and an omnibox over the page. Through the Xwayland cage starts anyway, the
  window is chromeless and fills the screen; cage exports `DISPLAY`, so nothing
  has to set it.
- Software GL is selected through ANGLE (`--use-angle=swiftshader` plus
  `--enable-unsafe-swiftshader`), which is what this Chromium accepts:
  `--use-gl=swiftshader` and the `--disable-session-crashed-bubble` /
  `--disable-translate` flags from the old Debian image no longer exist in it.
  If a box renders WebGL fine on its own GPU, dropping the pair is a change to
  this image only.
- The timezone is set to `Europe/Budapest` at build time: the kiosk pages render
  lesson, substitution and departure times in local time.
- Everything writable lives on tmpfs (`/tmp`, `/var/log`, `/var/tmp`,
  `/home/kiosk`), including the Chromium profile (`/tmp/kiosk/chromium`), so a
  power cut cannot corrupt anything.
- `/etc/chrony/chrony.conf` keeps the drift file on `/var/tmp` because `/` is
  read-only.
- `/etc/resolv.conf` is a symlink to `/run/resolv.conf` **and**
  `skel/etc/udhcpc/udhcpc.conf` moves busybox's `RESOLV_CONF` there: the udhcpc
  script writes `<file>.<pid>` next to its target and renames it, so a target
  inside the read-only `/etc` can never be written and the box would boot with
  no resolver at all. `/var/lib/seedrng` is tmpfs for the same reason —
  otherwise busybox `seedrng` ends the boot with a failure. Neither file can
  outlive a power cut either way.
- The `kiosk` service exports `WLR_LIBINPUT_NO_DEVICES=1`: wlroots refuses to
  start when the seat has no input device, and `cage` then dies with it, which
  leaves the box on the `getty` prompt from Alpine's `/etc/inittab`. A TV box
  with no keyboard attached has to keep rendering, so the session starts
  without input instead.

## Troubleshooting

- Boot logs go to the serial console (`--serial-console` is passed to the build
  tool):
  `qemu-system-x86_64 -m 2048 -drive file=kiosk.img,format=raw -nic user,model=virtio -display none -vga none -device virtio-gpu-pci -vnc :1`.
  `virtio-gpu-pci` is what gives cage a DRM device; with none at all cage cannot
  start (a QEMU limitation, not a box problem) and the box shows the `getty`
  prompt from `/etc/inittab`.
- The browser session log is `/var/log/kiosk.log` (tmpfs — read it before
  rebooting).
- If Chromium exits immediately with a sandbox error, the kiosk user cannot use
  the setuid sandbox in this kernel configuration; add `--no-sandbox` to
  `skel/usr/local/bin/kiosk-browser` as a last resort and rebuild.
