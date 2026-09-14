#!/bin/sh
# Builds the filc kiosk disk image: Alpine with a read-only rootfs that boots
# straight into the kiosk SPA under cage + Chromium.
#
# Usage: sudo apps/kiosk/image/build.sh
#
# Prerequisites are listed in image/README.md (root, qemu-img, qemu-nbd, rsync,
# loop devices) — everything else is installed into the image by the build tool.
set -eu

# alpine-make-vm-image, verified against the sha1 published in its README
# (https://github.com/alpinelinux/alpine-make-vm-image). Run
# `./alpine-make-vm-image --help` if you bump this: the flags below are the
# whole interface this script uses.
readonly TOOL_VERSION='0.13.4'
readonly TOOL_SHA1='33b338dc0d2ce67a8dd4f1701862f051aed565f1'
readonly TOOL_URI="https://raw.githubusercontent.com/alpinelinux/alpine-make-vm-image/v$TOOL_VERSION/alpine-make-vm-image"

# Current Alpine stable (https://alpinelinux.org/releases/). Pinned, together
# with the repositories file, so a rebuild cannot silently jump branches — and
# because `cage` only exists in community.
readonly ALPINE_BRANCH='v3.24'

readonly IMAGE='kiosk.img'
# chromium + cage + mesa-dri-gallium do not fit in a small image: at 1G apk is
# still a few megabytes short and fails with "No space left on device" while
# unpacking chromium, so this is the build tool's own default size.
readonly IMAGE_SIZE='2G'

cd "$(dirname "$0")"

if [ "$(id -u)" -ne 0 ]; then
    echo 'This script needs root: it loop-mounts the image and chroots into it.' >&2
    exit 1
fi

for tool in curl qemu-img qemu-nbd rsync sha1sum; do
    if ! command -v "$tool" >/dev/null; then
        echo "Missing build dependency: $tool (see image/README.md)" >&2
        exit 1
    fi
done

# The build tool formats its target in place, so never point it at a device and
# always start from a fresh file.
if [ -b "$IMAGE" ]; then
    echo "$IMAGE is a block device; refusing to build over it." >&2
    exit 1
fi
rm -f "$IMAGE"

workdir=$(mktemp -d)
mount_dir=''
cleanup() {
    if [ -n "$mount_dir" ]; then
        umount "$mount_dir" 2>/dev/null || true
        rmdir "$mount_dir" 2>/dev/null || true
    fi
    rm -rf "$workdir"
}
trap cleanup EXIT

echo "Fetching alpine-make-vm-image $TOOL_VERSION"
curl -fsSL -o "$workdir/alpine-make-vm-image" "$TOOL_URI"
printf '%s  %s\n' "$TOOL_SHA1" "$workdir/alpine-make-vm-image" | sha1sum -c - >/dev/null
chmod +x "$workdir/alpine-make-vm-image"

packages=$(sed -e 's/#.*//' packages | tr '\n' ' ')

# The image path and the setup script are positional; --script-chroot runs
# setup.sh chrooted inside the image with its own directory bind-mounted at
# /mnt, so every path in setup.sh is an image path.
#
# --fs-skel-chown: without it the copy keeps the builder's numeric uid, and
# every file in skel/ lands in the image owned by whoever ran this script.
"$workdir/alpine-make-vm-image" \
    --arch x86_64 \
    --branch "$ALPINE_BRANCH" \
    --image-format raw \
    --image-size "$IMAGE_SIZE" \
    --kernel-flavor lts \
    --boot-mode BIOS \
    --serial-console \
    --packages "$packages" \
    --repositories-file repositories \
    --fs-skel-dir skel \
    --fs-skel-chown root:root \
    --script-chroot \
    "$IMAGE" setup.sh

# The build tool does not fail when apk runs out of space, so verify the image
# really carries a kiosk before calling the build a success.
mount_dir=$(mktemp -d)
mount -o loop,ro "$IMAGE" "$mount_dir"

for file in /etc/init.d/kiosk /etc/kiosk/url /usr/local/bin/kiosk-browser \
    /usr/bin/cage /usr/bin/chromium /etc/udhcpc/udhcpc.conf; do
    if [ ! -e "$mount_dir$file" ]; then
        echo "built image is missing $file" >&2
        exit 1
    fi
done

if ! grep -Eq \
    '^UUID=[^[:space:]]+[[:space:]]+/[[:space:]]+[^[:space:]]+[[:space:]]+ro,noatime' \
    "$mount_dir/etc/fstab"; then
    echo 'root is not mounted read-only in the image /etc/fstab' >&2
    exit 1
fi

umount "$mount_dir"
rmdir "$mount_dir"
mount_dir=''

ls -lh "$IMAGE"
echo "Flash it with: dd if=$IMAGE of=/dev/sdX bs=4M status=progress"
