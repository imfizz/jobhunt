import * as cheerio from 'cheerio';
import type { JobDetails } from './claude';

interface JobListing {
  title: string;
  company: string;
  url: string;
  location?: string;
  salary?: string;
  source: string;
  postedAt?: Date;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MAX_AGE_DAYS = 3;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

function isFresh(date?: Date): boolean {
  if (!date) return true; // if we cannot determine date, do not skip; let AI decide
  return (Date.now() - date.getTime()) <= MAX_AGE_MS;
}

function parseDate(raw: any): Date | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}

function parseRelativeDate(text?: string): Date | undefined {
  if (!text) return undefined;
  const now = Date.now();
  const m = text.match(/(\d+)\s*(minute|hour|day|week|month)s?\s*ago/i);
  if (!m) return undefined;
  const n = parseInt(m[1]);
  const unit = m[2].toLowerCase();
  const multipliers: Record<string, number> = {
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000
  };
  return new Date(now - n * multipliers[unit]);
}

export async function scrapeKalibrr(): Promise<JobListing[]> {
  try {
    const queries = ['javascript', 'fullstack', 'frontend'];
    const allJobs: JobListing[] = [];

    for (const query of queries) {
      const url = `https://www.kalibrr.com/kjs/job_board/search?text=${encodeURIComponent(query)}&limit=20&offset=0`;
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' } });
      if (!res.ok) continue;
      const data = await res.json();
      const jobs = data?.jobs || [];

      for (const j of jobs) {
        const postedAt = parseDate(j.activation_date || j.created_date || j.updated_at);
        if (!isFresh(postedAt)) continue;

        allJobs.push({
          title: j.name,
          company: j.company_info?.name || j.company_name || 'Unknown',
          url: `https://www.kalibrr.com/c/${j.company_info?.code}/jobs/${j.id}/${j.slug}`,
          location: j.google_location?.address || j.location || 'Philippines',
          salary: j.base_salary_currency && j.base_salary
            ? `${j.base_salary_currency} ${j.base_salary} to ${j.maximum_salary} per ${j.salary_interval}`
            : '',
          source: 'Kalibrr',
          postedAt
        });
      }
    }

    return allJobs;
  } catch (e) {
    console.error('Kalibrr scrape failed:', e);
    return [];
  }
}

export async function scrapeJobStreet(): Promise<JobListing[]> {
  try {
    const queries = ['javascript', 'fullstack', 'frontend'];
    const allJobs: JobListing[] = [];

    for (const query of queries) {
      const url = `https://ph.jobstreet.com/api/jobsearch/v5/search?siteKey=PH-Main&sourcesystem=houston&where=All+Philippines&keywords=${encodeURIComponent(query)}&pageSize=20&include=seodata&sortmode=ListedDate`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
          'Origin': 'https://ph.jobstreet.com',
          'Referer': 'https://ph.jobstreet.com/'
        }
      });
      if (!res.ok) continue;
      const data = await res.json();
      const jobs = data?.data || [];

      for (const j of jobs) {
        const postedAt = parseDate(j.listingDate) || parseRelativeDate(j.listingDateDisplay);
        if (!isFresh(postedAt)) continue;

        allJobs.push({
          title: j.title,
          company: j.advertiser?.description || 'Unknown',
          url: `https://ph.jobstreet.com/job/${j.id}`,
          location: j.locations?.[0]?.label || 'Philippines',
          salary: j.salary?.label || '',
          source: 'JobStreet',
          postedAt
        });
      }
    }

    return allJobs;
  } catch (e) {
    console.error('JobStreet scrape failed:', e);
    return [];
  }
}

export async function scrapeIndeed(): Promise<JobListing[]> {
  try {
    const queries = ['javascript+developer', 'fullstack+developer', 'frontend+developer'];
    const allJobs: JobListing[] = [];

    for (const query of queries) {
      // fromage=3 means "posted in last 3 days"
      const url = `https://ph.indeed.com/jobs?q=${query}&l=Remote&sort=date&fromage=3`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      if (!res.ok) {
        console.warn('Indeed returned', res.status, 'for', query);
        continue;
      }
      const html = await res.text();
      const $ = cheerio.load(html);

      $('a[data-jk]').each((_, el) => {
        const title = $(el).find('span[title]').attr('title') || $(el).find('h2 span').text().trim();
        const company = $(el).closest('.job_seen_beacon').find('[data-testid="company-name"]').text().trim();
        const location = $(el).closest('.job_seen_beacon').find('[data-testid="text-location"]').text().trim();
        const dateText = $(el).closest('.job_seen_beacon').find('[data-testid="myJobsStateDate"]').text().trim();
        const postedAt = parseRelativeDate(dateText);
        const jk = $(el).attr('data-jk');

        if (!isFresh(postedAt)) return;

        if (title && jk) {
          allJobs.push({
            title,
            company: company || 'Unknown',
            url: `https://ph.indeed.com/viewjob?jk=${jk}`,
            location: location || 'Remote',
            salary: '',
            source: 'Indeed',
            postedAt
          });
        }
      });
    }

    return allJobs;
  } catch (e) {
    console.error('Indeed scrape failed:', e);
    return [];
  }
}

export async function fetchJobDescription(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return '';
    const html = await res.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, noscript, iframe').remove();

    const selectors = [
      '.jobsearch-JobComponent-description',
      '#jobDescriptionText',
      '.job-description',
      '[data-automation="jobAdDetails"]',
      '.k-card-content',
      'main',
      'article'
    ];

    for (const sel of selectors) {
      const text = $(sel).text().replace(/\s+/g, ' ').trim();
      if (text.length > 200) return text.slice(0, 10000);
    }

    return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 10000);
  } catch (e) {
    console.error('Fetch description failed:', e);
    return '';
  }
}

export async function scrapeAllSources(): Promise<JobListing[]> {
  const [kalibrr, jobstreet, indeed] = await Promise.all([
    scrapeKalibrr(),
    scrapeJobStreet(),
    scrapeIndeed()
  ]);

  console.log(`Fresh jobs (within ${MAX_AGE_DAYS} days): Kalibrr=${kalibrr.length}, JobStreet=${jobstreet.length}, Indeed=${indeed.length}`);

  const seen = new Set<string>();
  const all = [...kalibrr, ...jobstreet, ...indeed].filter(j => {
    const key = `${j.company}::${j.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  all.sort((a, b) => {
    const aTime = a.postedAt?.getTime() || 0;
    const bTime = b.postedAt?.getTime() || 0;
    return bTime - aTime;
  });

  return all.slice(0, 15);
}

export async function listingToJobDetails(listing: JobListing): Promise<JobDetails> {
  const description = await fetchJobDescription(listing.url);
  return {
    title: listing.title,
    company: listing.company,
    url: listing.url,
    description: description || 'Description not available',
    location: listing.location,
    salary: listing.salary,
    postedAt: listing.postedAt?.toISOString()
  };
}
