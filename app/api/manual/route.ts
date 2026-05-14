import { NextRequest, NextResponse } from 'next/server';
import { fetchJobDescription } from '@/lib/scraper';
import { extractJobFromHtml, generateApplication } from '@/lib/claude';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { url, jobText } = await req.json();

    let job;
    if (url) {
      const text = await fetchJobDescription(url);
      if (!text) {
        return NextResponse.json({ error: 'Could not fetch job page' }, { status: 400 });
      }
      job = await extractJobFromHtml(text, url);
    } else if (jobText) {
      job = await extractJobFromHtml(jobText, '');
    } else {
      return NextResponse.json({ error: 'Provide either url or jobText' }, { status: 400 });
    }

    const application = await generateApplication(job);

    return NextResponse.json({ ok: true, job, application });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
