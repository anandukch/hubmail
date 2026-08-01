import { Controller, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { AccountResolverService } from './account-resolver.service';
import { McpServerFactory } from './mcp-server.factory';
import { AppLoggerService } from '../common/app-logger.service';

@Controller('mcp')
export class McpController {
  constructor(
    private readonly accountResolver: AccountResolverService,
    private readonly mcpServerFactory: McpServerFactory,
    private readonly logger: AppLoggerService,
  ) {}

  @Post(':userToken')
  async handle(@Param('userToken') userToken: string, @Req() req: Request, @Res() res: Response) {
    const userId = await this.accountResolver.resolveUserIdByToken(userToken);
    if (!userId) {
      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unknown connector URL. Please reconnect from the dashboard.' },
        id: null,
      });
      return;
    }

    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? req.socket.remoteAddress;
    const server = this.mcpServerFactory.createServer(userId, ip);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on('close', () => {
        transport.close();
        server.close();
      });
    } catch (err) {
      this.logger.error('Unhandled error handling MCP request', {
        userId,
        message: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  }
}
