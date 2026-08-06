import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext } from '../tool-context';

export async function applyLabelToMessages(
  ctx: ToolContext,
  tool: string,
  { account, message_ids, label_name, removeFromInbox }: { account: string; message_ids: string[]; label_name: string; removeFromInbox: boolean },
): Promise<CallToolResult> {
  const resolution = await ctx.accountResolver.resolve(ctx.userId, account);

  if (resolution.kind === 'no_accounts') {
    return {
      content: [{ type: 'text', text: 'No Gmail accounts are connected yet. Please connect one from the dashboard.' }],
    };
  }

  if (resolution.kind === 'not_found') {
    return {
      content: [
        {
          type: 'text',
          text: `No account named '${resolution.alias}' is connected. Connected accounts: ${resolution.aliases.join(', ')}.`,
        },
      ],
    };
  }

  if (resolution.kind === 'ambiguous') {
    // Cannot happen: `account` is a required parameter for these tools, so resolve()
    // never takes the "no alias requested" branch that produces 'ambiguous'.
    throw new Error(`Unexpected ambiguous account resolution for ${tool}`);
  }

  const accessToken = await ctx.tokenRefresh.getValidAccessToken(ctx.userId, resolution.alias);
  const labels = await ctx.gmail.listLabels(accessToken);
  const label = labels.find((l) => l.name.toLowerCase() === label_name.toLowerCase());

  if (!label) {
    return {
      content: [
        {
          type: 'text',
          text: `No label named '${label_name}' exists in '${resolution.alias}'. Create it first with create_label.`,
        },
      ],
    };
  }

  ctx.auditLog.log({
    userId: ctx.userId,
    tool,
    alias: resolution.alias,
    metadata: { message_ids, label: label.name, remove_from_inbox: removeFromInbox },
    ip: ctx.ip,
  });

  const results = await Promise.all(
    message_ids.map(async (messageId) => {
      try {
        await ctx.gmail.modifyLabels(accessToken, messageId, {
          addLabelIds: [label.id],
          removeLabelIds: removeFromInbox ? ['INBOX'] : undefined,
        });
        return { message_id: messageId, ok: true };
      } catch (err) {
        return { message_id: messageId, ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );

  const okCount = results.filter((r) => r.ok).length;
  const verb = removeFromInbox ? 'Moved' : 'Applied label';
  const text = `${verb} '${label.name}' to ${okCount}/${results.length} message(s) in '${resolution.alias}'${removeFromInbox ? ' (removed from Inbox)' : ''}.`;

  return {
    content: [{ type: 'text', text }],
    structuredContent: { label_id: label.id, results },
  };
}
