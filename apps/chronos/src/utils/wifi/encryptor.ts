import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_BYTE_LENGTH = 16;
const IV_BYTE_LENGTH = 12;
const KEY_BYTE_LENGTH = 32;
const SALT_BYTE_LENGTH = 32;

const SCRYPT_OPTIONS = {
  N: 16_384, // Cost parameter (CPU/memory cost)
  p: 1, // Parallelization
  r: 8, // Block size
};

export const getSalt = (): Buffer => randomBytes(SALT_BYTE_LENGTH);

export const getKeyFromPassword = (
  password: Buffer | string,
  salt: Buffer
): Buffer => scryptSync(password, salt, KEY_BYTE_LENGTH, SCRYPT_OPTIONS);

export const getUserEncryptionKey = (
  username: string,
  secret: string,
  salt: Buffer
): { key: Buffer; passwordBuffer: Buffer } => {
  const passwordBuffer = Buffer.from(`${username}-${secret}`, 'utf8');
  return {
    key: getKeyFromPassword(passwordBuffer, salt),
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
    throw new Error('Ciphertext is too short to be valid'); // Fixed abstraction leak
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

export const encryptPassword = (
  password: string,
  username: string,
  secret: string,
  salt = getSalt()
): { encryptedPassword: string; salt: string } => {
  const { key, passwordBuffer } = getUserEncryptionKey(username, secret, salt);

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

export const decryptPassword = (
  encryptedPassword: string,
  username: string,
  secret: string,
  salt: string
): string => {
  const encrypted = Buffer.from(encryptedPassword, 'hex');
  const saltBuffer = Buffer.from(salt, 'hex');

  const { key, passwordBuffer } = getUserEncryptionKey(
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
