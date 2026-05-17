import Anthropic from '@anthropic-ai/sdk';
import { RESUME, resumeAsString } from './resume';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface JobDetails {
  title: string;
  company: string;
  description: string;
  url: string;
  salary?: string;
  location?: string;
  hrEmail?: string;
  postedAt?: string;
}

export interface TailoredResumeHighlight {
  label: string;
  description: string;
}

export interface TailoredResumeExperience {
  title: string;
  company: string;
  location: string;
  period: string;
  summary: string;
  highlights: TailoredResumeHighlight[];
}

export interface TailoredResumeData {
  summary: string;
  experience: TailoredResumeExperience[];
  skills: string;
}

export interface GeneratedApplication {
  subject: string;
  emailBody: string;
  tailoredHighlights: string[];
  tailoredResume: TailoredResumeData;
  matchScore: number;
  matchReasoning: string;
}

export interface RoleAnalysis {
  isJSFocused: boolean;
  isFullstackOrRelated: boolean;
  isRemote: boolean;
  meetsSalary: boolean;
  primaryStack: string[];
  confidence: number;
  reasoning: string;
  recommendation: 'apply' | 'skip';
}

/**
 * Uses Claude to deeply analyze a job description and decide whether it truly fits.
 * This replaces dumb keyword matching with semantic understanding.
 */
export async function analyzeRole(job: JobDetails): Promise<RoleAnalysis> {
  const prompt = `You are evaluating whether a job posting is a real fit for Francis Albert Ilacad, who is looking for:
- Fullstack Developer, Software Engineer, JavaScript Developer, or Frontend Developer roles
- JavaScript/TypeScript focused (React, Node.js, Next.js are his core stack)
- Remote setup
- Salary of at least PHP 120,000/month (or international equivalent: roughly USD 2,200+/month, EUR 2,000+/month)
- International or Philippine companies both OK

Analyze this job posting and determine if it is truly a match. Be strict. Reject if:
- The role is primarily a different stack (Java, Python, .NET, PHP, Ruby, Go) and JS is only secondary
- The role is mainly DevOps/Data/ML/QA even if it mentions JavaScript
- It's not remote (hybrid is acceptable only if PH-based)
- Salary is clearly below threshold
- It's a junior/intern role (Francis has 4+ years experience)

=== JOB POSTING ===
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
Salary: ${job.salary || 'Not specified'}

Description:
${job.description.slice(0, 6000)}

=== TASK ===
Return ONLY this JSON object (no markdown, no code fences):
{
  "isJSFocused": true | false,
  "isFullstackOrRelated": true | false,
  "isRemote": true | false,
  "meetsSalary": true | false,
  "primaryStack": ["main technologies the role actually uses"],
  "confidence": 0-100,
  "reasoning": "2 sentences explaining your decision. Use plain prose. Do NOT use em dashes or en dashes. Use commas, periods, or parentheses instead.",
  "recommendation": "apply" | "skip"
}

Critical: Do NOT use em dashes (long dash) or en dashes anywhere in your response. Use commas, periods, semicolons, or parentheses instead.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json|```/g, '').trim();

  try {
    const result = JSON.parse(cleaned) as RoleAnalysis;
    result.reasoning = stripDashes(result.reasoning);
    return result;
  } catch (e) {
    throw new Error(`Failed to parse role analysis: ${cleaned.slice(0, 200)}`);
  }
}

export async function generateApplication(job: JobDetails): Promise<GeneratedApplication> {
  const prompt = `You are helping Francis Albert Ilacad apply for a job. Your job is to generate a TRUTHFUL, personalized application email and tailored resume highlights based ONLY on facts from his actual resume.

CRITICAL RULES:
1. NEVER invent experience, skills, or accomplishments not in the resume
2. NEVER exaggerate metrics or claims
3. Only use facts from the resume below
4. Match real experience to the job description honestly
5. If the job requires skills Francis doesn't have, do NOT claim he has them, focus on transferable strengths instead
6. NEVER use em dashes (long dash) or en dashes anywhere. Use commas, periods, semicolons, or parentheses instead. This is non negotiable.

=== FRANCIS'S RESUME (source of truth) ===
${resumeAsString()}

=== JOB POSTING ===
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
Salary: ${job.salary || 'Not specified'}
URL: ${job.url}

Description:
${job.description}

=== YOUR TASK ===
Generate JSON with this exact shape (no markdown, no preamble):
{
  "subject": "Concise email subject (max 80 chars), mention role and 1 or 2 key skills. NO em dashes.",
  "emailBody": "Plain text email body. 150 to 220 words. Conversational but professional. Reference specific things from the job description that genuinely match Francis's experience. NO buzzwords. NO 'I am writing to express interest'. Start with a hook tied to the company or role. Include link to portfolio (https://www.francisilacad.com). End with a clear call to action for a 15 minute chat. Sign with full name plus phone. CRITICAL: NO em dashes anywhere, use commas or periods.",
  "tailoredHighlights": ["3 to 5 resume bullet points reordered or rephrased to match this job, but only using TRUE facts from his actual experience. NO em dashes."],
  "tailoredResume": {
    "summary": "2-3 sentence professional summary rewritten to emphasize what matters most for THIS job. Only true facts. NO em dashes.",
    "experience": [
      {
        "title": "Exact job title from resume",
        "company": "Exact company name",
        "location": "Exact location",
        "period": "Exact period string",
        "summary": "One sentence role summary relevant to this job",
        "highlights": [
          { "label": "Short bold label (2-4 words)", "description": "Achievement or responsibility description. True facts only. NO em dashes." }
        ]
      }
    ],
    "experience must include all 3 jobs from the resume, reordered or rephrased to prioritize what is most relevant to this posting": true,
    "skills": "Comma-separated skills reordered so most relevant to this job come first. Use only skills from the resume."
  },
  "matchScore": 0-100,
  "matchReasoning": "2 sentence honest assessment of match quality. NO em dashes."
}

Return ONLY the JSON object. No code fences, no commentary. Remember: ZERO em dashes in any field.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3500,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json|```/g, '').trim();

  try {
    const result = JSON.parse(cleaned) as GeneratedApplication;
    // Defense in depth: strip any em dashes that slipped through
    result.subject = stripDashes(result.subject);
    result.emailBody = stripDashes(result.emailBody);
    result.tailoredHighlights = result.tailoredHighlights.map(stripDashes);
    result.matchReasoning = stripDashes(result.matchReasoning);
    if (result.tailoredResume) {
      result.tailoredResume.summary = stripDashes(result.tailoredResume.summary || '');
      result.tailoredResume.skills = stripDashes(result.tailoredResume.skills || '');
      result.tailoredResume.experience = (result.tailoredResume.experience || []).map(exp => ({
        ...exp,
        summary: stripDashes(exp.summary || ''),
        highlights: (exp.highlights || []).map(h => ({
          label: stripDashes(h.label || ''),
          description: stripDashes(h.description || '')
        }))
      }));
    }
    return result;
  } catch (e) {
    throw new Error(`Failed to parse Claude response: ${cleaned.slice(0, 200)}`);
  }
}

export async function extractJobFromHtml(html: string, url: string): Promise<JobDetails> {
  const prompt = `Extract job posting details from this HTML/text. Return ONLY a JSON object with this exact shape (no markdown):
{
  "title": "Job title",
  "company": "Company name",
  "description": "Full job description, requirements, and responsibilities (keep it complete)",
  "url": "${url}",
  "salary": "Salary range if visible, else empty string",
  "location": "Location/remote info if visible, else empty string",
  "hrEmail": "Recruiter or HR email if visible, else empty string",
  "postedAt": "Posted date if visible (ISO date or relative like '2 days ago'), else empty string"
}

=== HTML/TEXT ===
${html.slice(0, 15000)}

Return ONLY the JSON. Do not use em dashes.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json|```/g, '').trim();
  const job = JSON.parse(cleaned) as JobDetails;
  job.description = stripDashes(job.description || '');
  return job;
}

/**
 * Replace em dashes and en dashes with safer punctuation.
 */
export function stripDashes(text: string): string {
  if (!text) return text;
  return text
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')  // em/en dash with surrounding spaces
    .replace(/[\u2014\u2013]/g, ', ');       // standalone em/en dash
}
