import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { AppConfig } from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { GmailModule } from './gmail/gmail.module';
import { McpModule } from './mcp/mcp.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        uri: config.get('mongodbUri', { infer: true }),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'web', 'dist'),
      exclude: ['/auth/(.*)', '/oauth/(.*)', '/mcp/(.*)'],
    }),
    CommonModule,
    AuthModule,
    GmailModule,
    McpModule,
  ],
})
export class AppModule {}
