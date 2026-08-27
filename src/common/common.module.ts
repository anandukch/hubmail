import { Global, Module } from '@nestjs/common';
import { AppLoggerService } from './app-logger.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { HealthController } from './health.controller';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [HealthController],
  providers: [AppLoggerService, JwtAuthGuard],
  exports: [AppLoggerService, JwtAuthGuard]
})
export class CommonModule {}
