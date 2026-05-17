import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsApp } from '@/lib/whatsapp';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await sendWhatsApp('WhatsApp test message from Job Hunt bot. Twilio is working correctly.');
    return NextResponse.json({ ok: true, message: 'WhatsApp sent' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
