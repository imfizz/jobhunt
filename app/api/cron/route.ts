import { NextRequest, NextResponse } from 'next/server';
import { scrapeAllSources } from '@/lib/scraper';
import { runScan } from '@/lib/scan';
import { sendWhatsApp } from '@/lib/whatsapp';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.CRON_ENABLED === 'false') {
    return NextResponse.json({ ok: false, message: 'Cron is disabled. Set CRON_ENABLED=true to enable.' });
  }

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    const listings = await scrapeAllSources();
    console.log(`[DEV] Skipping Claude + WhatsApp. Found ${listings.length} listings:`);
    listings.slice(0, 5).forEach((l, i) => console.log(`  ${i + 1}. ${l.title} — ${l.company} (${l.source})`));
    return NextResponse.json({ ok: true, dev: true, message: 'Dev mode: Claude and WhatsApp skipped. Check terminal for listings.', count: listings.length });
  }

  try {
    const result = await runScan({
      minSalaryPHP: parseInt(process.env.JOB_MIN_SALARY_PHP || '120000')
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    await sendWhatsApp(`Job scan failed: ${e.message?.slice(0, 200) || 'Unknown error'}`).catch(() => {});
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
