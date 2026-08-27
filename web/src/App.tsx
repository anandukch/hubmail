import { useEffect, useState } from 'react';
import * as api from './api';
import type { ConnectedAccountSummary, CurrentUser, AuditLogEntry } from './api';
import LandingPage from './LandingPage';
import './App.css';

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'You declined access, so no account was connected.',
  invalid_state: 'That connection link expired or was invalid. Please try connecting again.',
  no_refresh_token: 'Google did not grant offline access. Please try connecting again.',
  oauth_failed: 'Something went wrong connecting that account. Please try again.',
};

function useQueryBanner() {
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    if (connected) {
      setBanner({ kind: 'success', text: `Connected '${connected}'.` });
    } else if (error) {
      setBanner({ kind: 'error', text: ERROR_MESSAGES[error] ?? 'Something went wrong.' });
    }
    if (connected || error) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return banner;
}

// Purely advisory client-side signal — the real gate is the 12-char server-side minimum.
function passwordStrength(password: string): { label: string; className: string } {
  if (!password) return { label: '', className: '' };
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password) || /[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { label: 'Weak', className: 'strength-weak' };
  if (score <= 2) return { label: 'Okay', className: 'strength-okay' };
  if (score <= 3) return { label: 'Good', className: 'strength-good' };
  return { label: 'Strong', className: 'strength-strong' };
}

function AuthForm({ onAuthed }: { onAuthed: (user: CurrentUser) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaBusy, setMfaBusy] = useState(false);

  const strength = mode === 'signup' ? passwordStrength(password) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        onAuthed(await api.signup(email, password));
        return;
      }
      const result = await api.login(email, password);
      if ('mfaRequired' in result) {
        setMfaToken(result.mfaToken);
      } else {
        onAuthed(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function submitMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setMfaError(null);
    setMfaBusy(true);
    try {
      onAuthed(await api.loginMfa(mfaToken, mfaCode.trim()));
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setMfaBusy(false);
    }
  }

  if (mfaToken) {
    return (
      <div className="auth-card">
        <h1>hubmail</h1>
        <p className="subtitle">Enter the 6-digit code from your authenticator app.</p>
        <form onSubmit={submitMfa}>
          <label>
            Authentication code
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              required
              placeholder="123456 or a recovery code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
            />
          </label>
          {mfaError && <p className="error-text">{mfaError}</p>}
          <button type="submit" disabled={mfaBusy}>
            {mfaBusy ? 'Verifying…' : 'Verify'}
          </button>
        </form>
        <button className="link-button" onClick={() => { setMfaToken(null); setMfaCode(''); setMfaError(null); }}>
          Back to log in
        </button>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>hubmail</h1>
      <p className="subtitle">Connect Gmail accounts, query them from Claude.</p>
      <form onSubmit={submit}>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={mode === 'signup' ? 12 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {mode === 'signup' && (
          <>
            {password && (
              <p className={`strength-hint ${strength?.className}`}>{strength?.label}</p>
            )}
            <label>
              Confirm password
              <input
                type="password"
                required
                minLength={12}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
          </>
        )}
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={busy}>
          {mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>
      <button className="link-button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
      </button>
    </div>
  );
}

function SecuritySection({ user, onLoggedOut }: { user: CurrentUser; onLoggedOut: () => void }) {
  const [mfaEnabled, setMfaEnabled] = useState(user.mfaEnabled ?? false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  const [mfaSetup, setMfaSetup] = useState<api.MfaSetup | null>(null);
  const [mfaEnableCode, setMfaEnableCode] = useState('');
  const [mfaSetupError, setMfaSetupError] = useState<string | null>(null);
  const [mfaSetupBusy, setMfaSetupBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const [disablePassword, setDisablePassword] = useState('');
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disableBusy, setDisableBusy] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);

  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (newPassword !== confirmNewPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    setPwBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPwSuccess(true);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not change password.');
    } finally {
      setPwBusy(false);
    }
  }

  async function startMfaSetup() {
    setMfaSetupError(null);
    setMfaSetupBusy(true);
    try {
      setMfaSetup(await api.setupMfa());
    } catch (err) {
      setMfaSetupError(err instanceof Error ? err.message : 'Could not start MFA setup.');
    } finally {
      setMfaSetupBusy(false);
    }
  }

  async function confirmMfaSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaSetup) return;
    setMfaSetupError(null);
    setMfaSetupBusy(true);
    try {
      const result = await api.enableMfa(mfaSetup.secret, mfaEnableCode.trim());
      setRecoveryCodes(result.recoveryCodes);
      setMfaEnabled(true);
      setMfaSetup(null);
      setMfaEnableCode('');
    } catch (err) {
      setMfaSetupError(err instanceof Error ? err.message : 'Invalid code, try again.');
    } finally {
      setMfaSetupBusy(false);
    }
  }

  async function handleDisableMfa(e: React.FormEvent) {
    e.preventDefault();
    setDisableError(null);
    setDisableBusy(true);
    try {
      await api.disableMfa(disablePassword);
      setMfaEnabled(false);
      setShowDisableForm(false);
      setDisablePassword('');
      setRecoveryCodes(null);
    } catch (err) {
      setDisableError(err instanceof Error ? err.message : 'Could not disable MFA.');
    } finally {
      setDisableBusy(false);
    }
  }

  async function handleRevokeAll() {
    if (!window.confirm('Log out of every device and session? You will need to log in again here too.')) {
      return;
    }
    setRevokeError(null);
    setRevokeBusy(true);
    try {
      await api.revokeAllSessions();
      onLoggedOut();
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Could not revoke sessions.');
      setRevokeBusy(false);
    }
  }

  return (
    <>
      <section className="card security-card">
        <h2>Change password</h2>
        <form className="stacked-form" onSubmit={handleChangePassword}>
          <label>
            Current password
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              required
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              required
              minLength={12}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
            />
          </label>
          {pwError && <p className="error-text">{pwError}</p>}
          {pwSuccess && <p className="success-text">Password changed. Other sessions were logged out.</p>}
          <button type="submit" className="btn" disabled={pwBusy}>
            {pwBusy ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </section>

      <section className="card security-card">
        <div className="security-card-header">
          <h2>Two-factor authentication</h2>
          <span className={`badge ${mfaEnabled ? 'badge-on' : 'badge-off'}`}>
            {mfaEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {recoveryCodes && (
          <div className="recovery-codes">
            <p>
              <strong>Save these recovery codes now — they won't be shown again.</strong> Each works once, if
              you lose access to your authenticator app.
            </p>
            <div className="recovery-codes-grid">
              {recoveryCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <button type="button" className="btn btn-outline" onClick={() => setRecoveryCodes(null)}>
              I've saved them
            </button>
          </div>
        )}

        {!recoveryCodes && mfaEnabled && !showDisableForm && (
          <div className="security-row">
            <p className="hint">An authenticator code is required at login.</p>
            <button type="button" className="btn btn-outline" onClick={() => setShowDisableForm(true)}>
              Disable
            </button>
          </div>
        )}

        {!recoveryCodes && mfaEnabled && showDisableForm && (
          <form className="stacked-form" onSubmit={handleDisableMfa}>
            <label>
              Confirm your password to disable
              <input
                type="password"
                required
                autoFocus
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
              />
            </label>
            {disableError && <p className="error-text">{disableError}</p>}
            <div className="button-row">
              <button type="submit" className="btn btn-danger" disabled={disableBusy}>
                {disableBusy ? 'Disabling…' : 'Disable MFA'}
              </button>
              <button type="button" className="link-button" onClick={() => setShowDisableForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {!recoveryCodes && !mfaEnabled && !mfaSetup && (
          <div className="security-row">
            <p className="hint">Add an authenticator app for a second sign-in step.</p>
            <button type="button" className="btn" onClick={startMfaSetup} disabled={mfaSetupBusy}>
              {mfaSetupBusy ? 'Starting…' : 'Enable MFA'}
            </button>
          </div>
        )}

        {!recoveryCodes && mfaSetup && (
          <form className="stacked-form mfa-setup-box" onSubmit={confirmMfaSetup}>
            <p>Scan this QR code with your authenticator app, then enter the 6-digit code it shows.</p>
            <img className="mfa-qr" src={mfaSetup.qrDataUrl} alt="MFA setup QR code" width={180} height={180} />
            <p className="hint">
              Or enter this key manually: <code>{mfaSetup.secret}</code>
            </p>
            <label>
              Code
              <input
                type="text"
                inputMode="numeric"
                required
                autoFocus
                value={mfaEnableCode}
                onChange={(e) => setMfaEnableCode(e.target.value)}
              />
            </label>
            {mfaSetupError && <p className="error-text">{mfaSetupError}</p>}
            <div className="button-row">
              <button type="submit" className="btn" disabled={mfaSetupBusy}>
                {mfaSetupBusy ? 'Confirming…' : 'Confirm & enable'}
              </button>
              <button type="button" className="link-button" onClick={() => setMfaSetup(null)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="card security-card">
        <h2>Sessions</h2>
        {revokeError && <p className="error-text">{revokeError}</p>}
        <div className="security-row">
          <p className="hint">Invalidates every session, including this one.</p>
          <button type="button" className="btn btn-danger" onClick={handleRevokeAll} disabled={revokeBusy}>
            {revokeBusy ? 'Logging out…' : 'Log out everywhere'}
          </button>
        </div>
      </section>
    </>
  );
}

type DashboardTab = 'overview' | 'security' | 'audit';

function Dashboard({ user, onLoggedOut }: { user: CurrentUser; onLoggedOut: () => void }) {
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [accounts, setAccounts] = useState<ConnectedAccountSummary[] | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[] | null>(null);
  const [alias, setAlias] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingAlias, setEditingAlias] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [connectorUrl, setConnectorUrl] = useState(user.mcpConnectorUrl);
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [accts, logs] = await Promise.all([api.listAccounts(), api.getAuditLogs()]);
      setAccounts(accts);
      setAuditLogs(logs);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load accounts.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleLogout() {
    await api.logout();
    onLoggedOut();
  }

  function startRename(currentAlias: string) {
    setEditingAlias(currentAlias);
    setRenameValue(currentAlias);
    setRenameError(null);
  }

  function cancelRename() {
    setEditingAlias(null);
    setRenameError(null);
  }

  async function handleRename(e: React.FormEvent, currentAlias: string) {
    e.preventDefault();
    const trimmed = renameValue.trim().toLowerCase();
    if (!/^[a-z0-9-_]{1,40}$/.test(trimmed)) {
      setRenameError('Alias must be 1-40 characters: letters, numbers, - or _');
      return;
    }
    if (trimmed === currentAlias) {
      setEditingAlias(null);
      return;
    }
    try {
      await api.renameAccount(currentAlias, trimmed);
      setEditingAlias(null);
      await refresh();
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Could not rename account.');
    }
  }

  async function handleRegenerate() {
    if (!window.confirm('Regenerate connector URL? The old URL will stop working immediately, and any connector using it must be re-added with the new URL.')) {
      return;
    }
    setRegenError(null);
    setRegenBusy(true);
    try {
      const result = await api.regenerateMcpToken();
      setConnectorUrl(result.mcpConnectorUrl);
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : 'Could not regenerate URL.');
    } finally {
      setRegenBusy(false);
    }
  }

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = alias.trim().toLowerCase();
    if (!/^[a-z0-9-_]{1,40}$/.test(trimmed)) {
      setLoadError('Alias must be 1-40 characters: letters, numbers, - or _');
      return;
    }
    window.location.href = api.connectAccountUrl(trimmed);
  }

  return (
    <div className="dashboard">
      <header>
        <h1>hubmail</h1>
        <button className="link-button" onClick={handleLogout}>
          Log out ({user.email})
        </button>
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'overview' ? 'tab-active' : ''}`}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`tab ${tab === 'security' ? 'tab-active' : ''}`}
          onClick={() => setTab('security')}
        >
          Security
        </button>
        <button
          type="button"
          className={`tab ${tab === 'audit' ? 'tab-active' : ''}`}
          onClick={() => setTab('audit')}
        >
          Audit log
        </button>
      </nav>

      {tab === 'overview' && (
        <>
          <section className="card">
            <h2>Connected Gmail accounts</h2>
            {loadError && <p className="error-text">{loadError}</p>}
            {accounts === null ? (
              <p>Loading…</p>
            ) : accounts.length === 0 ? (
              <p>No accounts connected yet.</p>
            ) : (
              <ul className="account-list">
                {accounts.map((a) => (
                  <li key={a.alias}>
                    {editingAlias === a.alias ? (
                      <form className="rename-form" onSubmit={(e) => handleRename(e, a.alias)}>
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          autoFocus
                        />
                        <button type="submit">Save</button>
                        <button type="button" className="link-button" onClick={cancelRename}>
                          Cancel
                        </button>
                        {renameError && <span className="error-text">{renameError}</span>}
                      </form>
                    ) : (
                      <>
                        <span className="alias">{a.alias}</span>
                        <button
                          type="button"
                          className="link-button rename-link"
                          onClick={() => startRename(a.alias)}
                        >
                          Rename
                        </button>
                      </>
                    )}
                    <span className="google-email">{a.googleEmail}</span>
                    <span className={`status status-${a.status}`}>
                      {a.status === 'ok' ? 'Connected' : 'Needs reconnect'}
                    </span>
                    <a className="reconnect-link" href={api.connectAccountUrl(a.alias)}>
                      Reconnect
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <form className="connect-form" onSubmit={handleConnect}>
              <input
                type="text"
                placeholder="alias, e.g. work"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
              />
              <button type="submit">Connect Gmail account</button>
            </form>
          </section>

          <section className="card">
            <h2>Claude connector URL</h2>
            <p>Paste this into Claude.ai or Claude Desktop as a custom MCP connector.</p>
            <code className="connector-url">{connectorUrl}</code>
            {regenError && <p className="error-text">{regenError}</p>}
            <button type="button" className="link-button" onClick={handleRegenerate} disabled={regenBusy}>
              {regenBusy ? 'Regenerating…' : 'Regenerate URL'}
            </button>
            <p className="hint">If this URL leaked, regenerate it. The old URL stops working right away.</p>
          </section>
        </>
      )}

      {tab === 'security' && <SecuritySection user={user} onLoggedOut={onLoggedOut} />}

      {tab === 'audit' && (
        <section className="card">
          <h2>Audit log</h2>
          <p>Every time Claude accessed your inbox via hubmail.</p>
          {auditLogs === null ? (
            <p>Loading…</p>
          ) : auditLogs.length === 0 ? (
            <p>No activity yet.</p>
          ) : (
            <ul className="audit-list">
              {auditLogs.map((entry) => (
                <li key={entry._id} className="audit-entry">
                  <span className="audit-tool">{entry.tool}</span>
                  {entry.alias && <span className="audit-alias">{entry.alias}</span>}
                  {Boolean(entry.metadata?.query) && (
                    <span className="audit-meta">"{String(entry.metadata?.query)}"</span>
                  )}
                  <span className="audit-time">{new Date(entry.createdAt).toLocaleString()}</span>
                  {entry.ip && <span className="audit-ip">{entry.ip}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function App() {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  const [showAuth, setShowAuth] = useState(false);
  const banner = useQueryBanner();

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return <div className="loading">Loading…</div>;
  }

  if (user) {
    return (
      <div className="app">
        {banner && <div className={`banner banner-${banner.kind}`}>{banner.text}</div>}
        <Dashboard user={user} onLoggedOut={() => { setUser(null); setShowAuth(false); }} />
      </div>
    );
  }

  if (!showAuth) {
    return <LandingPage onGetStarted={() => setShowAuth(true)} />;
  }

  return (
    <div className="app">
      {banner && <div className={`banner banner-${banner.kind}`}>{banner.text}</div>}
      <AuthForm onAuthed={setUser} />
    </div>
  );
}

export default App;
