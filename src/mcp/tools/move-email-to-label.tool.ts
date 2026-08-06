import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ToolContext } from '../tool-context';
import { withToolErrorHandling } from '../mcp-error-mapper.util';
import { applyLabelToMessages } from './apply-label.util';

export function registerMoveEmailToLabelTool(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'move_email_to_label',
    {
      title: 'Move email to label',
      description: 'Moves one or more emails out of Inbox into an existing label, by message id — tags them with the label and archives them (removes the INBOX label), like moving mail into a folder. The label must already exist — create it first with create_label. Use label_email instead if the emails should just be tagged and stay in Inbox.',
      inputSchema: {
        account: z.string().describe('Alias of the account the messages belong to'),
        message_ids: z.array(z.string()).min(1),
        label_name: z.string(),
      },
      outputSchema: {
        label_id: z.string(),
        results: z.array(z.object({ message_id: z.string(), ok: z.boolean(), error: z.string().optional() })),
      },
    },
    async ({ account, message_ids, label_name }) =>
      withToolErrorHandling(ctx.logger, { userId: ctx.userId, tool: 'move_email_to_label' }, () =>
        applyLabelToMessages(ctx, 'move_email_to_label', { account, message_ids, label_name, removeFromInbox: true }),
      ),
  );
}
