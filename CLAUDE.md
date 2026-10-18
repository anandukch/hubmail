## Project

Hubmail — multi-account Gmail MCP server. NestJS 11 + MongoDB (Mongoose) API, React 19 + Vite web dashboard, MCP tools exposed over Streamable HTTP at `POST /mcp/:userToken`.

**Layout**
- `src/auth/` — signup/login, Google OAuth (Gmail connect), JWT sessions, MFA, token encryption/refresh.
- `src/gmail/` — Gmail API client + MIME handling, wrapped by `GmailService`.
- `src/mcp/` — MCP server factory (`mcp-server.factory.ts`), the `/mcp/:userToken` controller, account-alias resolution, audit logging. Tools live one-per-file in `src/mcp/tools/`, each registered via a `register<Name>Tool(server, ctx)` function and added in `mcp-server.factory.ts`.
- `web/` — separate Vite app (own `package.json`), served as static files by the API in production.
- `skills/hubmail/` — the Agent Skill package (SKILL.md + references + setup script) submitted to the Agensi marketplace, wrapping the existing MCP tools for agent consumption. See its SKILL.md before changing anything MCP-tool-facing, since tool descriptions/behavior changes there need to stay in sync.

**Commands**
```bash
npm run start:dev      # API, watch mode (needs MONGODB_URI + Google OAuth creds in .env)
npm --prefix web run dev   # web dashboard dev server
npm test                # unit tests (jest)
npm run test:e2e        # e2e tests, including test/mcp.e2e-spec.ts
npm run lint             # eslint (API) — web has its own oxlint via web/package.json
npm run verify:gmail     # sanity-check Gmail API credentials
```

**Conventions**
- New MCP tools: add `src/mcp/tools/<name>.tool.ts` exporting `register<Name>Tool`, register it in `mcp-server.factory.ts`, use `zod` for `inputSchema`, wrap the handler body in `withToolErrorHandling` (`src/mcp/mcp-error-mapper.util.ts`), and call `ctx.auditLog.log(...)` before any Gmail API call — every tool call must be audited.
- Tools that touch write scopes must handle the "reconnect for write access" failure path (see `src/gmail/gmail-api.error.ts`) rather than assuming `gmail.modify` was granted.
- Account resolution (`AccountResolverService.resolve`) is the single source of truth for alias ambiguity — don't duplicate that logic in a tool; call it and handle the `resolved` / `no_accounts` / `ambiguous` / `not_found` cases it returns.
- Secrets: Gmail refresh tokens are AES-256-GCM encrypted at rest (`TOKEN_ENCRYPTION_KEY`); never log a raw token or `mcpUserToken`.

## gstack

Use the /browse skill from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /design-html, /review, /deslop-shared-libs, /test-audit, /ship, /land-and-deploy, /canary, /benchmark, /browse, /connect-chrome, /qa, /qa-only, /design-review, /scrape, /setup-browser-cookies, /setup-deploy, /setup-gbrain, /retro, /investigate, /document-release, /document-generate, /codex, /cso, /autoplan, /plan-devex-review, /devex-review, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn
