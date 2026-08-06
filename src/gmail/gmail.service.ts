import { Injectable } from '@nestjs/common';
import { gmail_v1 } from 'googleapis';
import { buildGmailClient } from './gmail-client.factory';
import { extractBody } from './mime/mime-parser.util';
import { buildRawMessage, DraftInput } from './mime/mime-builder.util';
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

export interface GmailLabel {
  id: string;
  name: string;
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

  /** Moves the message to Trash. Recoverable — this is not a permanent delete. */
  async trashMessage(accessToken: string, messageId: string): Promise<void> {
    const gmail = buildGmailClient(accessToken);
    await this.call(() => gmail.users.messages.trash({ userId: 'me', id: messageId }));
  }

  async createDraft(accessToken: string, input: DraftInput): Promise<{ draftId: string; messageId: string }> {
    const gmail = buildGmailClient(accessToken);
    const raw = buildRawMessage(input);
    const draft = await this.call(() =>
      gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw, threadId: input.threadId } } }),
    );
    return { draftId: draft.data.id ?? '', messageId: draft.data.message?.id ?? '' };
  }

  async listLabels(accessToken: string): Promise<GmailLabel[]> {
    const gmail = buildGmailClient(accessToken);
    const response = await this.call(() => gmail.users.labels.list({ userId: 'me' }));
    return (response.data.labels ?? [])
      .filter((l): l is gmail_v1.Schema$Label & { id: string; name: string } => !!l.id && !!l.name)
      .map((l) => ({ id: l.id, name: l.name }));
  }

  /** Idempotent: returns the existing label if one with this name (case-insensitive) already exists. */
  async findOrCreateLabel(accessToken: string, name: string): Promise<GmailLabel> {
    const existing = await this.listLabels(accessToken);
    const match = existing.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (match) return match;

    const gmail = buildGmailClient(accessToken);
    const created = await this.call(() =>
      gmail.users.labels.create({
        userId: 'me',
        requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
      }),
    );
    return { id: created.data.id ?? '', name: created.data.name ?? name };
  }

  async modifyLabels(
    accessToken: string,
    messageId: string,
    { addLabelIds, removeLabelIds }: { addLabelIds?: string[]; removeLabelIds?: string[] },
  ): Promise<void> {
    const gmail = buildGmailClient(accessToken);
    await this.call(() =>
      gmail.users.messages.modify({ userId: 'me', id: messageId, requestBody: { addLabelIds, removeLabelIds } }),
    );
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
