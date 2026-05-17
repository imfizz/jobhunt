import { scrapeAllSources, listingToJobDetails } from './scraper';
import { generateApplication, analyzeRole, stripDashes } from './claude';
import { sendEmail } from './gmail';
import { sendWhatsApp, formatApplicationNotification } from './whatsapp';
import fs from 'fs';
import path from 'path';

const MAX_APPLICATIONS = 5;
const MIN_CONFIDENCE = 60;

export interface ScanOptions {
  minSalaryPHP?: number;
}

export interface ScanJobResult {
  company: string;
  title: string;
  matchScore?: number;
  analysisConfidence?: number;
  primaryStack?: string[];
  status?: string;
  emailId?: string;
  error?: string;
}

export interface ScanResult {
  applied: number;
  totalScanned: number;
  totalAnalyzed: number;
  results: ScanJobResult[];
  skipReasons: Record<string, number>;
}

export async function runScan(options: ScanOptions = {}): Promise<ScanResult> {
  const minSalaryPHP = options.minSalaryPHP ?? parseInt(process.env.JOB_MIN_SALARY_PHP || '120000');

  await sendWhatsApp('Job scan started. Fetching fresh listings...');

  const listings = await scrapeAllSources();

  if (listings.length === 0) {
    await sendWhatsApp('Job scan complete. No fresh jobs (within 7 days) found today.');
    return { applied: 0, totalScanned: 0, totalAnalyzed: 0, results: [], skipReasons: {} };
  }

  await sendWhatsApp(`Found ${listings.length} fresh listings. Analyzing now...`);

  type QualifiedJob = {
    job: Awaited<ReturnType<typeof listingToJobDetails>>;
    listing: typeof listings[number];
    analysis: Awaited<ReturnType<typeof analyzeRole>>;
  };

  const qualified: QualifiedJob[] = [];
  const skipReasons: Record<string, number> = {};

  for (const listing of listings) {
    if (qualified.length >= MAX_APPLICATIONS) break;
    try {
      const job = await listingToJobDetails(listing);
      const analysis = await analyzeRole(job, { minSalaryPHP });
      if (analysis.recommendation === 'apply' && analysis.confidence >= MIN_CONFIDENCE) {
        qualified.push({ job, listing, analysis });
      } else {
        const reason = analysis.recommendation === 'skip'
          ? (!analysis.isJSFocused ? 'not JS stack' : !analysis.isRemote ? 'not remote' : !analysis.meetsSalary ? 'low salary' : !analysis.isFullstackOrRelated ? 'unrelated role' : 'skipped')
          : `low confidence (${analysis.confidence}%)`;
        skipReasons[reason] = (skipReasons[reason] || 0) + 1;
      }
    } catch (e: any) {
      console.error(`Analysis failed for ${listing.company}:`, e.message);
      skipReasons['analysis error'] = (skipReasons['analysis error'] || 0) + 1;
    }
  }

  const analyzedCount = qualified.length + Object.values(skipReasons).reduce((a, b) => a + b, 0);
  const notAnalyzed = listings.length - analyzedCount;
  const skipSummary = Object.entries(skipReasons)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => `${count} ${reason}`)
    .join(', ');

  if (qualified.length === 0) {
    await sendWhatsApp(
      `Scan complete. Analyzed ${analyzedCount}/${listings.length} listings, none matched.\nReasons: ${skipSummary || 'unknown'}`
    );
    return { applied: 0, totalScanned: listings.length, totalAnalyzed: analyzedCount, results: [], skipReasons };
  }

  const notAnalyzedNote = notAnalyzed > 0 ? `, ${notAnalyzed} not checked (cap reached)` : '';
  const rejectedNote = skipSummary ? `, rejected: ${skipSummary}` : '';

  await sendWhatsApp(
    `${qualified.length} job${qualified.length > 1 ? 's' : ''} matched out of ${analyzedCount} analyzed${rejectedNote}${notAnalyzedNote}. Preparing drafts...`
  );

  const results: ScanJobResult[] = [];
  let applied = 0;

  for (let i = 0; i < qualified.length; i++) {
    const { job, listing, analysis } = qualified[i];
    try {
      const app = await generateApplication(job);

      let emailId = '';
      let status: 'sent' | 'draft' | 'failed' = 'draft';
      let gmailError = '';
      const emailBody = stripDashes(app.emailBody);

      try {
        const resumePath = path.join(process.cwd(), 'public', 'resume.pdf');
        const resumePdf = fs.existsSync(resumePath) ? fs.readFileSync(resumePath) : undefined;
        emailId = await sendEmail(
          process.env.GMAIL_FROM_EMAIL!,
          `[REVIEW] ${app.subject}`,
          emailBody,
          true,
          resumePdf ? { filename: 'resume.pdf', content: resumePdf, mimeType: 'application/pdf' } : undefined
        );
        status = 'draft';
      } catch (e: any) {
        status = 'failed';
        gmailError = e.message?.slice(0, 120) || 'unknown error';
        console.error('Gmail draft failed:', gmailError);
      }

      await sendWhatsApp(
        `(${i + 1}/${qualified.length}) ` +
        formatApplicationNotification({
          jobTitle: job.title,
          company: job.company,
          matchScore: app.matchScore,
          gmailError,
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
      results.push({ company: job.company, title: job.title || '', error: e.message });
      await sendWhatsApp(`(${i + 1}/${qualified.length}) ❌ Failed to process ${job.company}: ${e.message?.slice(0, 100)}`);
    }
  }

  await sendWhatsApp(`Done. ${applied} draft${applied > 1 ? 's' : ''} saved to Gmail. Review and send when ready.`);

  return { applied, totalScanned: listings.length, totalAnalyzed: analyzedCount, results, skipReasons };
}
