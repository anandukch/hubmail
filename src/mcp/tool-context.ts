import { AccountResolverService } from './account-resolver.service';
import { TokenRefreshService } from '../auth/token-refresh.service';
import { GmailService } from '../gmail/gmail.service';
import { AppLoggerService } from '../common/app-logger.service';

export interface ToolContext {
  userId: string;
  accountResolver: AccountResolverService;
  tokenRefresh: TokenRefreshService;
  gmail: GmailService;
  logger: AppLoggerService;
}
