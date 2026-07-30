import { gmail_v1 } from 'googleapis';
import { extractBody } from './mime-parser.util';

function b64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64url');
}

type Part = gmail_v1.Schema$MessagePart;

describe('extractBody', () => {
  it('extracts a plain-text-only email', () => {
    const payload: Part = {
      mimeType: 'text/plain',
      body: { data: b64('Hello, this is plain text.') },
    };

    const result = extractBody(payload);

    expect(result.text).toEqual('Hello, this is plain text.');
    expect(result.attachmentFilenames).toEqual([]);
  });

  it('falls back to stripped text/html when no text/plain part exists', () => {
    const payload: Part = {
      mimeType: 'text/html',
      body: { data: b64('<p>Hello <b>world</b></p>') },
    };

    const result = extractBody(payload);

    expect(result.text).toContain('Hello');
    expect(result.text).toContain('world');
    expect(result.text).not.toContain('<p>');
  });

  it('prefers text/plain over text/html in a multipart/alternative payload', () => {
    const payload: Part = {
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/plain', body: { data: b64('Plain version') } },
        { mimeType: 'text/html', body: { data: b64('<p>HTML version</p>') } },
      ],
    };

    const result = extractBody(payload);

    expect(result.text).toEqual('Plain version');
  });

  it('collects attachment filenames from a multipart/mixed payload without including them in the body', () => {
    const payload: Part = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [{ mimeType: 'text/plain', body: { data: b64('See attached.') } }],
        },
        {
          mimeType: 'application/pdf',
          filename: 'invoice.pdf',
          body: { attachmentId: 'abc123', size: 1000 },
        },
        {
          mimeType: 'image/jpeg',
          filename: 'receipt.jpg',
          body: { attachmentId: 'def456', size: 2000 },
        },
      ],
    };

    const result = extractBody(payload);

    expect(result.text).toEqual('See attached.');
    expect(result.attachmentFilenames).toEqual(['invoice.pdf', 'receipt.jpg']);
  });

  it('returns empty text when payload is undefined', () => {
    expect(extractBody(undefined)).toEqual({ text: '', attachmentFilenames: [] });
  });

  it('returns empty text when neither text/plain nor text/html parts have data', () => {
    const payload: Part = { mimeType: 'multipart/mixed', parts: [] };
    expect(extractBody(payload)).toEqual({ text: '', attachmentFilenames: [] });
  });
});
