import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ToolContext } from '../tool-context';
import { withToolErrorHandling } from '../mcp-error-mapper.util';

export function registerCreateLabelTool(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'create_label',
    {
      title: 'Create label',
      description: 'Creates a Gmail label in a connected account. If a label with that name already exists, returns the existing one instead of erroring.',
      inputSchema: {
        account: z.string().describe('Alias of the account to create the label in'),
        name: z.string().describe('Label name, e.g. "xyz"'),
      },
      outputSchema: { label_id: z.string(), name: z.string() },
    },
    async ({ account, name }) =>
      withToolErrorHandling(ctx.logger, { userId: ctx.userId, tool: 'create_label' }, async () => {
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
          throw new Error('Unexpected ambiguous account resolution for create_label');
        }

        ctx.auditLog.log({ userId: ctx.userId, tool: 'create_label', alias: resolution.alias, metadata: { name }, ip: ctx.ip });
        const accessToken = await ctx.tokenRefresh.getValidAccessToken(ctx.userId, resolution.alias);
        const label = await ctx.gmail.findOrCreateLabel(accessToken, name);

        return {
          content: [{ type: 'text', text: `Label '${label.name}' ready in '${resolution.alias}' (id: ${label.id}).` }],
          structuredContent: { label_id: label.id, name: label.name },
        };
      }),
  );
}
