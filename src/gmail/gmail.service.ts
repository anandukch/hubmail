import { Injectable } from '@nestjs/common';
import { gmail_v1 } from 'googleapis';
import { buildGmailClient } from './gmail-client.factory';
import { extractBody } from './mime/mime-parser.util';
import { GmailApiError } from './gmail-api.error';

export interface EmailSummary {
  messageId: string;
  subject: string;
  sender: string;
  snippet: string;
  date: string;
}

export interface EmailContent {
  messageId: string;
  subject: string;
  sender: string;
  date: string;
  body: string;
  attachmentFilenames: string[];
}

const SUMMARY_HEADERS = ['Subject', 'From', 'Date'];

@Injectable()
export class GmailService {
  async searchMessages(accessToken: string, query: string, maxResults: number): Promise<EmailSummary[]> {
    const gmail = buildGmailClient(accessToken);

    const listResponse = await this.call(() =>
      gmail.users.messages.list({ userId: 'me', q: query, maxResults }),
    );
    const ids = (listResponse.data.messages ?? []).map((m) => m.id).filter((id): id is string => !!id);

    return Promise.all(
      ids.map(async (id) => {
        const message = await this.call(() =>
          gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
            metadataHeaders: SUMMARY_HEADERS,
          }),
        );
        return this.toSummary(message.data);
      }),
    );
  }

  async getMessage(accessToken: string, messageId: string): Promise<EmailContent> {
    const gmail = buildGmailClient(accessToken);
    const message = await this.call(() =>
      gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' }),
    );
    return this.toContent(message.data);
  }

  private toSummary(message: gmail_v1.Schema$Message): EmailSummary {
    const headers = message.payload?.headers ?? [];
    return {
      messageId: message.id ?? '',
      subject: this.header(headers, 'Subject') ?? '(no subject)',
      sender: this.header(headers, 'From') ?? '(unknown sender)',
      snippet: message.snippet ?? '',
      date: this.toIsoDate(this.header(headers, 'Date')),
    };
  }

  private toContent(message: gmail_v1.Schema$Message): EmailContent {
    const headers = message.payload?.headers ?? [];
    const { text, attachmentFilenames } = extractBody(message.payload);
    return {
      messageId: message.id ?? '',
      subject: this.header(headers, 'Subject') ?? '(no subject)',
      sender: this.header(headers, 'From') ?? '(unknown sender)',
      date: this.toIsoDate(this.header(headers, 'Date')),
      body: text,
      attachmentFilenames,
    };
  }

  private header(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string | undefined {
    return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
  }

  private toIsoDate(rawDate: string | undefined): string {
    if (!rawDate) return '';
    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? rawDate : parsed.toISOString();
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const status = this.extractStatus(err);
      const message = err instanceof Error ? err.message : String(err);
      throw new GmailApiError(`Gmail API request failed: ${message}`, status);
    }
  }

  private extractStatus(err: unknown): number | undefined {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code?: unknown }).code;
      return typeof code === 'number' ? code : undefined;
    }
    return undefined;
  }
}
