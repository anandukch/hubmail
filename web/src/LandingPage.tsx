import './landing.css';

interface Props {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: Props) {
  return (
    <div className="lp">
      {/* Nav */}
      <nav className="lp-nav">
        <span className="lp-logo">hubmail</span>
        <div className="lp-nav-right">
          <button className="lp-btn-ghost" onClick={onGetStarted}>Sign in</button>
          <button className="lp-btn-primary" onClick={onGetStarted}>Get started free</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-badge">Open source · Gmail read-only · No setup</div>
        <h1 className="lp-headline">
          Your Gmail inbox,<br />
          <span className="lp-gradient">inside Claude.</span>
        </h1>
        <p className="lp-sub">
          Connect multiple Gmail accounts to Claude in 2 minutes — no local server,
          no config files, no terminal. Just sign up, connect, paste one URL.
        </p>
        <div className="lp-hero-cta">
          <button className="lp-btn-primary lp-btn-lg" onClick={onGetStarted}>
            Connect your inbox →
          </button>
          <a
            className="lp-btn-ghost lp-btn-lg"
            href="https://github.com/anandu-kv/hubmail"
            target="_blank"
            rel="noopener noreferrer"
          >
            View source
          </a>
        </div>
        <p className="lp-hero-note">Free · No credit card · Gmail read-only access</p>

        {/* Terminal mockup */}
        <div className="lp-terminal">
          <div className="lp-terminal-bar">
            <span className="lp-terminal-dot" /><span className="lp-terminal-dot" /><span className="lp-terminal-dot" />
            <span className="lp-terminal-title">Claude Desktop</span>
          </div>
          <div className="lp-terminal-body">
            <div className="lp-chat-user">Summarize my unread emails from the work account</div>
            <div className="lp-chat-tool">
              <span className="lp-tool-badge">hubmail</span> search_emails · account: work · query: is:unread
            </div>
            <div className="lp-chat-claude">
              You have 4 unread emails. The most urgent is from <strong>Sarah</strong> re:
              Q3 budget review — needs your sign-off by EOD. Two are GitHub PR notifications
              on <strong>api-refactor</strong>. One newsletter.
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="lp-section lp-problem">
        <div className="lp-section-inner">
          <h2 className="lp-section-title">Local Gmail MCP tools are painful</h2>
          <div className="lp-problem-grid">
            <div className="lp-problem-card">
              <span className="lp-problem-icon">⚙️</span>
              <strong>Clone repos to get started</strong>
              <p>Every local tool requires git clone, npm install, and hand-editing config files just to see your first email.</p>
            </div>
            <div className="lp-problem-card">
              <span className="lp-problem-icon">💻</span>
              <strong>Breaks when you switch machines</strong>
              <p>Tokens stored on disk. Move to a new laptop and you're back to square one — re-auth, re-config, re-debug.</p>
            </div>
            <div className="lp-problem-card">
              <span className="lp-problem-icon">👤</span>
              <strong>Single-user only</strong>
              <p>Built for one person on one machine. No accounts, no sharing, no team support.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="lp-section">
        <div className="lp-section-inner">
          <div className="lp-section-label">How it works</div>
          <h2 className="lp-section-title">Three steps, two minutes</h2>
          <div className="lp-steps">
            <div className="lp-step">
              <div className="lp-step-num">01</div>
              <h3>Sign up</h3>
              <p>Create a hubmail account with your email and password. Takes 10 seconds.</p>
            </div>
            <div className="lp-step-arrow">→</div>
            <div className="lp-step">
              <div className="lp-step-num">02</div>
              <h3>Connect Gmail</h3>
              <p>Click "Connect Gmail account", pick an alias (e.g. <em>work</em>, <em>personal</em>), authorize via Google OAuth. Repeat for every inbox.</p>
            </div>
            <div className="lp-step-arrow">→</div>
            <div className="lp-step">
              <div className="lp-step-num">03</div>
              <h3>Paste into Claude</h3>
              <p>Copy your personal MCP connector URL from the dashboard. Paste into Claude Desktop or Claude.ai. Done.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features bento */}
      <section className="lp-section">
        <div className="lp-section-inner">
          <div className="lp-section-label">Features</div>
          <h2 className="lp-section-title">Everything local tools can't do</h2>
          <div className="lp-bento">
            <div className="lp-bento-card lp-bento-wide">
              <div className="lp-bento-icon">☁️</div>
              <h3>Fully hosted</h3>
              <p>No local server. No config files. No terminal. Your MCP connector URL works from any device, any Claude client — forever.</p>
            </div>
            <div className="lp-bento-card">
              <div className="lp-bento-icon">📬</div>
              <h3>Multi-account</h3>
              <p>Connect unlimited Gmail accounts under one hubmail login. Give each one an alias and tell Claude which to use.</p>
            </div>
            <div className="lp-bento-card">
              <div className="lp-bento-icon">🔐</div>
              <h3>Google OAuth</h3>
              <p>No passwords. Standard Google OAuth flow — the same login you use everywhere.</p>
            </div>
            <div className="lp-bento-card">
              <div className="lp-bento-icon">🖥️</div>
              <h3>Web dashboard</h3>
              <p>See all connected accounts, their status, and your connector URL in one clean interface.</p>
            </div>
            <div className="lp-bento-card">
              <div className="lp-bento-icon">🔍</div>
              <h3>Full Gmail search syntax</h3>
              <p>Ask Claude anything — and it uses Gmail's native search under the hood. <code>from:boss is:unread after:2024/01/01</code> — all of it works.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="lp-section lp-trust-section">
        <div className="lp-section-inner">
          <div className="lp-section-label">Trust & Security</div>
          <h2 className="lp-section-title">You're giving Claude access to your inbox.<br />Here's exactly what we do with it.</h2>
          <div className="lp-trust-grid">
            <div className="lp-trust-card">
              <div className="lp-trust-check">✓</div>
              <div>
                <h3>Open source</h3>
                <p>Every line of code is public on GitHub. Audit exactly what happens to your tokens and emails. Nothing hidden.</p>
                <a href="https://github.com/anandu-kv/hubmail" target="_blank" rel="noopener noreferrer" className="lp-link">View on GitHub →</a>
              </div>
            </div>
            <div className="lp-trust-card">
              <div className="lp-trust-check">✓</div>
              <div>
                <h3>Read-only Gmail access</h3>
                <p>We only request <code>gmail.readonly</code> scope. Hubmail cannot send, delete, or modify any email. Ever.</p>
              </div>
            </div>
            <div className="lp-trust-card">
              <div className="lp-trust-check">✓</div>
              <div>
                <h3>No email content stored</h3>
                <p>Emails are fetched live from Gmail on each Claude request and returned directly. We never cache or log email content.</p>
              </div>
            </div>
            <div className="lp-trust-card lp-trust-soon">
              <div className="lp-trust-check lp-trust-soon-badge">Soon</div>
              <div>
                <h3>Audit log</h3>
                <p>See every time Claude accessed your inbox — timestamp, tool called, which account. Full visibility, coming soon.</p>
              </div>
            </div>
            <div className="lp-trust-card">
              <div className="lp-trust-check">✓</div>
              <div>
                <h3>Encrypted token storage</h3>
                <p>Google refresh tokens are encrypted at rest using AES-256-GCM before being stored in our database.</p>
              </div>
            </div>
            <div className="lp-trust-card">
              <div className="lp-trust-check">✓</div>
              <div>
                <h3>One-click disconnect</h3>
                <p>Revoke any Gmail account instantly from the dashboard. Token deleted from our database immediately.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section">
        <div className="lp-section-inner lp-faq-inner">
          <div className="lp-section-label">FAQ</div>
          <h2 className="lp-section-title">Questions</h2>
          <div className="lp-faq">
            <details className="lp-faq-item">
              <summary>What can Claude actually do with my Gmail?</summary>
              <p>Search emails using Gmail syntax, read the full content of individual emails, and list your connected accounts. That's it — no sending, no deleting, no drafts.</p>
            </details>
            <details className="lp-faq-item">
              <summary>How is this different from local Gmail MCP tools?</summary>
              <p>Local tools run on your machine and store tokens in files on disk. Hubmail is hosted — your connector URL works from any device. No setup, no maintenance, no "it broke when I got a new laptop."</p>
            </details>
            <details className="lp-faq-item">
              <summary>Can I connect more than one Gmail account?</summary>
              <p>Yes. Connect as many as you want. Give each one an alias (work, personal, freelance) and tell Claude which account to use in your message.</p>
            </details>
            <details className="lp-faq-item">
              <summary>Does hubmail work with Claude.ai (web) or only Claude Desktop?</summary>
              <p>Both. Claude Desktop works out of the box with localhost. For Claude.ai, you need a publicly accessible URL — use a tunnel like ngrok during development, or deploy hubmail to any cloud host.</p>
            </details>
            <details className="lp-faq-item">
              <summary>Is my email content sent to hubmail servers?</summary>
              <p>Only transiently — when Claude calls a tool, we fetch the email from Gmail and return it to Claude. We never store, log, or cache email content.</p>
            </details>
            <details className="lp-faq-item">
              <summary>Can I self-host hubmail?</summary>
              <p>Yes. The full source is on GitHub. Deploy it yourself on any Node.js host and point the environment variables at your own Google OAuth credentials and MongoDB instance.</p>
            </details>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="lp-section lp-cta-section">
        <div className="lp-section-inner lp-cta-inner">
          <h2 className="lp-cta-title">Connect your inbox in 2 minutes</h2>
          <p className="lp-cta-sub">Free. Open source. Read-only Gmail access.</p>
          <button className="lp-btn-primary lp-btn-lg" onClick={onGetStarted}>
            Get started →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <span className="lp-logo">hubmail</span>
        <div className="lp-footer-links">
          <a href="https://github.com/anandu-kv/hubmail" target="_blank" rel="noopener noreferrer">GitHub</a>
          <button className="lp-footer-link-btn" onClick={onGetStarted}>Sign in</button>
        </div>
      </footer>
    </div>
  );
}
