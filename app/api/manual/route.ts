import { NextRequest, NextResponse } from 'next/server';
import { fetchJobDescription } from '@/lib/scraper';
import { extractJobFromHtml, generateApplication, analyzeRole } from '@/lib/claude';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { url, jobText } = await req.json();

    let job;
    if (url) {
      const text = await fetchJobDescription(url);
      if (!text) {
        return NextResponse.json({ error: 'Could not fetch job page. Try pasting the description instead.' }, { status: 400 });
      }
      job = await extractJobFromHtml(text, url);
    } else if (jobText) {
      job = await extractJobFromHtml(jobText, '');
    } else {
      return NextResponse.json({ error: 'Provide either url or jobText' }, { status: 400 });
    }

    // Optional: run AI analysis to give user a quality signal in the UI
    const analysis = await analyzeRole(job).catch(() => null);
    const application = await generateApplication(job);

    return NextResponse.json({
      ok: true,
      job,
      application,
      analysis
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
