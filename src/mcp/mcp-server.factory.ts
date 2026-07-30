import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AccountResolverService } from './account-resolver.service';
import { TokenRefreshService } from '../auth/token-refresh.service';
import { GmailService } from '../gmail/gmail.service';
import { AppLoggerService } from '../common/app-logger.service';
import { ToolContext } from './tool-context';
import { registerListAccountsTool } from './tools/list-accounts.tool';
import { registerSearchEmailsTool } from './tools/search-emails.tool';
import { registerReadEmailTool } from './tools/read-email.tool';

@Injectable()
export class McpServerFactory {
  constructor(
    private readonly accountResolver: AccountResolverService,
    private readonly tokenRefresh: TokenRefreshService,
    private readonly gmail: GmailService,
    private readonly logger: AppLoggerService,
  ) {}

  createServer(userId: string): McpServer {
    const server = new McpServer({ name: 'hubmail', version: '0.1.0' });

    const ctx: ToolContext = {
      userId,
      accountResolver: this.accountResolver,
      tokenRefresh: this.tokenRefresh,
      gmail: this.gmail,
      logger: this.logger,
    };

    registerListAccountsTool(server, ctx);
    registerSearchEmailsTool(server, ctx);
    registerReadEmailTool(server, ctx);

    return server;
  }
}
