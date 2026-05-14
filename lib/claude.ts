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
}

export interface GeneratedApplication {
  subject: string;
  emailBody: string;
  tailoredHighlights: string[];
  matchScore: number;
  matchReasoning: string;
}

export async function generateApplication(job: JobDetails): Promise<GeneratedApplication> {
  const prompt = `You are helping Francis Albert Ilacad apply for a job. Your job is to generate a TRUTHFUL, personalized application email and tailored resume highlights based ONLY on facts from his actual resume.

CRITICAL RULES:
1. NEVER invent experience, skills, or accomplishments not in the resume
2. NEVER exaggerate metrics or claims
3. Only use facts from the resume below
4. Match real experience to the job description honestly
5. If the job requires skills Francis doesn't have, do NOT claim he has them — focus on transferable strengths instead

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
  "subject": "Concise email subject (max 80 chars) — should mention role and 1-2 key skills",
  "emailBody": "Plain text email body. 150-220 words. Conversational but professional. Reference specific things from the job description that genuinely match Francis's experience. NO buzzwords. NO 'I am writing to express interest'. Start with a hook tied to the company or role. Include link to portfolio (https://www.francisilacad.com). End with a clear call-to-action for a 15-min chat. Sign with full name + phone.",
  "tailoredHighlights": ["3-5 resume bullet points reordered/rephrased to match this job — but only using TRUE facts from his actual experience"],
  "matchScore": 0-100,
  "matchReasoning": "2-sentence honest assessment of match quality"
}

Return ONLY the JSON object. No code fences, no commentary.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned) as GeneratedApplication;
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
  "hrEmail": "Recruiter or HR email if visible, else empty string"
}

=== HTML/TEXT ===
${html.slice(0, 15000)}

Return ONLY the JSON.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as JobDetails;
}
