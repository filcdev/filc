import { createRemoteJWKSet, jwtVerify } from 'jose';

/** Microsoft public cloud authority; the same default the Microsoft provider uses. */
const DEFAULT_AUTHORITY = 'https://login.microsoftonline.com';

/**
 * Entra ID tokens are signed with RS256 against the tenant's published JWKS. The token is
 * accepted for at most an hour, matching the provider's own limit.
 */
const TOKEN_ALGORITHM = 'RS256';
const DEFAULT_MAX_TOKEN_AGE = '1h';

export type EntraIdTokenVerifierOptions = {
  clientId: string;
  tenantId: string;
  authority?: string;
  maxTokenAge?: string;
};

/**
 * Verifies an ID token submitted by a client through
 * `signIn.social({ provider: 'microsoft', idToken })`.
 *
 * Better Auth's built-in Microsoft verifier resolves the signing key with
 * `importJWK(jwk, jwk.alg)`, but Entra's JWKS entries carry no `alg`, so jose throws
 * `"alg" argument is required when "jwk.alg" is not present` and the shared verifier reports
 * every ID token as invalid (`INVALID_TOKEN`). Verifying here passes the algorithm explicitly,
 * which lets jose select the key by `use`/`algorithms` instead of by the JWKS metadata.
 *
 * @see https://github.com/better-auth/better-auth/blob/main/packages/core/src/social-providers/microsoft-entra-id.ts
 */
export function createEntraIdTokenVerifier(
  options: EntraIdTokenVerifierOptions
) {
  const authority = options.authority ?? DEFAULT_AUTHORITY;
  const issuer = `${authority}/${options.tenantId}/v2.0`;
  // createRemoteJWKSet caches the key set and refetches it when Entra rotates keys.
  const signingKeys = createRemoteJWKSet(
    new URL(`${authority}/${options.tenantId}/discovery/v2.0/keys`)
  );

  return async (token: string, nonce?: string): Promise<boolean> => {
    try {
      const { payload } = await jwtVerify(token, signingKeys, {
        algorithms: [TOKEN_ALGORITHM],
        audience: options.clientId,
        issuer,
        maxTokenAge: options.maxTokenAge ?? DEFAULT_MAX_TOKEN_AGE,
      });

      return !nonce || payload.nonce === nonce;
    } catch {
      // Any failure (signature, audience, issuer, age, malformed token) is a rejection.
      return false;
    }
  };
}
