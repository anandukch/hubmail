import { Global, Module } from '@nestjs/common';
import { AppLoggerService } from './app-logger.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { HealthController } from './health.controller';

@Global()
@Module({
  controllers: [HealthController],
  providers: [AppLoggerService, JwtAuthGuard],
  exports: [AppLoggerService, JwtAuthGuard]
})
export class CommonModule {}
