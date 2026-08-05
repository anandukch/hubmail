export interface DraftInput {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

export function buildRawMessage({ to, subject, body }: DraftInput): string {
  const message = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset="UTF-8"', '', body].join(
    '\r\n',
  );

  return Buffer.from(message).toString('base64url');
}
