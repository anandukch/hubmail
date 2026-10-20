---
name: hubmail
description: Search, read, and manage Gmail across one or more connected accounts via the Hubmail MCP server. Use when the user asks to search email, read a message, draft a reply, delete/trash a message, label or archive mail, or set up an auto-labeling filter — especially when they have more than one Gmail account connected.
compatibility: Requires a Hubmail MCP connector URL from https://hubmail.anandu.xyz (or a self-hosted Hubmail instance) and the `mcp-remote` bridge. Works with Claude Code, Claude Desktop, Cursor, GitHub Copilot, and other MCP-compatible agents.
metadata:
  author: anandukch
  homepage: https://hubmail.anandu.xyz
---

# Hubmail

Hubmail is a multi-account Gmail MCP server. A user connects one or more Gmail accounts through the Hubmail dashboard, then exposes a small set of audited tools (`list_accounts`, `search_emails`, `read_email`, `delete_email`, `draft_email`, `create_label`, `label_email`, `move_email_to_label`, `create_mail_filter`) to any MCP-compatible agent.

This skill does not replace the MCP connection — it teaches the agent when and how to use Hubmail's tools well. The user still needs a working connector URL (see Setup).

## Setup (one-time, per user)

1. Sign up / log in at https://hubmail.anandu.xyz and connect one or more Gmail accounts (Google OAuth, per-account alias like `work` or `personal`).
2. Copy the connector URL shown on the dashboard: `https://hubmail.anandu.xyz/mcp/<token>`. Treat this URL like a password — anyone with it can call the tools.
3. Claude Code / Claude Desktop only accept local stdio MCP servers in config, so bridge the remote URL with `mcp-remote`. Add to `.mcp.json` (or `claude_desktop_config.json`):

   ```json
   {
     "mcpServers": {
       "hubmail": {
         "command": "npx",
         "args": ["-y", "mcp-remote", "https://hubmail.anandu.xyz/mcp/<token>"]
       }
     }
   }
   ```

   `scripts/setup-mcp.sh` in this skill writes this entry for you — see **Choosing scope** below for where.
4. Fully quit and reopen the client — MCP config is only read at launch.
5. Self-hosting instead of using the hosted instance: see the Hubmail README for Docker/deploy instructions, then use that deployment's own connector URL in step 3.

### Choosing scope

Before running `setup-mcp.sh`, ask the user: **this project only, or every project (global)?** Don't ask which agent or client they're using — you already know, you're the one running the script.

- **This project only**: run `scripts/setup-mcp.sh <connector-url> .mcp.json` from the project root (or the project's own MCP config path, if your conventions differ).
- **Global / every project**: resolve your own client's standard global MCP config location and scope, then either run `scripts/setup-mcp.sh <connector-url> <path-to-your-global-config>` against it, or add the entry yourself if your client manages global config through its own command rather than a flat JSON file (e.g. Claude Code: `claude mcp add hubmail --scope user -- npx -y mcp-remote <connector-url>`).

If you're not sure what your own global config convention is, say so and ask the user to confirm the path rather than guessing and risking a malformed config file.

## Using the tools

Start with `list_accounts` whenever account scope is unclear. If more than one alias comes back and the user hasn't said which account they mean, **ask before calling any other tool** — never guess or silently pick one, and never run the same action across every account.

Read-only flow: `search_emails` (Gmail search syntax — `from:`, `subject:`, `is:unread`, etc.) to find candidates, then `read_email` with the `message_id` from the results to get the full body and attachment list.

Write actions (`delete_email`, `draft_email`, `create_label`, `label_email`, `move_email_to_label`, `create_mail_filter`) require the account to have granted `gmail.modify` at connect time. If a write call fails with a write-access error, tell the user to reconnect that account from the dashboard with write access granted — don't retry the same call.

Notes:
- `delete_email` moves to Trash (recoverable), not a permanent delete.
- `draft_email` only creates a draft — it never sends.
- `create_mail_filter` only affects mail that arrives after creation, not existing mail already in the inbox.
- `create_label` is idempotent — safe to call even if the label may already exist.
- Every tool call is audit-logged server-side (user, tool, account, timestamp), visible to the user at `GET /auth/audit-logs` — no extra action needed from the agent, just be aware actions are traceable.

## Presenting results

`search_emails` already returns its results as a markdown table (date, from, subject, snippet, id) and `read_email` returns a structured `### Message detail` block (Subject/From/Date/Body). Relay these as-is rather than re-flattening them into plain prose — the table and headings are there so the user can scan multiple results or a full message at a glance.

This applies even to open-ended asks like "list yesterday's mail" or "what's in my inbox" — call `search_emails`, then show the (possibly filtered-down) result set **as a table**, not as a bullet-point summary. You may drop rows that aren't relevant and add a short sentence of framing above or below the table, but don't collapse the remaining rows into prose bullets — the table is the answer, not a prose paraphrase of it.

After showing a message's detail, suggest 2–3 concrete next steps grounded in what the tool call actually supports — e.g. drafting a reply (`draft_email`), applying a label (`label_email`/`create_label`), or setting up a filter for similar future mail (`create_mail_filter`). Keep suggestions specific to the message's content (sender, subject, apparent intent), not generic boilerplate, and don't take any write action until the user picks one.

See [references/TOOLS.md](references/TOOLS.md) for the full per-tool parameter reference.
