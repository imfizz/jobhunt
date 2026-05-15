import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/gmail';
import { sendWhatsApp, formatApplicationNotification } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const {
      to,
      subject,
      body,
      jobTitle,
      company,
      matchScore,
      draftOnly = false,
      jobUrl,
      salary,
      location,
      source,
      jobDescription
    } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const id = await sendEmail(to, subject, body, draftOnly);

    await sendWhatsApp(
      formatApplicationNotification({
        jobTitle: jobTitle || subject,
        company: company || to,
        matchScore: matchScore || 0,
        emailPreview: body,
        status: draftOnly ? 'draft' : 'sent',
        jobUrl,
        salary,
        location,
        source,
        jobDescription
      })
    );

    return NextResponse.json({ ok: true, id, status: draftOnly ? 'draft' : 'sent' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
