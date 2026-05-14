import { NextRequest, NextResponse } from 'next/server';
import { scrapeAllSources, listingToJobDetails } from '@/lib/scraper';
import { generateApplication } from '@/lib/claude';
import { sendEmail } from '@/lib/gmail';
import { sendWhatsApp, formatApplicationNotification } from '@/lib/whatsapp';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const listings = await scrapeAllSources();
    if (listings.length === 0) {
      await sendWhatsApp('🔍 Daily job scan complete — no matching jobs found today.');
      return NextResponse.json({ ok: true, processed: 0 });
    }

    const results = [];
    const top = listings.slice(0, 3);

    for (const listing of top) {
      try {
        const job = await listingToJobDetails(listing);
        const app = await generateApplication(job);

        if (app.matchScore < 60) {
          results.push({ company: job.company, skipped: true, reason: 'low match' });
          continue;
        }

        let emailId = '';
        let status: 'sent' | 'draft' | 'failed' = 'draft';

        const emailBody = `${app.emailBody}\n\n---\nJob URL: ${job.url}`;

        try {
          emailId = await sendEmail(
            process.env.GMAIL_FROM_EMAIL!,
            `[REVIEW] ${app.subject}`,
            emailBody,
            true
          );
          status = 'draft';
        } catch (e) {
          status = 'failed';
        }

        await sendWhatsApp(
          formatApplicationNotification(job.title, job.company, app.matchScore, app.emailBody, status)
        );

        results.push({
          company: job.company,
          title: job.title,
          matchScore: app.matchScore,
          status,
          emailId
        });

        await new Promise(r => setTimeout(r, 2000));
      } catch (e: any) {
        results.push({ company: listing.company, error: e.message });
      }
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
