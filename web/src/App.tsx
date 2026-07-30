import { useEffect, useState } from 'react';
import * as api from './api';
import type { ConnectedAccountSummary, CurrentUser } from './api';
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

function AuthForm({ onAuthed }: { onAuthed: (user: CurrentUser) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = mode === 'login' ? await api.login(email, password) : await api.signup(email, password);
      onAuthed(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
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

function Dashboard({ user, onLoggedOut }: { user: CurrentUser; onLoggedOut: () => void }) {
  const [accounts, setAccounts] = useState<ConnectedAccountSummary[] | null>(null);
  const [alias, setAlias] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const connectorUrl = `${window.location.origin}/mcp/${user.mcpUserToken}`;

  async function refresh() {
    try {
      setAccounts(await api.listAccounts());
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
                <span className="alias">{a.alias}</span>
                <span className="google-email">{a.googleEmail}</span>
                <span className={`status status-${a.status}`}>
                  {a.status === 'ok' ? 'Connected' : 'Needs reconnect'}
                </span>
                {a.status === 'reauth_required' && (
                  <a className="reconnect-link" href={api.connectAccountUrl(a.alias)}>
                    Reconnect
                  </a>
                )}
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
      </section>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  const banner = useQueryBanner();

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <div className="app">
      {banner && <div className={`banner banner-${banner.kind}`}>{banner.text}</div>}
      {user ? (
        <Dashboard user={user} onLoggedOut={() => setUser(null)} />
      ) : (
        <AuthForm onAuthed={setUser} />
      )}
    </div>
  );
}

export default App;
