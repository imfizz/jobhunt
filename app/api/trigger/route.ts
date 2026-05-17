import { NextRequest, NextResponse } from 'next/server';
import { runScan } from '@/lib/scan';
import { sendWhatsApp } from '@/lib/whatsapp';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { minSalaryPHP, secret } = await req.json();

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }

    const result = await runScan({ minSalaryPHP: minSalaryPHP || undefined });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    await sendWhatsApp(`Manual scan failed: ${e.message?.slice(0, 200)}`).catch(() => {});
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
