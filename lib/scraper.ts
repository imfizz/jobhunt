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
}

function matchesKeywords(title: string): boolean {
  const t = title.toLowerCase();
  return KEYWORDS.some(k => t.includes(k));
}

export async function scrapeRemotive(): Promise<JobListing[]> {
  try {
    const res = await fetch('https://remotive.com/api/remote-jobs?category=software-dev&limit=50');
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs || [])
      .filter((j: any) => matchesKeywords(j.title))
      .map((j: any) => ({
        title: j.title,
        company: j.company_name,
        url: j.url,
        location: j.candidate_required_location || 'Remote',
        salary: j.salary || ''
      }));
  } catch (e) {
    console.error('Remotive scrape failed:', e);
    return [];
  }
}

export async function scrapeRemoteOK(): Promise<JobListing[]> {
  try {
    const res = await fetch('https://remoteok.com/api', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobHunt/1.0)' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = Array.isArray(data) ? data.slice(1) : [];
    return jobs
      .filter((j: any) => j.position && matchesKeywords(j.position))
      .map((j: any) => ({
        title: j.position,
        company: j.company,
        url: j.url || `https://remoteok.com/remote-jobs/${j.id}`,
        location: j.location || 'Worldwide',
        salary: j.salary_min ? `$${j.salary_min}–$${j.salary_max || '?'}` : ''
      }));
  } catch (e) {
    console.error('RemoteOK scrape failed:', e);
    return [];
  }
}

export async function fetchJobDescription(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!res.ok) return '';
    const html = await res.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header').remove();
    return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000);
  } catch (e) {
    console.error('Fetch description failed:', e);
    return '';
  }
}

export async function scrapeAllSources(): Promise<JobListing[]> {
  const [remotive, remoteok] = await Promise.all([
    scrapeRemotive(),
    scrapeRemoteOK()
  ]);
  const seen = new Set<string>();
  const all = [...remotive, ...remoteok].filter(j => {
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
