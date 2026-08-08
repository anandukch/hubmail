import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ToolContext } from '../tool-context';
import { withToolErrorHandling } from '../mcp-error-mapper.util';

export function registerCreateMailFilterTool(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'create_mail_filter',
    {
      title: 'Create mail filter',
      description: 'Creates a Gmail filter so future emails matching a search query are automatically labeled (e.g. "from:bytebytego.com" -> label "ByteByteGo"), optionally skipping the Inbox. Applies only to mail that arrives after the filter is created, not existing mail — use label_email or move_email_to_label for mail that already exists. The label must already exist — create it first with create_label.',
      inputSchema: {
        account: z.string().describe('Alias of the account to create the filter in'),
        query: z.string().describe('Gmail search syntax matching future mail, e.g. "from:bytebytego.com" or "subject:invoice"'),
        label_name: z.string(),
        skip_inbox: z.boolean().describe('If true, matching mail skips Inbox (archived) as well as being labeled'),
      },
      outputSchema: { filter_id: z.string(), label_id: z.string() },
    },
    async ({ account, query, label_name, skip_inbox }) =>
      withToolErrorHandling(ctx.logger, { userId: ctx.userId, tool: 'create_mail_filter' }, async () => {
        const resolution = await ctx.accountResolver.resolve(ctx.userId, account);

        if (resolution.kind === 'no_accounts') {
          return {
            content: [
              { type: 'text', text: 'No Gmail accounts are connected yet. Please connect one from the dashboard.' },
            ],
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
          // Cannot happen: `account` is a required parameter for this tool, so resolve()
          // never takes the "no alias requested" branch that produces 'ambiguous'.
          throw new Error('Unexpected ambiguous account resolution for create_mail_filter');
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
          tool: 'create_mail_filter',
          alias: resolution.alias,
          metadata: { query, label: label.name, skip_inbox },
          ip: ctx.ip,
        });

        const { filterId } = await ctx.gmail.createFilter(accessToken, { query, labelId: label.id, skipInbox: skip_inbox });

        return {
          content: [
            {
              type: 'text',
              text: `Filter created in '${resolution.alias}': mail matching "${query}" will be labeled '${label.name}'${skip_inbox ? ' and skip Inbox' : ''} going forward.`,
            },
          ],
          structuredContent: { filter_id: filterId, label_id: label.id },
        };
      }),
  );
}
