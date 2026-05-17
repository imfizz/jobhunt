import type { JobDetails } from './claude';

interface JobListing {
  title: string;
  company: string;
  url: string;
  location?: string;
  salary?: string;
  source: string;
  postedAt?: Date;
  description?: string;
}

const MAX_AGE_DAYS = 7;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

function isFresh(date?: Date): boolean {
  if (!date) return true;
  return (Date.now() - date.getTime()) <= MAX_AGE_MS;
}

/**
 * JSearch API call. Each call costs 1 request against the 200/month quota.
 * Returns up to 10 jobs per call by default.
 *
 * We use date_posted=week to pre-filter to fresh listings.
 */
async function callJSearch(query: string): Promise<JobListing[]> {
  try {
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=1&date_posted=week`;

    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': process.env.JSEARCH_API_KEY!,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    });

    if (!res.ok) {
      console.error('JSearch returned', res.status);
      return [];
    }

    const data = await res.json();
    const jobs = data?.data || [];

    return jobs.map((j: any): JobListing => {
      let salary = '';
      if (j.job_min_salary && j.job_max_salary) {
        salary = `${j.job_salary_currency || ''} ${j.job_min_salary} to ${j.job_max_salary} per ${j.job_salary_period || 'year'}`.trim();
      } else if (j.job_salary) {
        salary = j.job_salary;
      }

      const location = [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', ') || 'Remote';

      const postedAt = j.job_posted_at_datetime_utc
        ? new Date(j.job_posted_at_datetime_utc)
        : (j.job_posted_at_timestamp ? new Date(j.job_posted_at_timestamp * 1000) : undefined);

      return {
        title: j.job_title || 'Unknown',
        company: j.employer_name || 'Unknown',
        url: j.job_apply_link || j.job_google_link || '',
        location,
        salary,
        source: j.job_publisher || 'JSearch',
        postedAt,
        description: j.job_description || ''
      };
    });
  } catch (e) {
    console.error('JSearch call failed:', e);
    return [];
  }
}

/**
 * Scrape via JSearch. Uses exactly 3 API calls per run to stay within free tier.
 * 3 calls per day x 30 days = 90 calls/month, leaving 110 for manual mode.
 */
export async function scrapeAllSources(): Promise<JobListing[]> {
  // 3 strategic queries to cover the role types Francis wants
  const queries = [
    'fullstack developer javascript remote',
    'react typescript developer remote',
    'frontend developer remote'
  ];

  const results = await Promise.all(queries.map(q => callJSearch(q)));
  const allJobs = results.flat();

  console.log(`JSearch returned ${allJobs.length} jobs from ${queries.length} queries`);

  // Dedupe by company + title (JSearch sometimes returns same job from multiple sources)
  const seen = new Set<string>();
  const deduped = allJobs.filter(j => {
    const key = `${j.company}::${j.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Freshness filter
  const fresh = deduped.filter(j => isFresh(j.postedAt));

  const PRIORITY_SOURCES = ['linkedin', 'jobstreet', 'indeed'];

  function sourcePriority(source: string): number {
    const lower = source.toLowerCase();
    const idx = PRIORITY_SOURCES.findIndex(s => lower.includes(s));
    return idx === -1 ? PRIORITY_SOURCES.length : idx;
  }

  // Sort: priority sources first, then newest first within each tier
  fresh.sort((a, b) => {
    const priorityDiff = sourcePriority(a.source || '') - sourcePriority(b.source || '');
    if (priorityDiff !== 0) return priorityDiff;
    const aTime = a.postedAt?.getTime() || 0;
    const bTime = b.postedAt?.getTime() || 0;
    return bTime - aTime;
  });

  console.log(`After dedupe + freshness filter: ${fresh.length} jobs`);
  console.log('Source breakdown:', fresh.reduce((acc, j) => {
    acc[j.source || 'unknown'] = (acc[j.source || 'unknown'] || 0) + 1;
    return acc;
  }, {} as Record<string, number>));

  return fresh.slice(0, 20); // Top 20 fresh jobs for AI to analyze
}

/**
 * Manual mode: fetch job details by URL or pasted text.
 * Uses 1 API call if URL is provided.
 */
export async function fetchJobDescription(url: string): Promise<string> {
  // JSearch doesn't have a "get job by URL" endpoint, but for the manual mode
  // we fall back to a basic fetch. The AI then extracts the details from the HTML.
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return '';
    const html = await res.text();
    return html.slice(0, 30000);
  } catch (e) {
    console.error('Fetch description failed:', e);
    return '';
  }
}

export async function listingToJobDetails(listing: JobListing): Promise<JobDetails> {
  // JSearch already gave us the description, so no additional API call needed
  return {
    title: listing.title,
    company: listing.company,
    url: listing.url,
    description: listing.description || 'Description not available',
    location: listing.location,
    salary: listing.salary,
    postedAt: listing.postedAt?.toISOString()
  };
}
