import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ToolContext } from '../tool-context';
import { withToolErrorHandling } from '../mcp-error-mapper.util';

export function registerSearchEmailsTool(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'search_emails',
    {
      title: 'Search emails',
      description: 'Search Gmail using Gmail search syntax across one connected account.',
      inputSchema: {
        account: z
          .string()
          .optional()
          .describe('Alias of the account to search, e.g. "work". If multiple accounts are connected and the user has not specified one, you MUST ask the user which account to use before calling this tool.'),
        query: z.string().describe('Gmail search syntax, e.g. "from:boss subject:invoice"'),
        max_results: z.number().int().positive().max(50).default(10),
      },
    },
    async ({ account, query, max_results }) =>
      withToolErrorHandling(ctx.logger, { userId: ctx.userId, tool: 'search_emails' }, async () => {
        const resolution = await ctx.accountResolver.resolve(ctx.userId, account);

        if (resolution.kind === 'no_accounts') {
          return {
            content: [
              { type: 'text', text: 'No Gmail accounts are connected yet. Please connect one from the dashboard.' },
            ],
          };
        }

        if (resolution.kind === 'ambiguous') {
          return {
            content: [
              {
                type: 'text',
                text: `Multiple accounts connected: ${resolution.aliases.join(', ')}. Please ask the user which account to use, or 'all' — but note 'all' is not yet supported, only single-account queries.`,
              },
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

        ctx.auditLog.log({ userId: ctx.userId, tool: 'search_emails', alias: resolution.alias, metadata: { query, max_results }, ip: ctx.ip });
        const accessToken = await ctx.tokenRefresh.getValidAccessToken(ctx.userId, resolution.alias);
        const results = await ctx.gmail.searchMessages(accessToken, query, max_results);

        const text =
          results.length === 0
            ? `No messages matched "${query}" in '${resolution.alias}'.`
            : results
                .map((r) => `[${r.messageId}] ${r.subject} — ${r.sender} (${r.date})\n  ${r.snippet}`)
                .join('\n\n');

        return {
          content: [{ type: 'text', text }],
          structuredContent: {
            results: results.map((r) => ({
              message_id: r.messageId,
              subject: r.subject,
              sender: r.sender,
              snippet: r.snippet,
              date: r.date,
            })),
          },
        };
      }),
  );
}
