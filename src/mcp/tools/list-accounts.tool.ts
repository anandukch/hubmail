import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ToolContext } from '../tool-context';
import { withToolErrorHandling } from '../mcp-error-mapper.util';

export function registerListAccountsTool(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'list_accounts',
    {
      title: 'List connected Gmail accounts',
      description: 'Returns the aliases of Gmail accounts connected for this user.',
      inputSchema: {},
      outputSchema: { accounts: z.array(z.string()) },
    },
    async () =>
      withToolErrorHandling(ctx.logger, { userId: ctx.userId, tool: 'list_accounts' }, async () => {
        const aliases = await ctx.accountResolver.listAliases(ctx.userId);
        const text =
          aliases.length === 0
            ? 'No Gmail accounts are connected yet. Please connect one from the dashboard.'
            : `Connected accounts: ${aliases.join(', ')}`;

        return {
          content: [{ type: 'text', text }],
          structuredContent: { accounts: aliases },
        };
      }),
  );
}
