import * as cheerio from 'cheerio';
import type { JobDetails } from './claude';
 
const KEYWORDS = (process.env.JOB_KEYWORDS || 'fullstack,javascript,typescript,react,node')
  .split(',').map(s => s.trim().toLowerCase());
 
interface JobListing {
  title: string;
  company: string;
  url: string;
  location?: string;
  salary?: string;
  source: string;
}
 
function matchesKeywords(title: string): boolean {
  const t = title.toLowerCase();
  return KEYWORDS.some(k => t.includes(k));
}
 
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
 
/**
 * KALIBRR — Philippine job board. Has a public JSON API.
 */
export async function scrapeKalibrr(): Promise<JobListing[]> {
  try {
    const query = KEYWORDS.slice(0, 2).join('+');
    const url = `https://www.kalibrr.com/kjs/job_board/search?text=${encodeURIComponent(query)}&limit=30&offset=0`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = data?.jobs || [];
    return jobs
      .filter((j: any) => matchesKeywords(j.name || ''))
      .map((j: any) => ({
        title: j.name,
        company: j.company_info?.name || j.company_name || 'Unknown',
        url: `https://www.kalibrr.com/c/${j.company_info?.code}/jobs/${j.id}/${j.slug}`,
        location: j.google_location?.address || j.location || 'Philippines',
        salary: j.base_salary_currency && j.base_salary
          ? `${j.base_salary_currency} ${j.base_salary}–${j.maximum_salary}/${j.salary_interval}`
          : '',
        source: 'Kalibrr'
      }));
  } catch (e) {
    console.error('Kalibrr scrape failed:', e);
    return [];
  }
}
 
/**
 * JOBSTREET PH — uses SEEK API.
 */
export async function scrapeJobStreet(): Promise<JobListing[]> {
  try {
    const query = KEYWORDS.slice(0, 2).join(' ');
    const url = `https://ph.jobstreet.com/api/jobsearch/v5/search?siteKey=PH-Main&sourcesystem=houston&where=All+Philippines&keywords=${encodeURIComponent(query)}&pageSize=30&include=seodata`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Origin': 'https://ph.jobstreet.com',
        'Referer': 'https://ph.jobstreet.com/'
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = data?.data || [];
    return jobs
      .filter((j: any) => matchesKeywords(j.title || ''))
      .map((j: any) => ({
        title: j.title,
        company: j.advertiser?.description || 'Unknown',
        url: `https://ph.jobstreet.com/job/${j.id}`,
        location: j.locations?.[0]?.label || 'Philippines',
        salary: j.salary?.label || '',
        source: 'JobStreet'
      }));
  } catch (e) {
    console.error('JobStreet scrape failed:', e);
    return [];
  }
}
 
/**
 * INDEED — best-effort. Often blocked.
 */
export async function scrapeIndeed(): Promise<JobListing[]> {
  try {
    const query = KEYWORDS.slice(0, 2).join('+');
    const url = `https://ph.indeed.com/jobs?q=${query}&l=Remote&sort=date`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (!res.ok) {
      console.warn('Indeed returned', res.status, '— likely blocked');
      return [];
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const jobs: JobListing[] = [];
    $('a[data-jk]').each((_, el) => {
      const title = $(el).find('span[title]').attr('title') || $(el).find('h2 span').text().trim();
      const company = $(el).closest('.job_seen_beacon').find('[data-testid="company-name"]').text().trim();
      const location = $(el).closest('.job_seen_beacon').find('[data-testid="text-location"]').text().trim();
      const jk = $(el).attr('data-jk');
      if (title && jk && matchesKeywords(title)) {
        jobs.push({
          title,
          company: company || 'Unknown',
          url: `https://ph.indeed.com/viewjob?jk=${jk}`,
          location: location || 'Remote',
          salary: '',
          source: 'Indeed'
        });
      }
    });
    return jobs;
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
 
    // Try common job description selectors first
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
 
  console.log(`Scraped: Kalibrr=${kalibrr.length}, JobStreet=${jobstreet.length}, Indeed=${indeed.length}`);
 
  const seen = new Set<string>();
  const all = [...kalibrr, ...jobstreet, ...indeed].filter(j => {
    const key = `${j.company}::${j.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return all.slice(0, 10);
}
 
export async function listingToJobDetails(listing: JobListing): Promise<JobDetails> {
  const description = await fetchJobDescription(listing.url);
  return {
    title: listing.title,
    company: listing.company,
    url: listing.url,
    description: description || 'Description not available',
    location: listing.location,
    salary: listing.salary
  };
}