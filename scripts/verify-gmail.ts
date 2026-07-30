/**
 * Stage 2 manual verification script.
 *
 * Loads a real ConnectedAccount from Mongo, resolves a valid access token
 * (decrypting + refreshing if needed), then exercises GmailService against
 * the real Gmail API. Not part of the app's runtime routes — run directly:
 *
 *   npx ts-node -r tsconfig-paths/register scripts/verify-gmail.ts <email> <alias> [query]
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import { User, UserDocument } from '../src/auth/schemas/user.schema';
import { TokenRefreshService } from '../src/auth/token-refresh.service';
import { GmailService } from '../src/gmail/gmail.service';
import { AccountReauthRequiredError } from '../src/common/errors/account-reauth-required.error';
import { AccountNotFoundError } from '../src/common/errors/account-not-found.error';

async function main() {
  const [email, alias, query] = process.argv.slice(2);
  if (!email || !alias) {
    console.error('Usage: verify-gmail.ts <email> <alias> [query]');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    const tokenRefresh = app.get(TokenRefreshService);
    const gmail = app.get(GmailService);

    const user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.error(`No user found with email '${email}'`);
      process.exit(1);
    }

    console.log(`Resolving access token for ${email} / '${alias}'...`);
    const accessToken = await tokenRefresh.getValidAccessToken(user._id.toString(), alias);
    console.log('Got a valid access token.\n');

    const searchQuery = query ?? 'in:inbox';
    console.log(`Searching: "${searchQuery}" (max 5 results)...`);
    const summaries = await gmail.searchMessages(accessToken, searchQuery, 5);
    console.log(`Found ${summaries.length} message(s):\n`);
    for (const s of summaries) {
      console.log(`  [${s.messageId}] ${s.subject}`);
      console.log(`    from: ${s.sender}  date: ${s.date}`);
      console.log(`    snippet: ${s.snippet}\n`);
    }

    if (summaries.length > 0) {
      const first = summaries[0];
      console.log(`Reading full content of [${first.messageId}]...\n`);
      const content = await gmail.getMessage(accessToken, first.messageId);
      console.log(`  subject: ${content.subject}`);
      console.log(`  from: ${content.sender}`);
      console.log(`  date: ${content.date}`);
      console.log(`  attachments: ${content.attachmentFilenames.join(', ') || '(none)'}`);
      console.log(`  body (first 500 chars):\n${content.body.slice(0, 500)}`);
    }
  } catch (err) {
    if (err instanceof AccountReauthRequiredError) {
      console.error(`\nReauth required: account '${err.alias}' needs to be reconnected.`);
    } else if (err instanceof AccountNotFoundError) {
      console.error(`\nNo account named '${alias}' is connected for ${email}.`);
    } else {
      console.error('\nUnexpected error:', err);
    }
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main();
