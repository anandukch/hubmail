import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ToolContext } from '../tool-context';
import { withToolErrorHandling } from '../mcp-error-mapper.util';

export function registerReadEmailTool(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'read_email',
    {
      title: 'Read email',
      description: 'Fetch the full body/content of a single email by message id.',
      inputSchema: {
        account: z.string().describe('Alias of the account the message belongs to'),
        message_id: z.string(),
      },
    },
    async ({ account, message_id }) =>
      withToolErrorHandling(ctx.logger, { userId: ctx.userId, tool: 'read_email' }, async () => {
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
          throw new Error('Unexpected ambiguous account resolution for read_email');
        }

        const accessToken = await ctx.tokenRefresh.getValidAccessToken(ctx.userId, resolution.alias);
        const email = await ctx.gmail.getMessage(accessToken, message_id);

        const attachmentsLine = email.attachmentFilenames.length
          ? `Attachments: ${email.attachmentFilenames.join(', ')}\n`
          : '';
        const text = `Subject: ${email.subject}\nFrom: ${email.sender}\nDate: ${email.date}\n${attachmentsLine}\n${email.body}`;

        return {
          content: [{ type: 'text', text }],
          structuredContent: {
            subject: email.subject,
            sender: email.sender,
            date: email.date,
            body: email.body,
            attachments: email.attachmentFilenames,
          },
        };
      }),
  );
}
