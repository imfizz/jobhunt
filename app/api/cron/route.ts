import { NextRequest, NextResponse } from 'next/server';
import { scrapeAllSources, listingToJobDetails } from '@/lib/scraper';
import { generateApplication, analyzeRole, stripDashes } from '@/lib/claude';
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
      await sendWhatsApp('Daily job scan complete. No fresh jobs (within 3 days) found today.');
      return NextResponse.json({ ok: true, processed: 0 });
    }

    const results: any[] = [];
    let applied = 0;
    const MAX_APPLICATIONS = 3;

    for (const listing of listings) {
      if (applied >= MAX_APPLICATIONS) break;

      try {
        const job = await listingToJobDetails(listing);

        const analysis = await analyzeRole(job);

        if (analysis.recommendation === 'skip' || analysis.confidence < 70) {
          results.push({
            company: job.company,
            title: job.title,
            skipped: true,
            reason: analysis.reasoning,
            primaryStack: analysis.primaryStack
          });
          continue;
        }

        const app = await generateApplication(job);

        if (app.matchScore < 60) {
          results.push({
            company: job.company,
            title: job.title,
            skipped: true,
            reason: 'low match score after generation'
          });
          continue;
        }

        let emailId = '';
        let status: 'sent' | 'draft' | 'failed' = 'draft';

        const emailBody = stripDashes(`${app.emailBody}\n\n---\nJob URL: ${job.url}`);

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
          formatApplicationNotification({
            jobTitle: job.title,
            company: job.company,
            matchScore: app.matchScore,
            emailPreview: app.emailBody,
            status,
            jobUrl: job.url,
            salary: job.salary,
            location: job.location,
            source: (listing as any).source,
            jobDescription: job.description,
            primaryStack: analysis.primaryStack,
            roleReasoning: analysis.reasoning
          })
        );

        applied++;
        results.push({
          company: job.company,
          title: job.title,
          matchScore: app.matchScore,
          analysisConfidence: analysis.confidence,
          primaryStack: analysis.primaryStack,
          status,
          emailId
        });

        await new Promise(r => setTimeout(r, 2000));
      } catch (e: any) {
        results.push({ company: listing.company, error: e.message });
      }
    }

    if (applied === 0) {
      await sendWhatsApp('Daily job scan complete. Found fresh jobs but none passed the AI fit check.');
    }

    return NextResponse.json({ ok: true, processed: applied, totalScanned: listings.length, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
