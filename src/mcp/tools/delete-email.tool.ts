import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ToolContext } from '../tool-context';
import { withToolErrorHandling } from '../mcp-error-mapper.util';

export function registerDeleteEmailTool(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'delete_email',
    {
      title: 'Delete email',
      description: 'Moves a single email to Trash by message id. This is recoverable (Gmail keeps trashed messages for 30 days), not a permanent delete.',
      inputSchema: {
        account: z.string().describe('Alias of the account the message belongs to'),
        message_id: z.string(),
      },
    },
    async ({ account, message_id }) =>
      withToolErrorHandling(ctx.logger, { userId: ctx.userId, tool: 'delete_email' }, async () => {
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
          throw new Error('Unexpected ambiguous account resolution for delete_email');
        }

        ctx.auditLog.log({ userId: ctx.userId, tool: 'delete_email', alias: resolution.alias, metadata: { message_id }, ip: ctx.ip });
        const accessToken = await ctx.tokenRefresh.getValidAccessToken(ctx.userId, resolution.alias);
        await ctx.gmail.trashMessage(accessToken, message_id);

        return {
          content: [{ type: 'text', text: `Message ${message_id} moved to Trash in '${resolution.alias}'.` }],
        };
      }),
  );
}
