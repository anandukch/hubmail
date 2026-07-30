import { gmail_v1 } from 'googleapis';
import { convert } from 'html-to-text';

export interface ParsedEmailBody {
  text: string;
  attachmentFilenames: string[];
}

type MessagePart = gmail_v1.Schema$MessagePart;

export function extractBody(payload: MessagePart | undefined): ParsedEmailBody {
  if (!payload) {
    return { text: '', attachmentFilenames: [] };
  }

  const plainText = findPartByMimeType(payload, 'text/plain');
  const attachmentFilenames = collectAttachmentFilenames(payload);

  if (plainText) {
    return { text: decodePartData(plainText), attachmentFilenames };
  }

  const htmlPart = findPartByMimeType(payload, 'text/html');
  if (htmlPart) {
    const html = decodePartData(htmlPart);
    return { text: convert(html, { wordwrap: false }), attachmentFilenames };
  }

  return { text: '', attachmentFilenames };
}

function findPartByMimeType(part: MessagePart, mimeType: string): MessagePart | undefined {
  if (part.mimeType === mimeType && part.body?.data) {
    return part;
  }
  for (const child of part.parts ?? []) {
    const found = findPartByMimeType(child, mimeType);
    if (found) return found;
  }
  return undefined;
}

function collectAttachmentFilenames(part: MessagePart): string[] {
  const filenames: string[] = [];
  if (part.filename) {
    filenames.push(part.filename);
  }
  for (const child of part.parts ?? []) {
    filenames.push(...collectAttachmentFilenames(child));
  }
  return filenames;
}

function decodePartData(part: MessagePart): string {
  const data = part.body?.data;
  if (!data) return '';
  return Buffer.from(data, 'base64url').toString('utf8');
}
