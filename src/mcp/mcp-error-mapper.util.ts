import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AccountReauthRequiredError } from '../common/errors/account-reauth-required.error';
import { AccountNotFoundError } from '../common/errors/account-not-found.error';
import { GmailApiError } from '../gmail/gmail-api.error';
import { AppLoggerService } from '../common/app-logger.service';

function textResult(text: string, isError?: boolean): CallToolResult {
  return { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) };
}

export async function withToolErrorHandling(
  logger: AppLoggerService,
  context: { userId: string; tool: string },
  fn: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AccountReauthRequiredError) {
      return textResult(
        `The '${err.alias}' account needs to be reconnected. Please reconnect it from the dashboard.`,
        true,
      );
    }

    if (err instanceof AccountNotFoundError) {
      return textResult(`No account named '${err.alias}' is connected.`);
    }

    if (err instanceof GmailApiError) {
      logger.error('Gmail API call failed during tool execution', {
        userId: context.userId,
        tool: context.tool,
        status: err.status,
        message: err.message,
      });
      return textResult('Could not reach Gmail right now. Please try again in a moment.', true);
    }

    logger.error('Unhandled error during tool execution', {
      userId: context.userId,
      tool: context.tool,
      message: err instanceof Error ? err.message : String(err),
    });
    return textResult('Something went wrong handling this request. Please try again.', true);
  }
}
