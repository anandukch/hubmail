import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ToolContext } from '../tool-context';
import { withToolErrorHandling } from '../mcp-error-mapper.util';
import { applyLabelToMessages } from './apply-label.util';

export function registerLabelEmailTool(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'label_email',
    {
      title: 'Label email',
      description: 'Tags one or more emails with an existing label, by message id. The emails stay in Inbox — use move_email_to_label instead if they should be moved out of Inbox. The label must already exist — create it first with create_label.',
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
      withToolErrorHandling(ctx.logger, { userId: ctx.userId, tool: 'label_email' }, () =>
        applyLabelToMessages(ctx, 'label_email', { account, message_ids, label_name, removeFromInbox: false }),
      ),
  );
}
