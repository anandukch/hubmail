import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AccountResolverService } from './account-resolver.service';
import { TokenRefreshService } from '../auth/token-refresh.service';
import { GmailService } from '../gmail/gmail.service';
import { AppLoggerService } from '../common/app-logger.service';
import { AuditLogService } from './audit-log.service';
import { ToolContext } from './tool-context';
import { registerListAccountsTool } from './tools/list-accounts.tool';
import { registerSearchEmailsTool } from './tools/search-emails.tool';
import { registerReadEmailTool } from './tools/read-email.tool';
import { registerDeleteEmailTool } from './tools/delete-email.tool';
import { registerDraftEmailTool } from './tools/draft-email.tool';
import { registerCreateLabelTool } from './tools/create-label.tool';
import { registerLabelEmailTool } from './tools/label-email.tool';
import { registerMoveEmailToLabelTool } from './tools/move-email-to-label.tool';

@Injectable()
export class McpServerFactory {
  constructor(
    private readonly accountResolver: AccountResolverService,
    private readonly tokenRefresh: TokenRefreshService,
    private readonly gmail: GmailService,
    private readonly logger: AppLoggerService,
    private readonly auditLog: AuditLogService,
  ) {}

  createServer(userId: string, ip?: string): McpServer {
    const server = new McpServer({ name: 'hubmail', version: '0.1.0' });

    const ctx: ToolContext = {
      userId,
      ip,
      accountResolver: this.accountResolver,
      tokenRefresh: this.tokenRefresh,
      gmail: this.gmail,
      logger: this.logger,
      auditLog: this.auditLog,
    };

    registerListAccountsTool(server, ctx);
    registerSearchEmailsTool(server, ctx);
    registerReadEmailTool(server, ctx);
    registerDeleteEmailTool(server, ctx);
    registerDraftEmailTool(server, ctx);
    registerCreateLabelTool(server, ctx);
    registerLabelEmailTool(server, ctx);
    registerMoveEmailToLabelTool(server, ctx);

    return server;
  }
}
