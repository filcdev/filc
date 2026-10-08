import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type ScryptOptions,
  scrypt,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_BYTE_LENGTH = 16;
const IV_BYTE_LENGTH = 12;
const KEY_BYTE_LENGTH = 32;
const SALT_BYTE_LENGTH = 32;

/**
 * `scryptSync` blocks the event loop for ~100 ms per call, and this runs on the
 * RADIUS hot path, so every derivation goes through the async form.
 */
const scryptAsync = (
  password: Buffer | string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> => {
  const { promise, resolve, reject } = Promise.withResolvers<Buffer>();
  scrypt(password, salt, keylen, options, (error, derivedKey) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(derivedKey);
  });
  return promise;
};

const SCRYPT_OPTIONS = {
  N: 16_384, // Cost parameter (CPU/memory cost)
  p: 1, // Parallelization
  r: 8, // Block size
};

export const getSalt = (): Buffer => randomBytes(SALT_BYTE_LENGTH);

export const getKeyFromPassword = async (
  password: Buffer | string,
  salt: Buffer
): Promise<Buffer> =>
  (await scryptAsync(
    password,
    salt,
    KEY_BYTE_LENGTH,
    SCRYPT_OPTIONS
  )) as Buffer;

export const getUserEncryptionKey = async (
  username: string,
  secret: string,
  salt: Buffer
): Promise<{ key: Buffer; passwordBuffer: Buffer }> => {
  const passwordBuffer = Buffer.from(`${username}-${secret}`, 'utf8');
  return {
    key: await getKeyFromPassword(passwordBuffer, salt),
    passwordBuffer,
  };
};

export const encrypt = (message: Buffer, key: Buffer): Buffer => {
  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_BYTE_LENGTH,
  });

  const encrypted = Buffer.concat([cipher.update(message), cipher.final()]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]);
};

export const decrypt = (ciphertext: Buffer, key: Buffer): Buffer => {
  if (ciphertext.length < IV_BYTE_LENGTH + AUTH_TAG_BYTE_LENGTH) {
    throw new Error('Ciphertext is too short to be valid');
  }

  const iv = ciphertext.subarray(0, IV_BYTE_LENGTH);
  const authTag = ciphertext.subarray(-AUTH_TAG_BYTE_LENGTH);
  const encrypted = ciphertext.subarray(IV_BYTE_LENGTH, -AUTH_TAG_BYTE_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_BYTE_LENGTH,
  });

  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
};

export const encryptPassword = async (
  password: string,
  username: string,
  secret: string,
  salt = getSalt()
): Promise<{ encryptedPassword: string; salt: string }> => {
  const { key, passwordBuffer } = await getUserEncryptionKey(
    username,
    secret,
    salt
  );

  const plaintextBuffer = Buffer.from(password, 'utf8');
  const encrypted = encrypt(plaintextBuffer, key);

  // Cleanup buffers
  passwordBuffer.fill(0);
  key.fill(0);
  plaintextBuffer.fill(0);

  return {
    encryptedPassword: encrypted.toString('hex'),
    salt: salt.toString('hex'),
  };
};

export const decryptPassword = async (
  encryptedPassword: string,
  username: string,
  secret: string,
  salt: string
): Promise<string> => {
  const encrypted = Buffer.from(encryptedPassword, 'hex');
  const saltBuffer = Buffer.from(salt, 'hex');

  const { key, passwordBuffer } = await getUserEncryptionKey(
    username,
    secret,
    saltBuffer
  );

  const decryptedBuffer = decrypt(encrypted, key);
  const result = decryptedBuffer.toString('utf8');

  // Cleanup buffers.
  passwordBuffer.fill(0);
  key.fill(0);
  saltBuffer.fill(0);
  encrypted.fill(0);
  decryptedBuffer.fill(0);

  return result;
};
