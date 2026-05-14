import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function sendWhatsApp(message: string): Promise<void> {
  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM!,
      to: process.env.TWILIO_WHATSAPP_TO!,
      body: message
    });
  } catch (e: any) {
    console.error('WhatsApp send failed:', e.message);
  }
}

export function formatApplicationNotification(
  jobTitle: string,
  company: string,
  matchScore: number,
  emailPreview: string,
  status: 'sent' | 'draft' | 'failed'
): string {
  const statusEmoji = status === 'sent' ? '✅' : status === 'draft' ? '📝' : '❌';
  return `${statusEmoji} *Job Application*

*${jobTitle}*
${company}
Match: ${matchScore}/100
Status: ${status.toUpperCase()}

Preview:
${emailPreview.slice(0, 200)}${emailPreview.length > 200 ? '…' : ''}`;
}
