# Hubmail MCP tool reference

All tools operate on an `account` alias (e.g. `work`, `personal`). Omit `account` only when exactly one account is connected — otherwise resolve it first with `list_accounts`.

| Tool | Access | Parameters | Notes |
|---|---|---|---|
| `list_accounts` | read | none | Returns connected aliases. Call first when account scope is ambiguous. |
| `search_emails` | read | `account?`, `query` (Gmail search syntax), `max_results` (default 10, max 50) | Returns `message_id`, subject, sender, snippet, date per result. |
| `read_email` | read | `account?`, `message_id` | Full body + attachment list for one message. |
| `delete_email` | write | `account?`, `message_id` | Moves to Trash. Recoverable, not permanent. |
| `draft_email` | write | `account?`, `to`, `subject`, `body` | Creates a draft only. Never sends. |
| `create_label` | write | `account?`, `name` | Idempotent — returns the existing label if the name already exists. |
| `label_email` | write | `account?`, `message_id(s)`, `label` | Tags message(s) with an existing label. Message stays in Inbox. |
| `move_email_to_label` | write | `account?`, `message_id(s)`, `label` | Tags with an existing label and archives (removes `INBOX`) — Hubmail's equivalent of moving mail into a folder. |
| `create_mail_filter` | write | `account?`, `query`, `label`, `skip_inbox?` | Auto-labels (and optionally skips Inbox for) mail arriving **after** creation. Does not touch existing mail. |

## Read vs. write access

Connecting an account in the Hubmail dashboard requests both `gmail.readonly` and `gmail.modify` scopes. Google's consent screen lets the user deselect `gmail.modify` and keep the connection read-only. In that case:

- `list_accounts`, `search_emails`, `read_email` keep working normally.
- Every write tool (`delete_email`, `draft_email`, `create_label`, `label_email`, `move_email_to_label`, `create_mail_filter`) fails with a message telling the user to reconnect the account with write access granted.

If an agent hits this error, surface it to the user verbatim rather than retrying or working around it — reconnecting is a dashboard action the agent can't perform on the user's behalf.

## Multi-account behavior

Hubmail does not support a single call across "all" accounts — `search_emails` and friends operate on one account at a time. If the user's request spans accounts ("check both inboxes for X"), call the tool once per account and combine the results yourself; don't expect the server to fan out.

## Error handling

Tool errors come back as normal MCP tool results with explanatory text (no accounts connected, account not found, ambiguous account, write access missing, etc.) — read the message and relay the relevant part to the user instead of retrying blindly.
