import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ToolContext } from '../tool-context';
import { withToolErrorHandling } from '../mcp-error-mapper.util';

export function registerDraftEmailTool(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'draft_email',
    {
      title: 'Draft email',
      description: 'Creates a draft email in a connected account. Does not send it — the user must review and send it from Gmail themselves.',
      inputSchema: {
        account: z.string().describe('Alias of the account to create the draft in'),
        to: z.string().describe('Recipient email address'),
        subject: z.string(),
        body: z.string().describe('Plain-text body of the email'),
      },
      outputSchema: { draft_id: z.string(), message_id: z.string() },
    },
    async ({ account, to, subject, body }) =>
      withToolErrorHandling(ctx.logger, { userId: ctx.userId, tool: 'draft_email' }, async () => {
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
          throw new Error('Unexpected ambiguous account resolution for draft_email');
        }

        ctx.auditLog.log({ userId: ctx.userId, tool: 'draft_email', alias: resolution.alias, metadata: { to, subject }, ip: ctx.ip });
        const accessToken = await ctx.tokenRefresh.getValidAccessToken(ctx.userId, resolution.alias);
        const draft = await ctx.gmail.createDraft(accessToken, { to, subject, body });

        return {
          content: [{ type: 'text', text: `Draft created in '${resolution.alias}' (draft id: ${draft.draftId}).` }],
          structuredContent: { draft_id: draft.draftId, message_id: draft.messageId },
        };
      }),
  );
}
