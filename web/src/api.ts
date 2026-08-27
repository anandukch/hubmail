export interface CurrentUser {
  email: string;
  mcpUserToken: string;
  mcpConnectorUrl: string;
  mfaEnabled?: boolean;
}

export interface MfaRequired {
  mfaRequired: true;
  mfaToken: string;
}

export type LoginResult = CurrentUser | MfaRequired;

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

export function login(email: string, password: string): Promise<LoginResult> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function loginMfa(mfaToken: string, code: string): Promise<CurrentUser> {
  return request('/auth/login/mfa', { method: 'POST', body: JSON.stringify({ mfaToken, code }) });
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

export function regenerateMcpToken(): Promise<CurrentUser> {
  return request('/auth/mcp-token/regenerate', { method: 'POST' });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  return request('/auth/change-password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function revokeAllSessions(): Promise<{ ok: boolean }> {
  return request('/auth/sessions/revoke-all', { method: 'POST' });
}

export interface MfaSetup {
  secret: string;
  qrDataUrl: string;
}

export function setupMfa(): Promise<MfaSetup> {
  return request('/auth/mfa/setup', { method: 'POST' });
}

export function enableMfa(secret: string, code: string): Promise<{ recoveryCodes: string[] }> {
  return request('/auth/mfa/enable', { method: 'POST', body: JSON.stringify({ secret, code }) });
}

export function disableMfa(password: string): Promise<{ ok: boolean }> {
  return request('/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ password }) });
}
