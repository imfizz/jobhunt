import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/gmail';
import { sendWhatsApp, formatApplicationNotification } from '@/lib/whatsapp';
import { stripDashes } from '@/lib/claude';

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
      jobDescription,
      primaryStack,
      roleReasoning
    } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const cleanSubject = stripDashes(subject);
    const cleanBody = stripDashes(body);

    const id = await sendEmail(to, cleanSubject, cleanBody, draftOnly);

    await sendWhatsApp(
      formatApplicationNotification({
        jobTitle: jobTitle || cleanSubject,
        company: company || to,
        matchScore: matchScore || 0,
        emailPreview: cleanBody,
        status: draftOnly ? 'draft' : 'sent',
        jobUrl,
        salary,
        location,
        source,
        jobDescription,
        primaryStack,
        roleReasoning
      })
    );

    return NextResponse.json({ ok: true, id, status: draftOnly ? 'draft' : 'sent' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
