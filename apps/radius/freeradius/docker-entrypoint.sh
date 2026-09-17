#!/bin/sh
set -e

PATH=/opt/sbin:/opt/bin:$PATH
export PATH

# Make configs read only for security
chmod o-w /opt/etc/raddb/clients.conf
chmod o-w /opt/etc/raddb/sites-available/default
chmod o-w /opt/etc/raddb/sites-available/inner-tunnel

# Enable inner-eap module
chmod o-w /opt/etc/raddb/mods-available/eap
chmod o-w /opt/etc/raddb/mods-available/inner-eap
ln -s /opt/etc/raddb/mods-available/inner-eap /opt/etc/raddb/mods-enabled/inner-eap || true

# Enable rest module to connect to Chronos backend
chmod o-w /opt/etc/raddb/mods-available/rest
rm -f /opt/etc/raddb/mods-enabled/rest || true
sed "s/SECRET_HERE/$FREERADIUS_SHARED_SECRET/g" /opt/etc/raddb/mods-available/rest > /opt/etc/raddb/mods-enabled/rest

# Secure certs
chmod o-w /opt/etc/raddb/certs
chmod o-w /opt/etc/raddb/certs/*.pem || true
chmod o-w /opt/etc/raddb/certs/*.key || true
chmod o-w /opt/etc/raddb/certs/*.p12 || true
chmod o-w /opt/etc/raddb/certs/*.crt || true
chmod o-w /opt/etc/raddb/certs/*.csr || true
chmod o-w /opt/etc/raddb/certs/dh || true

# Remove unused modules if exist
rm /opt/etc/raddb/mods-enabled/files || true

# Configure eapol_test template
if [ -f /eapol_test.conf.template ]; then
  sed "s/IDHERE/$RADTEST_USER/g" /eapol_test.conf.template | sed -e "s/PASSHERE/$RADTEST_PASS/g" > /eapol_test.conf
fi

apk update
apk add wpa_supplicant tzdata

if [ "$#" -eq 0 ] || [ "${1#-}" != "$1" ]; then
    set -- radiusd "$@"
fi

if [ "$1" = 'radiusd' ] || [ "$1" = 'freeradius' ]; then
    shift
    exec radiusd -f "$@"
fi

exec "$@"
