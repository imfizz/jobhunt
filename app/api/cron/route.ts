import { NextRequest, NextResponse } from 'next/server';
import { scrapeAllSources, listingToJobDetails } from '@/lib/scraper';
import { generateApplication, analyzeRole, stripDashes } from '@/lib/claude';
import { sendEmail } from '@/lib/gmail';
import { sendWhatsApp, formatApplicationNotification } from '@/lib/whatsapp';

export const maxDuration = 60;

const MIN_APPLICATIONS = 3;
const MAX_APPLICATIONS = 5;
const MIN_CONFIDENCE = 70;
const MIN_MATCH_SCORE = 60;

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
    let scanned = 0;
    const skipped: any[] = [];

    // Pass 1: Strict filter, try to get MIN_APPLICATIONS at high confidence
    for (const listing of listings) {
      if (applied >= MAX_APPLICATIONS) break;
      scanned++;

      try {
        const job = await listingToJobDetails(listing);
        const analysis = await analyzeRole(job);

        if (analysis.recommendation === 'skip' || analysis.confidence < MIN_CONFIDENCE) {
          skipped.push({
            job,
            listing,
            analysis,
            reason: 'low confidence or skip recommendation'
          });
          continue;
        }

        const app = await generateApplication(job);

        if (app.matchScore < MIN_MATCH_SCORE) {
          skipped.push({
            job,
            listing,
            analysis,
            app,
            reason: 'low match score'
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

    // Pass 2: If we didn't hit minimum, fall back to relaxed criteria using already-analyzed jobs
    if (applied < MIN_APPLICATIONS && skipped.length > 0) {
      // Sort skipped by best confidence+match combo, take the best remaining
      const candidates = skipped
        .filter(s => s.app && s.analysis.confidence >= 50)
        .sort((a, b) => {
          const aScore = (a.app?.matchScore || 0) + (a.analysis?.confidence || 0);
          const bScore = (b.app?.matchScore || 0) + (b.analysis?.confidence || 0);
          return bScore - aScore;
        });

      for (const candidate of candidates) {
        if (applied >= MIN_APPLICATIONS) break;
        const { job, listing, analysis, app } = candidate;
        if (!app) continue;

        let emailId = '';
        let status: 'sent' | 'draft' | 'failed' = 'draft';
        const emailBody = stripDashes(`${app.emailBody}\n\n---\nJob URL: ${job.url}`);

        try {
          emailId = await sendEmail(
            process.env.GMAIL_FROM_EMAIL!,
            `[REVIEW: stretch fit] ${app.subject}`,
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
            roleReasoning: `(Stretch fit) ${analysis.reasoning}`
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
          stretchFit: true,
          emailId
        });

        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (applied === 0) {
      await sendWhatsApp(`Daily scan complete. Scanned ${listings.length} fresh jobs but none passed quality checks.`);
    } else {
      await sendWhatsApp(`Daily scan complete. ${applied} application drafts saved to Gmail. Review and send when ready.`);
    }

    return NextResponse.json({
      ok: true,
      applied,
      totalScanned: listings.length,
      results
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
