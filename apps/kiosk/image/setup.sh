#!/bin/sh
# Runs chrooted inside the image after the base system, the extra packages and
# the `skel` tree are in place (alpine-make-vm-image --script-chroot), so every
# path below is an image path.
set -eu

# The browser session runs as an unprivileged user. seatd admits members of the
# `seat` group to the seat cage needs; the others cover direct device access.
adduser -D -u 1000 -h /home/kiosk -s /bin/sh kiosk
for group in seat video input; do
    addgroup kiosk "$group"
done

# Boot order: udev/seatd provide the seat, chronyd fixes the clock (a box that
# just came back from a power cut must not show yesterday's timetable), kiosk
# starts the browser.
rc-update add seatd default
rc-update add chronyd default
rc-update add kiosk default

printf '%s\n' kiosk > /etc/hostname

# Times on the kiosk pages are local time; the image has no interactive setup.
ln -sf /usr/share/zoneinfo/Europe/Budapest /etc/localtime
printf '%s\n' 'Europe/Budapest' > /etc/timezone

# DHCP has to write the resolver config, and the rootfs is read-only: point it
# at tmpfs so busybox's udhcpc script can replace it on every boot.
ln -sf /run/resolv.conf /etc/resolv.conf

# alpine-make-vm-image generated /etc/fstab with the root entry (filesystem UUID
# + fs type) this image actually boots with, and the skel tree must not
# overwrite it — so keep that entry, make it read-only, and append the tmpfs
# mounts reviewed in skel/etc/kiosk/fstab.tmpfs. OpenRC's `root` service only
# remounts / read-write when fstab does not say otherwise, so this is what keeps
# the rootfs read-only for the life of the box.
root_uuid=$(sed -n 's#^UUID=\([^ \t]*\)[ \t]*/[ \t].*#\1#p' /etc/fstab)
root_fs=$(sed -n 's#^UUID=[^ \t]*[ \t]*/[ \t]*\([^ \t]*\).*#\1#p' /etc/fstab)
if [ -z "$root_uuid" ] || [ -z "$root_fs" ]; then
    echo 'setup.sh: no root filesystem entry found in /etc/fstab' >&2
    exit 1
fi
{
    printf '# <fs>\t\t\t<mountpoint>\t<type>\t<options>\t\t<dump/pass>\n'
    printf 'UUID=%s\t/\t\t%s\tro,noatime\t0 1\n' "$root_uuid" "$root_fs"
    cat /etc/kiosk/fstab.tmpfs
} > /etc/fstab

chmod 0755 /etc/init.d/kiosk /usr/local/bin/kiosk-browser
