import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  createGraphTransport,
  type GraphConfig,
  GraphMailError,
} from './graph';

type FetchCall = {
  body: string | undefined;
  headers: Headers;
  signal: AbortSignal | null | undefined;
  url: string;
};

const config: GraphConfig = {
  entra: {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    tenantId: 'tenant-id',
  },
  from: '"Filc" <noreply@filc.hu>',
  mailbox: 'school@example.com',
};

const message = {
  headers: { 'List-Unsubscribe': '<https://filc.hu/unsubscribe?token=abc>' },
  html: '<p>hello html</p>',
  subject: 'Test subject',
  text: 'hello text',
  to: 'user@example.com',
};

const tokenResponse = (token = 'token-1'): Response =>
  Response.json({ access_token: token, expires_in: 3600 });

const isTokenCall = (call: FetchCall): boolean =>
  call.url.includes('/oauth2/v2.0/token');

describe('createGraphTransport', () => {
  const originalFetch = globalThis.fetch;
  let calls: FetchCall[] = [];

  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const stubFetch = (respond: (call: FetchCall) => Response): void => {
    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const call = {
        body:
          init?.body === undefined || init.body === null
            ? undefined
            : String(init.body),
        headers: new Headers(init?.headers),
        signal: init?.signal,
        url,
      };
      calls.push(call);
      // Inside a promise so a throwing stub rejects like a real fetch.
      return Promise.resolve().then(() => respond(call));
    }) as typeof fetch;
  };

  const sendCalls = (): FetchCall[] =>
    calls.filter((call) => !isTokenCall(call));

  const decodeMime = (call: FetchCall | undefined): string =>
    Buffer.from(call?.body ?? '', 'base64').toString('utf8');

  const sendAndCatch = async (): Promise<unknown> =>
    createGraphTransport(config)
      .send(message)
      .catch((thrown: unknown) => thrown);

  test('posts base64 MIME for the encoded mailbox', async () => {
    stubFetch((call) =>
      isTokenCall(call) ? tokenResponse() : new Response(null, { status: 202 })
    );

    await createGraphTransport(config).send(message);

    const [sendCall] = sendCalls();
    expect(sendCall?.url).toBe(
      'https://graph.microsoft.com/v1.0/users/school%40example.com/sendMail'
    );
    expect(sendCall?.headers.get('content-type')).toBe('text/plain');
    expect(sendCall?.headers.get('authorization')).toBe('Bearer token-1');

    const mime = decodeMime(sendCall);
    expect(mime).toContain('From: Filc <noreply@filc.hu>');
    expect(mime).toContain('To: user@example.com');
    expect(mime).toContain('Subject: Test subject');
    expect(mime).toContain('hello text');
    expect(mime).toContain('hello html');
    expect(mime).toContain(
      'List-Unsubscribe: <https://filc.hu/unsubscribe?token=abc>'
    );
  });

  test('gives the token and sendMail requests a timeout signal', async () => {
    stubFetch((call) =>
      isTokenCall(call) ? tokenResponse() : new Response(null, { status: 202 })
    );

    await createGraphTransport(config).send(message);

    expect(calls.find(isTokenCall)?.signal).toBeInstanceOf(AbortSignal);
    expect(sendCalls()[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  test('encodes a Hungarian subject and body as UTF-8 MIME', async () => {
    stubFetch((call) =>
      isTokenCall(call) ? tokenResponse() : new Response(null, { status: 202 })
    );

    await createGraphTransport(config).send({
      html: '<p>Kedves Minta Felhasználó, a holnapi óra elmarad.</p>',
      subject: 'Helyettesítés',
      text: 'Kedves Minta Felhasználó, a holnapi óra elmarad.',
      to: 'user@example.com',
    });

    const mime = decodeMime(sendCalls()[0]);
    expect(mime).toContain('Subject: =?UTF-8?Q?Helyettes=C3=ADt=C3=A9s?=');
    expect(mime).toContain('Content-Type: text/plain; charset=utf-8');
    expect(mime).toContain('multipart/alternative');
  });

  test('reuses the cached token across sends', async () => {
    stubFetch((call) =>
      isTokenCall(call) ? tokenResponse() : new Response(null, { status: 202 })
    );

    const transport = createGraphTransport(config);
    await transport.send(message);
    await transport.send(message);

    expect(calls.filter(isTokenCall)).toHaveLength(1);
    expect(sendCalls()).toHaveLength(2);
  });

  test('mints a new token and retries once on a 401', async () => {
    let sends = 0;
    stubFetch((call) => {
      if (isTokenCall(call)) {
        return tokenResponse();
      }
      sends += 1;
      return new Response(null, { status: sends === 1 ? 401 : 202 });
    });

    await createGraphTransport(config).send(message);

    expect(calls.filter(isTokenCall)).toHaveLength(2);
    expect(sends).toBe(2);
  });

  test('retries a 401 with the freshly minted token', async () => {
    let mints = 0;
    let sends = 0;
    stubFetch((call) => {
      if (isTokenCall(call)) {
        mints += 1;
        return tokenResponse(`token-${mints}`);
      }
      sends += 1;
      return new Response(null, { status: sends === 1 ? 401 : 202 });
    });

    await createGraphTransport(config).send(message);

    const [first, second] = sendCalls();
    expect(first?.headers.get('authorization')).toBe('Bearer token-1');
    expect(second?.headers.get('authorization')).toBe('Bearer token-2');
  });

  test('surfaces a 401 when the retry is rejected too', async () => {
    let sends = 0;
    stubFetch((call) => {
      if (isTokenCall(call)) {
        return tokenResponse();
      }
      sends += 1;
      return new Response(null, { status: 401 });
    });

    const error = await sendAndCatch();

    expect(error).toBeInstanceOf(GraphMailError);
    expect((error as GraphMailError).status).toBe(401);
    expect(sends).toBe(2);
  });

  test('reports Retry-After on a 429', async () => {
    stubFetch((call) =>
      isTokenCall(call)
        ? tokenResponse()
        : new Response('', {
            headers: { 'retry-after': '2' },
            status: 429,
          })
    );

    const error = await sendAndCatch();

    expect(error).toBeInstanceOf(GraphMailError);
    expect((error as GraphMailError).retryAfterMs).toBe(2000);
    expect((error as GraphMailError).status).toBe(429);
    // A retry belongs to the queue, which honours Retry-After; sendMail itself
    // must not hammer a throttled mailbox with an immediate second attempt.
    expect(sendCalls()).toHaveLength(1);
  });

  test('falls back to 1000 ms when Retry-After is absent', async () => {
    stubFetch((call) =>
      isTokenCall(call) ? tokenResponse() : new Response('', { status: 429 })
    );

    const error = await sendAndCatch();

    expect((error as GraphMailError).retryAfterMs).toBe(1000);
  });

  test('accepts a zero Retry-After', async () => {
    stubFetch((call) =>
      isTokenCall(call)
        ? tokenResponse()
        : new Response('', { headers: { 'retry-after': '0' }, status: 429 })
    );

    const error = await sendAndCatch();

    expect((error as GraphMailError).retryAfterMs).toBe(0);
  });

  test('parses the HTTP-date form of Retry-After', async () => {
    // 30 s ahead: far enough that a slow machine cannot shrink the parsed
    // delta into the fallback's 1000 ms, and the assertion allows clock slack
    // rather than holding the header to a ceiling.
    const retryAt = new Date(Date.now() + 30_000).toUTCString();
    stubFetch((call) =>
      isTokenCall(call)
        ? tokenResponse()
        : new Response('', {
            headers: { 'retry-after': retryAt },
            status: 429,
          })
    );

    const error = await sendAndCatch();
    const retryAfterMs = (error as GraphMailError).retryAfterMs ?? -1;

    expect(retryAfterMs).toBeGreaterThanOrEqual(25_000);
    expect(retryAfterMs).toBeLessThanOrEqual(35_000);
  });

  test('honours a Retry-After longer than a minute', async () => {
    stubFetch((call) =>
      isTokenCall(call)
        ? tokenResponse()
        : new Response('', { headers: { 'retry-after': '300' }, status: 429 })
    );

    const error = await sendAndCatch();

    // Graph asks for 5 minutes; resending before then only earns another 429.
    expect((error as GraphMailError).retryAfterMs).toBe(300_000);
  });

  test('honours an HTTP-date Retry-After beyond a minute', async () => {
    const retryAt = new Date(Date.now() + 120_000).toUTCString();
    stubFetch((call) =>
      isTokenCall(call)
        ? tokenResponse()
        : new Response('', {
            headers: { 'retry-after': retryAt },
            status: 429,
          })
    );

    const error = await sendAndCatch();
    const retryAfterMs = (error as GraphMailError).retryAfterMs ?? -1;

    expect(retryAfterMs).toBeGreaterThan(110_000);
  });

  test("surfaces Graph's error code on a 403", async () => {
    stubFetch((call) =>
      isTokenCall(call)
        ? tokenResponse()
        : new Response(
            JSON.stringify({
              error: {
                code: 'ErrorSendAsDenied',
                message: 'The user does not have SendAs permission.',
              },
            }),
            { headers: { 'content-type': 'application/json' }, status: 403 }
          )
    );

    const error = await sendAndCatch();

    expect(error).toBeInstanceOf(GraphMailError);
    expect((error as GraphMailError).message).toContain('ErrorSendAsDenied');
    expect((error as GraphMailError).message).toContain('SendAs permission');
    expect((error as GraphMailError).status).toBe(403);
    // Only a 401 is worth a second attempt: the token is not the problem here.
    expect(sendCalls()).toHaveLength(1);
  });

  test('reports the status when the error body is not JSON', async () => {
    stubFetch((call) =>
      isTokenCall(call)
        ? tokenResponse()
        : new Response('<html>Bad gateway</html>', {
            headers: { 'content-type': 'text/html' },
            status: 502,
          })
    );

    const error = await sendAndCatch();

    expect(error).toBeInstanceOf(GraphMailError);
    expect((error as GraphMailError).status).toBe(502);
    expect((error as GraphMailError).message).toContain('502');
    expect(sendCalls()).toHaveLength(1);
  });

  test('does not reuse a token that expires inside the skew window', async () => {
    // 30 s of life is inside the 60 s skew, so the first send's token is already
    // treated as stale for the second send.
    stubFetch((call) =>
      isTokenCall(call)
        ? Response.json({ access_token: 'token-1', expires_in: 30 })
        : new Response(null, { status: 202 })
    );

    const transport = createGraphTransport(config);
    await transport.send(message);
    await transport.send(message);

    expect(calls.filter(isTokenCall)).toHaveLength(2);
    expect(sendCalls()).toHaveLength(2);
  });

  test('shares one in-flight mint between concurrent sends', async () => {
    stubFetch((call) =>
      isTokenCall(call) ? tokenResponse() : new Response(null, { status: 202 })
    );

    const transport = createGraphTransport(config);
    await Promise.all([transport.send(message), transport.send(message)]);

    expect(calls.filter(isTokenCall)).toHaveLength(1);
    expect(sendCalls()).toHaveLength(2);
  });

  test('mints again after a failed mint instead of caching the failure', async () => {
    let mintAttempts = 0;
    stubFetch((call) => {
      if (!isTokenCall(call)) {
        return new Response(null, { status: 202 });
      }
      mintAttempts += 1;
      if (mintAttempts === 1) {
        throw new Error('token endpoint unreachable');
      }
      return tokenResponse();
    });

    const transport = createGraphTransport(config);
    const first = await transport.send(message).catch((e: unknown) => e);
    expect(first).toBeInstanceOf(Error);

    await transport.send(message);

    expect(mintAttempts).toBe(2);
    expect(sendCalls()).toHaveLength(1);
  });

  test('reports a transport-level failure with status 0', async () => {
    stubFetch((call) => {
      if (isTokenCall(call)) {
        return tokenResponse();
      }
      throw new TypeError('fetch failed');
    });

    const error = await sendAndCatch();

    expect(error).toBeInstanceOf(GraphMailError);
    expect((error as GraphMailError).status).toBe(0);
    expect((error as GraphMailError).message).toContain('fetch failed');
  });

  test('gives the retry its own abort signal', async () => {
    let sends = 0;
    stubFetch((call) => {
      if (isTokenCall(call)) {
        return tokenResponse();
      }
      sends += 1;
      return new Response(null, { status: sends === 1 ? 401 : 202 });
    });

    await createGraphTransport(config).send(message);

    const [first, retry] = sendCalls();
    expect(first?.signal).toBeInstanceOf(AbortSignal);
    expect(retry?.signal).toBeInstanceOf(AbortSignal);
    // A shared signal would already be counting down the first attempt's 30 s.
    expect(first?.signal).not.toBe(retry?.signal);
  });

  test('requests the Graph scope for its token', async () => {
    stubFetch((call) =>
      isTokenCall(call) ? tokenResponse() : new Response(null, { status: 202 })
    );

    await createGraphTransport(config).send(message);

    const tokenCall = calls.find(isTokenCall);
    expect(new URLSearchParams(tokenCall?.body).get('scope')).toBe(
      'https://graph.microsoft.com/.default'
    );
  });

  test('refuses a header carrying CR or LF', async () => {
    stubFetch((call) =>
      isTokenCall(call) ? tokenResponse() : new Response(null, { status: 202 })
    );

    const error = (await createGraphTransport(config)
      .send({
        ...message,
        headers: {
          'List-Unsubscribe': '<https://filc.hu/u>\r\nBcc: evil@x.test',
        },
      })
      .catch((thrown: unknown) => thrown)) as Error;

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('CR or LF');
    // Rejected before anything reaches the network.
    expect(calls).toHaveLength(0);
  });

  test('refuses a message whose encoded MIME is over Graph’s request limit', async () => {
    stubFetch((call) =>
      isTokenCall(call) ? tokenResponse() : new Response(null, { status: 202 })
    );

    const error = (await createGraphTransport(config)
      .send({
        ...message,
        // base64 inflates by 4/3, so this compiles past the 4 MiB ceiling.
        html: `<p>${'x'.repeat(3_300_000)}</p>`,
      })
      .catch((thrown: unknown) => thrown)) as Error;

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('over Graph');
    expect(calls).toHaveLength(0);
  });
});
