import { getLogger } from '@logtape/logtape';

export type UnifiConfig = {
  baseUrl: string;
  insecureTls?: boolean;
  password: string;
  site?: string;
  username: string;
};

export type UnifiSpeedProfile = {
  _id: string;
  name: string;
  qos_rate_max_down?: number;
  qos_rate_max_up?: number;
};

type UnifiResponse<T> = { data?: T; meta?: { msg?: string; rc?: string } };

export type UnifiClientDevice = {
  _id: string;
  hostname?: string;
};

export type UnifiAccessDevice = {
  adopted: boolean;
  mac: string;
  name?: string;
  uptime: number;
};

export type UnifiWlanConf = {
  _id: string;
  name: string;
  usergroup_id?: string;
  enabled: boolean;
};

export class UnifiApiError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'UnifiApiError';
    this.code = code;
  }
}

const LOGIN_REQUIRED = 'UNIFI_LOGIN_REQUIRED';

const logger = getLogger(['chronos', 'wifi', 'unifi-api']);

/**
 * A UniFi endpoint answers `{ meta, data }`. `data` is missing when a proxy in
 * front of the controller (or a controller version change) reshapes the body,
 * and the array consumers below would then crash on `undefined` with a message
 * that names neither the endpoint nor the controller.
 */
const dataArray = <T>(data: T[] | undefined, context: string): T[] => {
  if (!data) {
    logger.error('UniFi {context} answered without a data array', { context });
    throw new UnifiApiError(
      `UniFi ${context} answered without a data array`,
      'api.err.NoData'
    );
  }
  return data;
};

/** A stalled controller must not pin a MAC in the enrichment debounce forever. */
const REQUEST_TIMEOUT_MS = 10_000;

export class UnifiClient {
  private readonly config: Required<UnifiConfig>;
  private cookies: string[] = [];
  private csrfToken: string | null = null;
  private isUnifiOS = false;
  private isInitialized = false;

  constructor(config: UnifiConfig) {
    this.config = { insecureTls: false, site: 'default', ...config };
  }

  /**
   * Per-request TLS bypass for a self-signed controller certificate. Bun
   * accepts `tls.rejectUnauthorized` on a fetch init, so this stays scoped to
   * this client instead of the process-wide `NODE_TLS_REJECT_UNAUTHORIZED=0`
   * the PR set.
   */
  private baseInit(init: RequestInit = {}): RequestInit {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    return {
      ...init,
      signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
      ...(this.config.insecureTls
        ? { tls: { rejectUnauthorized: false } }
        : {}),
    };
  }

  // Probe the controller to determine if it is UniFi OS or Legacy
  private async initializeEnvironment(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.debug('Probing UniFi controller at {baseUrl}', {
      baseUrl: this.config.baseUrl,
    });

    const response = await fetch(
      this.config.baseUrl,
      this.baseInit({ redirect: 'manual' })
    );

    // Legacy controllers redirect to /manage. UniFi OS returns 200 OK.
    if (
      response.status === 302 &&
      response.headers.get('location')?.includes('/manage')
    ) {
      this.isUnifiOS = false;
    } else {
      this.isUnifiOS = true;
    }
    this.isInitialized = true;

    // A wrong flavour means every later request 404s through the wrong prefix,
    // so the probe result is the first thing an operator needs to see.
    logger.info(
      'UniFi controller {baseUrl} probed as {flavour} (status {status})',
      {
        baseUrl: this.config.baseUrl,
        flavour: this.isUnifiOS ? 'unifi-os' : 'legacy',
        status: response.status,
      }
    );
  }

  // Parse and store cookies properly
  private updateTokens(response: Response) {
    const rawCookies = response.headers.getSetCookie
      ? response.headers.getSetCookie()
      : [];
    if (rawCookies.length > 0) {
      // Extract just the key=value portions
      this.cookies = rawCookies.flatMap((c) => {
        const cookie = c.split(';')[0];
        return cookie ? [cookie] : [];
      });
    }

    const csrf = response.headers.get('x-csrf-token');
    if (csrf) {
      this.csrfToken = csrf;
    }
  }

  private getUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    if (
      this.isUnifiOS &&
      !cleanPath.includes('login') &&
      !cleanPath.includes('logout')
    ) {
      return `${this.config.baseUrl}/proxy/network/${cleanPath}`;
    }
    return `${this.config.baseUrl}/${cleanPath}`;
  }

  private async login(): Promise<void> {
    try {
      await this.signIn();
    } catch (error) {
      // Reached before the request's own logging: a controller that is down,
      // unreachable or TLS-rejecting fails here, and the raw "Unable to
      // connect" says nothing about which host was tried.
      if (error instanceof Error && !(error instanceof UnifiApiError)) {
        logger.error('UniFi login at {baseUrl} failed: {error}', {
          baseUrl: this.config.baseUrl,
          error,
        });
      }
      throw error;
    }
  }

  private async signIn(): Promise<void> {
    await this.initializeEnvironment();

    const loginPath = this.isUnifiOS ? '/api/auth/login' : '/api/login';
    const response = await fetch(
      `${this.config.baseUrl}${loginPath}`,
      this.baseInit({
        body: JSON.stringify({
          password: this.config.password,
          username: this.config.username,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    );

    if (!response.ok) {
      logger.error('UniFi login to {loginPath} failed with status {status}', {
        loginPath,
        status: response.status,
      });
      throw new UnifiApiError(
        `UniFi login failed with status ${response.status}`
      );
    }

    this.updateTokens(response);

    const body = (await response.json()) as UnifiResponse<unknown>;
    if (body.meta?.rc === 'error') {
      logger.error('UniFi login to {loginPath} was rejected: {reason}', {
        loginPath,
        reason: body.meta.msg ?? 'unknown',
      });
      throw new UnifiApiError(body.meta.msg ?? 'UniFi login failed');
    }

    // A login that carries no cookie makes every later request re-login first.
    if (this.cookies.length === 0) {
      logger.warn(
        'UniFi login to {loginPath} succeeded without a session cookie',
        { loginPath }
      );
    }
    logger.debug('UniFi login to {loginPath} succeeded', { loginPath });
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const method = init.method ?? 'GET';
    const execute = async () => {
      const headers = new Headers(init.headers);
      headers.set('content-type', 'application/json');

      if (this.cookies.length > 0) {
        headers.set('cookie', this.cookies.join('; '));
      }
      if (this.csrfToken) {
        headers.set('x-csrf-token', this.csrfToken);
      }

      const targetUrl = this.getUrl(path);
      const startedAt = Date.now();
      const response = await fetch(
        targetUrl,
        this.baseInit({ ...init, headers })
      );
      const status = response.status;

      this.updateTokens(response);

      if (status === 401) {
        throw new Error(LOGIN_REQUIRED);
      }
      if (!response.ok) {
        // The controller answers a plain status for transport-level failures,
        // so the endpoint is the only thing that says what was attempted.
        logger.error('UniFi {method} {path} failed with status {status}', {
          method,
          path,
          status,
        });
        throw new UnifiApiError(
          `UniFi ${method} ${path} failed with status ${status}`
        );
      }

      const body = (await response.json()) as UnifiResponse<T>;
      if (body.meta?.rc === 'error') {
        if (body.meta.msg === 'api.err.LoginRequired') {
          throw new Error(LOGIN_REQUIRED);
        }
        logger.error('UniFi {method} {path} was rejected: {reason}', {
          method,
          path,
          reason: body.meta.msg ?? 'unknown',
        });
        throw new UnifiApiError(
          body.meta.msg ?? 'UniFi request failed',
          body.meta.msg
        );
      }

      logger.debug('UniFi {method} {path} -> {status} in {ms}ms', {
        method,
        ms: Date.now() - startedAt,
        path,
        status,
      });
      return body.data as T;
    };

    if (this.cookies.length === 0) {
      await this.login();
    }

    try {
      return await execute();
    } catch (error) {
      if (error instanceof Error && error.message === LOGIN_REQUIRED) {
        logger.warn('UniFi session expired, re-authenticating');
        this.cookies = []; // Clear state to force re-auth
        await this.login();
        return execute();
      }
      // DNS/TLS/timeout carry no status line, and the raw "Unable to connect"
      // names neither the endpoint nor the controller.
      if (error instanceof Error && !(error instanceof UnifiApiError)) {
        logger.error('UniFi {method} {path} failed: {error}', {
          error,
          method,
          path,
        });
      }
      throw error;
    }
  }

  // --- Endpoints ---

  getClientDevice = async (macAddress: string): Promise<UnifiClientDevice[]> =>
    dataArray(
      await this.request<UnifiClientDevice[]>(
        `/api/s/${this.config.site}/stat/user/${macAddress}`
      ),
      `GET stat/user/${macAddress}`
    );

  setClientName = async (clientId: string, name: string): Promise<void> =>
    this.request(`/api/s/${this.config.site}/rest/user/${clientId}`, {
      body: JSON.stringify({ name }),
      method: 'PUT',
    });

  getAccessDevices = async (): Promise<UnifiAccessDevice[]> =>
    dataArray(
      await this.request<UnifiAccessDevice[]>(
        `/api/s/${this.config.site}/stat/device`
      ),
      'GET stat/device'
    );

  restartDevice = async (
    macAddress: string,
    rebootType: 'soft' | 'hard' = 'soft'
  ): Promise<void> =>
    this.request(`/api/s/${this.config.site}/cmd/devmgr`, {
      body: JSON.stringify({
        cmd: 'restart',
        mac: macAddress,
        reboot_type: rebootType,
      }),
      method: 'POST',
    });

  getUserGroups = async (): Promise<UnifiSpeedProfile[]> =>
    dataArray(
      await this.request<UnifiSpeedProfile[]>(
        `/api/s/${this.config.site}/rest/usergroup`
      ),
      'GET rest/usergroup'
    );

  getWlanConf = async (): Promise<UnifiWlanConf[]> =>
    dataArray(
      await this.request<UnifiWlanConf[]>(
        `/api/s/${this.config.site}/rest/wlanconf`
      ),
      'GET rest/wlanconf'
    );

  createUserGroup = async (
    name: string,
    downloadMbps = -1,
    uploadMbps = -1
  ): Promise<UnifiSpeedProfile> => {
    const res = dataArray(
      await this.request<UnifiSpeedProfile[]>(
        `/api/s/${this.config.site}/rest/usergroup`,
        {
          body: JSON.stringify({
            name,
            qos_rate_max_down: downloadMbps === -1 ? -1 : downloadMbps * 1000,
            qos_rate_max_up: uploadMbps === -1 ? -1 : uploadMbps * 1000,
          }),
          method: 'POST',
        }
      ),
      'POST rest/usergroup'
    );
    if (!res[0]) {
      throw new UnifiApiError(
        'UniFi accepted the usergroup create but returned no row',
        'api.err.NoData'
      );
    }
    return res[0];
  };

  editUserGroup = async (
    id: string,
    siteId: string,
    name: string,
    downloadMbps: number,
    uploadMbps: number
  ): Promise<UnifiSpeedProfile> => {
    const res = dataArray(
      await this.request<UnifiSpeedProfile[]>(
        `/api/s/${siteId}/rest/usergroup/${id}`,
        {
          body: JSON.stringify({
            name,
            qos_rate_max_down: downloadMbps === -1 ? -1 : downloadMbps * 1000,
            qos_rate_max_up: uploadMbps === -1 ? -1 : uploadMbps * 1000,
          }),
          method: 'PUT',
        }
      ),
      `PUT rest/usergroup/${id}`
    );
    if (!res[0]) {
      throw new UnifiApiError(
        'UniFi accepted the usergroup edit but returned no row',
        'api.err.NoData'
      );
    }
    return res[0];
  };

  deleteUserGroup = async (id: string): Promise<void> =>
    this.request(`/api/s/${this.config.site}/rest/usergroup/${id}`, {
      method: 'DELETE',
    });

  fetchClientHostname = async (macAddress: string): Promise<string | null> => {
    const devices = await this.getClientDevice(macAddress);
    if (devices.length !== 1) {
      // `null` is a legitimate answer, but a device the controller stopped
      // reporting is exactly what leaves `reported_hostname` stale forever.
      logger.debug('UniFi reported {count} clients for {mac}', {
        count: devices.length,
        mac: macAddress,
      });
      return null;
    }
    return devices[0]?.hostname ?? null;
  };

  applySpeedProfile = async (
    macAddress: string,
    speedProfileId: string
  ): Promise<void> => {
    const [device] = await this.getClientDevice(macAddress);
    if (!device) {
      // Silent without this: the caller asked for a limit on a MAC the
      // controller has never seen, and nothing in the network would change.
      logger.warn(
        'UniFi has no client {mac}, speed profile {profileId} not applied',
        { mac: macAddress, profileId: speedProfileId }
      );
      return;
    }
    await this.request(`/api/s/${this.config.site}/rest/user/${device._id}`, {
      body: JSON.stringify({ usergroup_id: speedProfileId }),
      method: 'PUT',
    });
  };
}
