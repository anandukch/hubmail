"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const crypto_1 = require("crypto");
const testing_1 = require("@nestjs/testing");
const mongoose_1 = require("@nestjs/mongoose");
const mongodb_memory_server_1 = require("mongodb-memory-server");
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
process.env.MONGODB_URI ??= 'placeholder-set-below';
process.env.GOOGLE_CLIENT_ID ??= 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET ??= 'test-client-secret';
process.env.GOOGLE_OAUTH_CALLBACK_URL ??= 'http://localhost:3000/oauth/google/callback';
process.env.PUBLIC_BASE_URL ??= 'http://localhost:3000';
process.env.TOKEN_ENCRYPTION_KEY ??= (0, crypto_1.randomBytes)(32).toString('hex');
process.env.JWT_SECRET ??= 'e2e-test-jwt-secret-value';
const app_module_1 = require("../src/app.module");
const user_schema_1 = require("../src/auth/schemas/user.schema");
const connected_account_schema_1 = require("../src/auth/schemas/connected-account.schema");
const token_refresh_service_1 = require("../src/auth/token-refresh.service");
const gmail_service_1 = require("../src/gmail/gmail.service");
const account_reauth_required_error_1 = require("../src/common/errors/account-reauth-required.error");
const mockTokenRefresh = { getValidAccessToken: jest.fn() };
const mockGmail = { searchMessages: jest.fn(), getMessage: jest.fn() };
let mongod;
let app;
let baseUrl;
let userModel;
let connectedAccountModel;
async function seedUser(mcpUserToken, aliases) {
    const user = await userModel.create({
        email: `${mcpUserToken}@example.com`,
        passwordHash: 'irrelevant-for-this-test',
        mcpUserToken,
    });
    for (const alias of aliases) {
        await connectedAccountModel.create({
            userId: user._id,
            alias,
            googleEmail: `${alias}@gmail.com`,
            encryptedRefreshToken: 'placeholder-ciphertext',
            scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        });
    }
    return user._id;
}
async function connectClient(userToken) {
    const client = new index_js_1.Client({ name: 'e2e-test-client', version: '1.0.0' });
    const transport = new streamableHttp_js_1.StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp/${userToken}`));
    await client.connect(transport);
    return client;
}
beforeAll(async () => {
    mongod = await mongodb_memory_server_1.MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    const moduleRef = await testing_1.Test.createTestingModule({ imports: [app_module_1.AppModule] })
        .overrideProvider(token_refresh_service_1.TokenRefreshService)
        .useValue(mockTokenRefresh)
        .overrideProvider(gmail_service_1.GmailService)
        .useValue(mockGmail)
        .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    baseUrl = await app.getUrl();
    userModel = moduleRef.get((0, mongoose_1.getModelToken)(user_schema_1.User.name));
    connectedAccountModel = moduleRef.get((0, mongoose_1.getModelToken)(connected_account_schema_1.ConnectedAccount.name));
}, 60000);
afterAll(async () => {
    await app.close();
    await mongod.stop();
});
beforeEach(() => {
    jest.resetAllMocks();
});
describe('MCP server (Streamable HTTP)', () => {
    it('returns 404 for an unknown connector token before touching the MCP protocol', async () => {
        const res = await fetch(`${baseUrl}/mcp/does-not-exist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        });
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.message).toMatch(/reconnect/i);
    });
    it('lists exactly the 3 spec tools', async () => {
        const userId = await seedUser('tok-list-tools', ['work']);
        void userId;
        const client = await connectClient('tok-list-tools');
        const { tools } = await client.listTools();
        expect(tools.map((t) => t.name).sort()).toEqual(['list_accounts', 'read_email', 'search_emails']);
        await client.close();
    });
    it('auto-selects the single connected account and returns real search results', async () => {
        await seedUser('tok-single-account', ['work']);
        mockTokenRefresh.getValidAccessToken.mockResolvedValue('fake-access-token');
        mockGmail.searchMessages.mockResolvedValue([
            { messageId: 'm1', subject: 'Hello', sender: 'a@b.com', snippet: 'hey there', date: '2024-01-01T00:00:00.000Z' },
        ]);
        const client = await connectClient('tok-single-account');
        const result = await client.callTool({ name: 'search_emails', arguments: { query: 'is:unread' } });
        expect(result.isError).toBeFalsy();
        expect(mockTokenRefresh.getValidAccessToken).toHaveBeenCalledWith(expect.any(String), 'work');
        expect(result.structuredContent?.results).toHaveLength(1);
        await client.close();
    });
    it('asks for clarification instead of guessing when multiple accounts are connected', async () => {
        await seedUser('tok-multi-account', ['work', 'personal']);
        const client = await connectClient('tok-multi-account');
        const result = await client.callTool({ name: 'search_emails', arguments: { query: 'invoice' } });
        expect(result.isError).toBeFalsy();
        const text = result.content[0].text;
        expect(text).toContain('Multiple accounts connected: personal, work');
        expect(text).toContain("'all' is not yet supported");
        expect(mockTokenRefresh.getValidAccessToken).not.toHaveBeenCalled();
        await client.close();
    });
    it('reports an unmatched alias without crashing (search_emails)', async () => {
        await seedUser('tok-unmatched-search', ['work']);
        const client = await connectClient('tok-unmatched-search');
        const result = await client.callTool({
            name: 'search_emails',
            arguments: { account: 'ghost', query: 'invoice' },
        });
        expect(result.isError).toBeFalsy();
        const text = result.content[0].text;
        expect(text).toContain("No account named 'ghost' is connected");
        expect(text).toContain('work');
        await client.close();
    });
    it('reports an unmatched alias without crashing (read_email)', async () => {
        await seedUser('tok-unmatched-read', ['work']);
        const client = await connectClient('tok-unmatched-read');
        const result = await client.callTool({
            name: 'read_email',
            arguments: { account: 'ghost', message_id: 'm1' },
        });
        expect(result.isError).toBeFalsy();
        const text = result.content[0].text;
        expect(text).toContain("No account named 'ghost' is connected");
        await client.close();
    });
    it('surfaces AccountReauthRequiredError as a clear, isError tool result', async () => {
        await seedUser('tok-reauth', ['work']);
        mockTokenRefresh.getValidAccessToken.mockRejectedValue(new account_reauth_required_error_1.AccountReauthRequiredError('work'));
        const client = await connectClient('tok-reauth');
        const result = await client.callTool({ name: 'search_emails', arguments: { query: 'invoice' } });
        expect(result.isError).toBe(true);
        const text = result.content[0].text;
        expect(text).toContain("'work' account needs to be reconnected");
        await client.close();
    });
});
//# sourceMappingURL=mcp.e2e-spec.js.map