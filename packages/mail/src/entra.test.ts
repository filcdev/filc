import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { fetchEntraAccessToken, GRAPH_SCOPE, OUTLOOK_SCOPE } from './entra';
import type { EntraCredentials } from './types';

type FetchCall = {
  body: URLSearchParams;
  headers: Headers;
  signal: AbortSignal | null | undefined;
  url: string;
};

const credentials: EntraCredentials = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tenantId: 'tenant-id',
};

describe('fetchEntraAccessToken', () => {
  const originalFetch = globalThis.fetch;
  let calls: FetchCall[] = [];

  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const stubFetch = (respond: () => Response): void => {
    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
      calls.push({
        body: new URLSearchParams(String(init?.body)),
        headers: new Headers(init?.headers),
        signal: init?.signal,
        url: String(input),
      });
      // Inside a promise so a throwing stub rejects like a real fetch.
      return Promise.resolve().then(() => respond());
    }) as typeof fetch;
  };

  test('reports the status and Entra error code of a JSON failure', async () => {
    stubFetch(() =>
      Response.json(
        {
          error: 'invalid_client',
          error_description: 'AADSTS7000215: Invalid client secret provided.',
        },
        { status: 401 }
      )
    );

    const error = (await fetchEntraAccessToken(credentials).catch(
      (thrown: unknown) => thrown
    )) as Error;

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(
      'Entra token request failed (401): invalid_client: AADSTS7000215: Invalid client secret provided.'
    );
  });

  test('reports the status when the failure body is not JSON', async () => {
    stubFetch(
      () =>
        new Response('<html>Bad gateway</html>', {
          headers: { 'content-type': 'text/html' },
          status: 502,
          statusText: 'Bad Gateway',
        })
    );

    const error = (await fetchEntraAccessToken(credentials).catch(
      (thrown: unknown) => thrown
    )) as Error;

    expect(error.message).toBe('Entra token request failed (502): Bad Gateway');
  });

  test('frames a 200 that carries no access_token', async () => {
    stubFetch(() => Response.json({ token_type: 'Bearer' }));

    const error = (await fetchEntraAccessToken(credentials).catch(
      (thrown: unknown) => thrown
    )) as Error;

    expect(error.message).toBe(
      'Entra token request failed (200): no access_token in the response'
    );
  });

  test('frames a 200 whose body is not JSON', async () => {
    stubFetch(() => new Response('not json', { status: 200 }));

    const error = (await fetchEntraAccessToken(credentials).catch(
      (thrown: unknown) => thrown
    )) as Error;

    expect(error.message).toBe(
      'Entra token request failed (200): no access_token in the response'
    );
  });

  test('coerces a string expires_in into an absolute expiry', async () => {
    stubFetch(() =>
      Response.json({ access_token: 'token-1', expires_in: '3600' })
    );

    const before = Date.now();
    const token = await fetchEntraAccessToken(credentials);

    expect(token.token).toBe('token-1');
    expect(token.expires).toBeGreaterThanOrEqual(before + 3_600_000);
    expect(token.expires).toBeLessThanOrEqual(Date.now() + 3_600_000);
  });

  test('keeps the token when expires_in is not a number', async () => {
    stubFetch(() =>
      Response.json({ access_token: 'token-1', expires_in: 'soon' })
    );

    const token = await fetchEntraAccessToken(credentials);

    expect(token.token).toBe('token-1');
    expect(token.expires).toBeUndefined();
  });

  test('URL-encodes the tenant id in the path', async () => {
    stubFetch(() => Response.json({ access_token: 'token-1' }));

    await fetchEntraAccessToken({
      ...credentials,
      tenantId: 'tenant/../with space',
    });

    expect(calls[0]?.url).toBe(
      'https://login.microsoftonline.com/tenant%2F..%2Fwith%20space/oauth2/v2.0/token'
    );
  });

  test('requests the Outlook scope by default (the SMTP XOAUTH2 path)', async () => {
    stubFetch(() => Response.json({ access_token: 'token-1' }));

    await fetchEntraAccessToken(credentials);

    expect(calls[0]?.body.get('scope')).toBe(OUTLOOK_SCOPE);
    expect(OUTLOOK_SCOPE).toBe('https://outlook.office365.com/.default');
  });

  test('requests the Graph scope when the caller asks for it', async () => {
    stubFetch(() => Response.json({ access_token: 'token-1' }));

    await fetchEntraAccessToken(credentials, GRAPH_SCOPE);

    expect(calls[0]?.body.get('scope')).toBe(GRAPH_SCOPE);
    expect(GRAPH_SCOPE).toBe('https://graph.microsoft.com/.default');
  });

  test('sends the client-credentials grant as a form body', async () => {
    stubFetch(() => Response.json({ access_token: 'token-1' }));

    await fetchEntraAccessToken(credentials);

    expect(calls[0]?.body.get('client_id')).toBe('client-id');
    expect(calls[0]?.body.get('client_secret')).toBe('client-secret');
    expect(calls[0]?.body.get('grant_type')).toBe('client_credentials');
  });

  test('gives the request a timeout signal', async () => {
    stubFetch(() => Response.json({ access_token: 'token-1' }));

    await fetchEntraAccessToken(credentials);

    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal);
  });
});
