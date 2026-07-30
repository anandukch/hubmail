import { Injectable, Logger } from '@nestjs/common';

export interface LogContext {
  userId?: string;
  alias?: string;
  tool?: string;
  [key: string]: unknown;
}

@Injectable()
export class AppLoggerService {
  private readonly logger = new Logger('Hubmail');

  log(message: string, context?: LogContext) {
    this.logger.log(this.format(message, context));
  }

  warn(message: string, context?: LogContext) {
    this.logger.warn(this.format(message, context));
  }

  error(message: string, context?: LogContext) {
    this.logger.error(this.format(message, context));
  }

  private format(message: string, context?: LogContext): string {
    if (!context) return message;
    return `${message} ${JSON.stringify(context)}`;
  }
}
