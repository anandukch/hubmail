#!/usr/bin/env bash
# Adds a Hubmail MCP connector entry to a client's .mcp.json (or any target
# JSON file passed as $2), bridged through mcp-remote since Claude Code /
# Claude Desktop only accept local stdio MCP servers.
#
# Usage:
#   scripts/setup-mcp.sh <connector-url> [config-path]
#
# Example:
#   scripts/setup-mcp.sh https://hubmail.anandu.xyz/mcp/abc123... .mcp.json

set -euo pipefail

CONNECTOR_URL="${1:-}"
CONFIG_PATH="${2:-.mcp.json}"

if [[ -z "$CONNECTOR_URL" ]]; then
  echo "Usage: $0 <connector-url> [config-path]" >&2
  echo "Get your connector URL from the Hubmail dashboard (https://hubmail.anandu.xyz) after connecting a Gmail account." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "This script requires jq. Install it (e.g. 'brew install jq') and re-run." >&2
  exit 1
fi

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo '{"mcpServers": {}}' > "$CONFIG_PATH"
fi

TMP_FILE="$(mktemp)"
jq \
  --arg url "$CONNECTOR_URL" \
  '.mcpServers.hubmail = {"command": "npx", "args": ["-y", "mcp-remote", $url]}' \
  "$CONFIG_PATH" > "$TMP_FILE"
mv "$TMP_FILE" "$CONFIG_PATH"

echo "Added 'hubmail' MCP server to $CONFIG_PATH."
echo "Fully quit and reopen your MCP client to pick up the change."
