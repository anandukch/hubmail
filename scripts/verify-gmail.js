"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const mongoose_1 = require("@nestjs/mongoose");
const app_module_1 = require("../src/app.module");
const user_schema_1 = require("../src/auth/schemas/user.schema");
const token_refresh_service_1 = require("../src/auth/token-refresh.service");
const gmail_service_1 = require("../src/gmail/gmail.service");
const account_reauth_required_error_1 = require("../src/common/errors/account-reauth-required.error");
const account_not_found_error_1 = require("../src/common/errors/account-not-found.error");
async function main() {
    const [email, alias, query] = process.argv.slice(2);
    if (!email || !alias) {
        console.error('Usage: verify-gmail.ts <email> <alias> [query]');
        process.exit(1);
    }
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: ['error', 'warn'] });
    try {
        const userModel = app.get((0, mongoose_1.getModelToken)(user_schema_1.User.name));
        const tokenRefresh = app.get(token_refresh_service_1.TokenRefreshService);
        const gmail = app.get(gmail_service_1.GmailService);
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
    }
    catch (err) {
        if (err instanceof account_reauth_required_error_1.AccountReauthRequiredError) {
            console.error(`\nReauth required: account '${err.alias}' needs to be reconnected.`);
        }
        else if (err instanceof account_not_found_error_1.AccountNotFoundError) {
            console.error(`\nNo account named '${alias}' is connected for ${email}.`);
        }
        else {
            console.error('\nUnexpected error:', err);
        }
        process.exitCode = 1;
    }
    finally {
        await app.close();
    }
}
main();
//# sourceMappingURL=verify-gmail.js.map