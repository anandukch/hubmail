import { GmailService } from './gmail.service';
import { GmailApiError } from './gmail-api.error';
import * as clientFactory from './gmail-client.factory';

jest.mock('./gmail-client.factory');

function b64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64url');
}

describe('GmailService', () => {
  let service: GmailService;
  let messagesList: jest.Mock;
  let messagesGet: jest.Mock;

  beforeEach(() => {
    service = new GmailService();
    messagesList = jest.fn();
    messagesGet = jest.fn();

    (clientFactory.buildGmailClient as jest.Mock).mockReturnValue({
      users: { messages: { list: messagesList, get: messagesGet } },
    });
  });

  describe('searchMessages', () => {
    it('maps list + per-message metadata into summaries', async () => {
      messagesList.mockResolvedValue({ data: { messages: [{ id: 'm1' }, { id: 'm2' }] } });
      messagesGet.mockImplementation(({ id }: { id: string }) =>
        Promise.resolve({
          data: {
            id,
            snippet: `snippet for ${id}`,
            payload: {
              headers: [
                { name: 'Subject', value: `Subject ${id}` },
                { name: 'From', value: 'sender@example.com' },
                { name: 'Date', value: 'Wed, 01 Jan 2025 10:00:00 +0000' },
              ],
            },
          },
        }),
      );

      const results = await service.searchMessages('token', 'is:unread', 10);

      expect(messagesList).toHaveBeenCalledWith({ userId: 'me', q: 'is:unread', maxResults: 10 });
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        messageId: 'm1',
        subject: 'Subject m1',
        sender: 'sender@example.com',
        snippet: 'snippet for m1',
        date: new Date('Wed, 01 Jan 2025 10:00:00 +0000').toISOString(),
      });
    });

    it('returns an empty array when there are no matching messages', async () => {
      messagesList.mockResolvedValue({ data: {} });
      const results = await service.searchMessages('token', 'is:unread', 10);
      expect(results).toEqual([]);
      expect(messagesGet).not.toHaveBeenCalled();
    });

    it('wraps Gmail API failures in a GmailApiError with the status preserved', async () => {
      messagesList.mockRejectedValue(Object.assign(new Error('invalid_grant'), { code: 401 }));

      await expect(service.searchMessages('token', 'is:unread', 10)).rejects.toMatchObject({
        name: 'GmailApiError',
        status: 401,
      });
    });
  });

  describe('getMessage', () => {
    it('parses the full message into subject/sender/date/body/attachments', async () => {
      messagesGet.mockResolvedValue({
        data: {
          id: 'm1',
          payload: {
            headers: [
              { name: 'Subject', value: 'Invoice' },
              { name: 'From', value: 'billing@example.com' },
              { name: 'Date', value: 'Wed, 01 Jan 2025 10:00:00 +0000' },
            ],
            mimeType: 'multipart/mixed',
            parts: [
              { mimeType: 'text/plain', body: { data: b64('Please find attached.') } },
              { mimeType: 'application/pdf', filename: 'invoice.pdf', body: { attachmentId: 'a1' } },
            ],
          },
        },
      });

      const result = await service.getMessage('token', 'm1');

      expect(result).toEqual({
        messageId: 'm1',
        subject: 'Invoice',
        sender: 'billing@example.com',
        date: new Date('Wed, 01 Jan 2025 10:00:00 +0000').toISOString(),
        body: 'Please find attached.',
        attachmentFilenames: ['invoice.pdf'],
      });
    });

    it('throws GmailApiError instead of a raw exception when the message cannot be fetched', async () => {
      messagesGet.mockRejectedValue(Object.assign(new Error('Not Found'), { code: 404 }));

      await expect(service.getMessage('token', 'missing')).rejects.toBeInstanceOf(GmailApiError);
    });
  });
});
