import twilio from 'twilio';
import { stripDashes } from './claude';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function sendWhatsApp(message: string): Promise<void> {
  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM!,
      to: process.env.TWILIO_WHATSAPP_TO!,
      body: stripDashes(message)
    });
  } catch (e: any) {
    console.error('WhatsApp send failed:', e.message);
  }
}

interface NotificationOptions {
  jobTitle: string;
  company: string;
  matchScore: number;
  emailPreview: string;
  status: 'sent' | 'draft' | 'failed';
  jobUrl?: string;
  salary?: string;
  location?: string;
  source?: string;
  jobDescription?: string;
  primaryStack?: string[];
  roleReasoning?: string;
}

export function formatApplicationNotification(opts: NotificationOptions): string {
  const statusEmoji = opts.status === 'sent' ? '✅' : opts.status === 'draft' ? '📝' : '❌';

  const lines: string[] = [];
  lines.push(`${statusEmoji} *Job Application*`);
  lines.push('');
  lines.push(`*${opts.jobTitle}*`);
  lines.push(`🏢 ${opts.company}`);

  if (opts.location) lines.push(`📍 ${opts.location}`);
  if (opts.salary) lines.push(`💰 ${opts.salary}`);
  if (opts.source) lines.push(`🔎 Source: ${opts.source}`);
  if (opts.primaryStack && opts.primaryStack.length > 0) {
    lines.push(`🛠 Stack: ${opts.primaryStack.join(', ')}`);
  }

  lines.push(`⭐ Match: ${opts.matchScore}/100`);
  lines.push(`📊 Status: ${opts.status.toUpperCase()}`);

  if (opts.roleReasoning) {
    lines.push('');
    lines.push('*Why this fits:*');
    lines.push(opts.roleReasoning);
  }

  if (opts.jobUrl) {
    lines.push('');
    lines.push(`🔗 ${opts.jobUrl}`);
  }

  if (opts.jobDescription) {
    lines.push('');
    lines.push('*Job description:*');
    const trimmed = opts.jobDescription.length > 500
      ? opts.jobDescription.slice(0, 500) + '...'
      : opts.jobDescription;
    lines.push(trimmed);
  }

  lines.push('');
  lines.push('*Email preview:*');
  const previewTrimmed = opts.emailPreview.length > 300
    ? opts.emailPreview.slice(0, 300) + '...'
    : opts.emailPreview;
  lines.push(previewTrimmed);

  return stripDashes(lines.join('\n'));
}
