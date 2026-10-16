const MAC_PATTERN = /^[0-9a-f]{12}$/;

export const canonicalizeMac = (value: string): string => {
  const mac = value
    .trim()
    .toLowerCase()
    .replaceAll(':', '')
    .replaceAll('-', '');
  if (!MAC_PATTERN.test(mac)) {
    throw new Error(`Invalid MAC address: ${value}`);
  }
  return mac;
};

export const formatMac = (value: string): string => {
  const mac = canonicalizeMac(value);
  return mac.match(/.{2}/g)?.join(':').toUpperCase() ?? mac;
};
