// unifi-api.ts
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

export class UnifiClient {
  private readonly config: Required<UnifiConfig>;
  private cookies: string[] = [];
  private csrfToken: string | null = null;
  private isUnifiOS = false;
  private isInitialized = false;

  constructor(config: UnifiConfig) {
    this.config = { insecureTls: false, site: 'default', ...config };
    if (this.config.insecureTls) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
  }

  // Probe the controller to determine if it is UniFi OS or Legacy
  private async initializeEnvironment(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const response = await fetch(this.config.baseUrl, { redirect: 'manual' });

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
    await this.initializeEnvironment();

    const loginPath = this.isUnifiOS ? '/api/auth/login' : '/api/login';
    const response = await fetch(`${this.config.baseUrl}${loginPath}`, {
      body: JSON.stringify({
        password: this.config.password,
        username: this.config.username,
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`UniFi login failed with status ${response.status}`);
    }

    this.updateTokens(response);

    const body = (await response.json()) as UnifiResponse<unknown>;
    if (body.meta?.rc === 'error') {
      throw new Error(body.meta.msg ?? 'UniFi login failed');
    }
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
      const response = await fetch(targetUrl, { ...init, headers });

      this.updateTokens(response);

      if (response.status === 401) {
        throw new Error(LOGIN_REQUIRED);
      }
      if (!response.ok) {
        throw new Error(`UniFi request failed with status ${response.status}`);
      }

      const body = (await response.json()) as UnifiResponse<T>;
      if (body.meta?.rc === 'error') {
        if (body.meta.msg === 'api.err.LoginRequired') {
          throw new Error(LOGIN_REQUIRED);
        }
        const err = new Error(body.meta.msg ?? 'UniFi request failed');
        throw new UnifiApiError(err.message, body.meta.msg);
      }
      return body.data as T;
    };

    if (this.cookies.length === 0) {
      await this.login();
    }

    try {
      return await execute();
    } catch (error) {
      if (error instanceof Error && error.message === LOGIN_REQUIRED) {
        this.cookies = []; // Clear state to force re-auth
        await this.login();
        return execute();
      }
      throw error;
    }
  }

  // --- Endpoints ---

  getClientDevice = async (macAddress: string): Promise<UnifiClientDevice[]> =>
    this.request(`/api/s/${this.config.site}/stat/user/${macAddress}`);

  setClientName = async (clientId: string, name: string): Promise<void> =>
    this.request(`/api/s/${this.config.site}/rest/user/${clientId}`, {
      body: JSON.stringify({ name }),
      method: 'PUT',
    });

  getAccessDevices = async (): Promise<UnifiAccessDevice[]> =>
    this.request(`/api/s/${this.config.site}/stat/device`);

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
    this.request(`/api/s/${this.config.site}/rest/usergroup`);

  getWlanConf = async (): Promise<UnifiWlanConf[]> =>
    this.request(`/api/s/${this.config.site}/rest/wlanconf`);

  createUserGroup = async (
    name: string,
    downloadMbps = -1,
    uploadMbps = -1
  ): Promise<UnifiSpeedProfile> => {
    const res = await this.request<UnifiSpeedProfile[]>(
      `/api/s/${this.config.site}/rest/usergroup`,
      {
        body: JSON.stringify({
          name,
          qos_rate_max_down: downloadMbps === -1 ? -1 : downloadMbps * 1000,
          qos_rate_max_up: uploadMbps === -1 ? -1 : uploadMbps * 1000,
        }),
        method: 'POST',
      }
    );
    if (!res[0]) {
      throw new Error('UniFi returned empty array');
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
    const res = await this.request<UnifiSpeedProfile[]>(
      `/api/s/${siteId}/rest/usergroup/${id}`,
      {
        body: JSON.stringify({
          name,
          qos_rate_max_down: downloadMbps === -1 ? -1 : downloadMbps * 1000,
          qos_rate_max_up: uploadMbps === -1 ? -1 : uploadMbps * 1000,
        }),
        method: 'PUT',
      }
    );
    if (!res[0]) {
      throw new Error('UniFi returned empty array');
    }
    return res[0];
  };

  deleteUserGroup = async (id: string): Promise<void> =>
    this.request(`/api/s/${this.config.site}/rest/usergroup/${id}`, {
      method: 'DELETE',
    });

  fetchClientHostname = async (macAddress: string): Promise<string | null> => {
    const devices = await this.getClientDevice(macAddress);
    return devices.length === 1 ? (devices[0]?.hostname ?? null) : null;
  };

  applySpeedProfile = async (
    macAddress: string,
    speedProfileId: string
  ): Promise<void> => {
    const [device] = await this.getClientDevice(macAddress);
    if (!device) {
      return;
    }
    await this.request(`/api/s/${this.config.site}/rest/user/${device._id}`, {
      body: JSON.stringify({ usergroup_id: speedProfileId }),
      method: 'PUT',
    });
  };
}
