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
| `build.sh` | Downloads and verifies `alpine-make-vm-image`, then builds `kiosk.img`. |
| `packages` | Packages installed into the image. |
| `repositories` | Pinned Alpine branch repositories (`cage` is in `community`). |
| `setup.sh` | Runs **chrooted inside the image**: kiosk user, service enablement, timezone, `/etc/fstab`. |
| `skel/` | Files copied into the image root before `setup.sh` runs. |
| `skel/etc/kiosk/url` | The SPA origin. Edit this file to repoint a box. |

Boot chain: `seatd` (seat for DRM/input) → `chronyd` (clock) → `kiosk`
(`cage -- /usr/local/bin/kiosk-browser`, supervised by OpenRC's
`supervise-daemon`, so a crashed Chromium is restarted without a reboot).
`eth0` comes up over DHCP (`skel/etc/network/interfaces`) — a box has no shell
to configure a static address in.

## Build

Prerequisites (all on the build host, not in the image):

- root (the tool loop-mounts the image and chroots into it)
- `qemu-img`, `qemu-nbd` (qemu-utils)
- `rsync`, `sha1sum`, `curl`
- `sfdisk`, `e2fsprogs`, `util-linux` (loop devices must be available)

```sh
sudo apps/kiosk/image/build.sh        # writes apps/kiosk/image/kiosk.img
```

The script pins the Alpine branch (`v3.24` at the time of writing) and the
build tool (`alpine-make-vm-image` v0.13.4, sha1-verified). Bump both together
and re-check `./alpine-make-vm-image --help` when you do.

## Flash

```sh
sudo dd if=apps/kiosk/image/kiosk.img of=/dev/sdX bs=4M status=progress conv=fsync
```

Or drop `kiosk.img` onto a Ventoy USB stick. The image is a raw, unpartitioned
ext4 filesystem with a Syslinux BIOS boot sector; the disk is 2 GB, of which
the packages use roughly 700 MB (chromium dominates).

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

- **Point a box somewhere else**: edit `/etc/kiosk/url` on the box (or in
  `skel/etc/kiosk/url` before building).
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
- The launcher adds `--ozone-platform=wayland` to the flag set taken from the
  old Debian/Ansible image: cage is a Wayland compositor, whereas the old boxes
  ran Xorg, where Chromium selected X11 by itself.
- Chromium's SwiftShader flags (`--use-gl=swiftshader`,
  `--enable-unsafe-swiftshader`) are kept from the old image for the old
  integrated GPUs. If a box renders WebGL fine without them, dropping them is a
  change to this image only.
- The timezone is set to `Europe/Budapest` at build time: the kiosk pages render
  lesson, substitution and departure times in local time.
- Everything writable lives on tmpfs (`/tmp`, `/var/log`, `/var/tmp`,
  `/home/kiosk`), including the Chromium profile (`/tmp/kiosk/chromium`), so a
  power cut cannot corrupt anything.
- `/etc/chrony/chrony.conf` keeps the drift file on `/var/tmp` because `/` is
  read-only.

## Troubleshooting

- Boot logs go to the serial console (`--serial-console` is passed to the build
  tool): `qemu-system-x86_64 -m 2048 -drive file=kiosk.img,format=raw -nic user,model=virtio -display none -vnc :1`.
  Under QEMU there may be no DRM device for cage; that is a QEMU limitation, not
  a box problem.
- The browser session log is `/var/log/kiosk.log` (tmpfs — read it before
  rebooting).
- If Chromium exits immediately with a sandbox error, the kiosk user cannot use
  the setuid sandbox in this kernel configuration; add `--no-sandbox` to
  `skel/usr/local/bin/kiosk-browser` as a last resort and rebuild.
