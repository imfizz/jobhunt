import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/gmail';
import { sendWhatsApp, formatApplicationNotification } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, jobTitle, company, matchScore, draftOnly = false } = await req.json();
    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const id = await sendEmail(to, subject, body, draftOnly);

    await sendWhatsApp(
      formatApplicationNotification(
        jobTitle || subject,
        company || to,
        matchScore || 0,
        body,
        draftOnly ? 'draft' : 'sent'
      )
    );

    return NextResponse.json({ ok: true, id, status: draftOnly ? 'draft' : 'sent' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
