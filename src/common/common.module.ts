import { Global, Module } from '@nestjs/common';
import { AppLoggerService } from './app-logger.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Global()
@Module({
  providers: [AppLoggerService, JwtAuthGuard],
  exports: [AppLoggerService, JwtAuthGuard]
})
export class CommonModule {}
