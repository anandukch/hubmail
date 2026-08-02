import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GoogleOauthController } from './google-oauth.controller';
import { GoogleOauthService } from './google-oauth.service';
import { TokenRefreshService } from './token-refresh.service';
import { EncryptionService } from './encryption.service';
import { OauthStateService } from './oauth-state.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User, UserSchema } from './schemas/user.schema';
import { ConnectedAccount, ConnectedAccountSchema } from './schemas/connected-account.schema';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ConnectedAccount.name, schema: ConnectedAccountSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  controllers: [GoogleOauthController, AuthController],
  providers: [GoogleOauthService, TokenRefreshService, EncryptionService, OauthStateService, AuthService],
  exports: [TokenRefreshService, MongooseModule],
})
export class AuthModule {}
