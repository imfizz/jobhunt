import { google } from 'googleapis';

function getAuth() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return oauth2;
}

function makeRawEmail(from: string, to: string, subject: string, body: string): string {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0'
  ];
  const message = `${headers.join('\r\n')}\r\n\r\n${body}`;
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendEmail(to: string, subject: string, body: string, draftOnly = false): Promise<string> {
  const from = process.env.GMAIL_FROM_EMAIL!;
  const gmail = google.gmail({ version: 'v1', auth: getAuth() });
  const raw = makeRawEmail(from, to, subject, body);

  if (draftOnly) {
    const res = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: { message: { raw } }
    });
    return res.data.id || '';
  } else {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw }
    });
    return res.data.id || '';
  }
}
