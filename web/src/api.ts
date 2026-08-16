export interface CurrentUser {
  email: string;
  mcpUserToken: string;
  mcpConnectorUrl: string;
}

export interface ConnectedAccountSummary {
  alias: string;
  googleEmail: string;
  status: 'ok' | 'reauth_required';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.message === 'string' ? body.message : `Request failed (${res.status})`);
  }
  return res.json();
}

export function signup(email: string, password: string): Promise<CurrentUser> {
  return request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function login(email: string, password: string): Promise<CurrentUser> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function logout(): Promise<{ ok: boolean }> {
  return request('/auth/logout', { method: 'POST' });
}

export function me(): Promise<CurrentUser> {
  return request('/auth/me');
}

export function listAccounts(): Promise<ConnectedAccountSummary[]> {
  return request('/auth/accounts');
}

export function connectAccountUrl(alias: string): string {
  return `/oauth/google/connect?alias=${encodeURIComponent(alias)}`;
}

export function renameAccount(alias: string, newAlias: string): Promise<ConnectedAccountSummary> {
  return request(`/auth/accounts/${encodeURIComponent(alias)}`, {
    method: 'PATCH',
    body: JSON.stringify({ newAlias }),
  });
}

export interface AuditLogEntry {
  _id: string;
  tool: string;
  alias?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export function getAuditLogs(): Promise<AuditLogEntry[]> {
  return request('/auth/audit-logs');
}
