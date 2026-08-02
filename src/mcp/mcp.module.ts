import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { AccountResolverService } from './account-resolver.service';
import { McpServerFactory } from './mcp-server.factory';
import { AuditLogService } from './audit-log.service';
import { AuthModule } from '../auth/auth.module';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [AuthModule, GmailModule],
  controllers: [McpController],
  providers: [AccountResolverService, McpServerFactory, AuditLogService],
  exports: [AuditLogService],
})
export class McpModule {}
