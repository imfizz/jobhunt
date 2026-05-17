# JobHunt — Automated Job Application Pipeline

An AI-powered job hunting bot built by **Francis Albert Ilacad**. Every day it searches for remote fullstack/JS jobs, has Claude AI analyze each one, generates a tailored application email and a reordered resume PDF, saves drafts to Gmail, and sends you a WhatsApp notification with the job details.

---

## How It Works (Full Flow)

```
Vercel Cron (1:00 AM UTC daily)
  → GET /api/cron
      → JSearch API fetches fresh job listings (3 queries, ~20–30 results)
          Priority order: LinkedIn → JobStreet → Indeed → others
          Freshness filter: jobs posted within last 7 days
      → Claude AI analyzes each job:
          - Is it JS/TS focused? Is it remote? Does it meet salary?
          - Confidence score must be ≥ 60% to qualify
      → For each qualifying job (up to 5):
          - Claude generates tailored email body
          - Claude generates tailored resume (reordered for this job)
          - PDF is created from the tailored resume
          - Draft saved to Gmail with resume.pdf attached
          - WhatsApp notification sent with job details
      → Final WhatsApp summary sent
```

You get WhatsApp messages like:
- `Job scan started. Fetching fresh listings...`
- `Found 17 fresh listings. Analyzing now...`
- `3 jobs matched out of 12 analyzed, rejected: 7 not JS stack, 2 not remote...`
- `(1/3) 📝 Job Application — Next.js Developer at Acme Corp...`
- `Done. 3 drafts saved to Gmail. Review and send when ready.`

Then open Gmail, read each draft, attach nothing (resume PDF is already attached), and hit Send.

---

## Tech Stack

| Service | Purpose | Free Tier |
|---|---|---|
| Next.js 14 | API routes + app framework | — |
| Vercel | Hosting + cron scheduler | 2 cron jobs/day |
| JSearch (RapidAPI) | Job board aggregator (LinkedIn, Indeed, JobStreet, etc.) | 200 req/month |
| Claude API (Anthropic) | Job analysis + email + resume generation | Pay per use |
| Gmail API | Save drafts to your inbox | Free |
| Twilio WhatsApp Sandbox | Send WhatsApp notifications | Free (sandbox) |
| PDFKit | Generate resume PDF attachment | — |

---

## Project Structure

```
jobhunt/
├── app/
│   └── api/
│       ├── cron/route.ts         ← Daily automated scan (main entry point)
│       ├── manual/route.ts       ← Manual: paste a job URL to process it
│       ├── send/route.ts         ← Send an email + WhatsApp from the UI
│       └── test-whatsapp/route.ts ← Quick test to verify Twilio is working
├── lib/
│   ├── resume.ts                 ← YOUR RESUME — edit this with your info
│   ├── scraper.ts                ← JSearch API calls + filtering + sorting
│   ├── claude.ts                 ← All Claude AI prompts (analyze, generate, extract)
│   ├── gmail.ts                  ← Gmail API (save drafts, send emails)
│   ├── whatsapp.ts               ← Twilio WhatsApp (send + format notifications)
│   └── pdf.ts                    ← Resume PDF generator (PDFKit)
├── vercel.json                   ← Cron schedule config
├── .env.local                    ← Your secrets (never commit this)
└── .env.example                  ← Template for env vars
```

---

## First-Time Setup

### Step 1 — Install dependencies

```bash
npm install
```

### Step 2 — Get your API keys

You need credentials from 4 services. Here's exactly where to get each one:

---

#### A. Anthropic (Claude AI)
1. Go to https://console.anthropic.com/settings/keys
2. Click **Create Key**
3. Copy the key — it starts with `sk-ant-api03-...`

---

#### B. Gmail API
You need OAuth2 credentials so the app can save drafts to your Gmail.

1. Go to https://console.cloud.google.com
2. Create a new project (or use existing)
3. Enable the **Gmail API** (APIs & Services → Library → search "Gmail API")
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add `https://developers.google.com/oauthplayground` to **Authorized redirect URIs**
7. Copy **Client ID** and **Client Secret**

Get the Refresh Token:
1. Go to https://developers.google.com/oauthplayground
2. Click the gear icon (top right) → check **Use your own OAuth credentials**
3. Enter your Client ID and Client Secret
4. In Step 1, find and select `Gmail API v1` → tick `https://mail.google.com/`
5. Click **Authorize APIs** → sign in with your Gmail account
6. In Step 2, click **Exchange authorization code for tokens**
7. Copy the **Refresh Token**

---

#### C. Twilio WhatsApp Sandbox
The sandbox lets you send WhatsApp messages for free without a business account.

1. Go to https://console.twilio.com
2. Sign up for a free account
3. Go to **Messaging → Try it out → Send a WhatsApp message**
4. Note your **Account SID** and **Auth Token** from the dashboard homepage
5. The sandbox FROM number is always: `whatsapp:+14155238886`
6. Your TO number is your WhatsApp number with country code: `whatsapp:+639060766219`

**IMPORTANT — Join the sandbox first:**
From the WhatsApp number you want to receive messages on (+639060766219), send the sandbox join keyword to +1 415 523 8886. The join keyword is shown in the Twilio console under the sandbox setup. It looks like `join <word>`. You only need to do this once, but it expires after 72 hours of inactivity.

---

#### D. JSearch API (RapidAPI)
JSearch aggregates jobs from LinkedIn, Indeed, JobStreet, Glassdoor, and 100+ other boards.

1. Go to https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
2. Sign up and subscribe to the **Basic (Free)** plan — 200 requests/month
3. Copy your **X-RapidAPI-Key** from the API playground

The app uses 3 requests per daily run (3 queries × 1 page each). At that rate: 3 × 30 = 90 requests/month, staying within the free 200/month limit.

---

### Step 3 — Create `.env.local`

Copy `.env.example` to `.env.local` and fill in your values:

```env
# Claude AI — https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-api03-...

# Gmail OAuth2 — https://console.cloud.google.com
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-...
GMAIL_REFRESH_TOKEN=1//04...
GMAIL_FROM_EMAIL=your-email@gmail.com

# Twilio WhatsApp Sandbox — https://console.twilio.com
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WHATSAPP_TO=whatsapp:+639060766219

# JSearch via RapidAPI — https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
JSEARCH_API_KEY=...

# Cron security — any long random string, used to authenticate cron requests
CRON_SECRET=change-this-to-a-long-random-string

# Toggle cron on/off without redeploying
CRON_ENABLED=true

# App URL (update after deploying to Vercel)
APP_URL=https://your-app.vercel.app

# Filtering config
JOB_MIN_SALARY_PHP=120000
JOB_KEYWORDS=fullstack,javascript,typescript,react,node
```

### Step 4 — Update your resume

Open `lib/resume.ts` — this is the single source of truth for your resume. Claude reads this file when generating every email and resume PDF. Keep it up to date whenever you change jobs or add skills.

### Step 5 — Run locally

```bash
npm run dev
```

App runs at http://localhost:3000

---

## Running the Job Scan Manually

The cron runs automatically on Vercel daily, but you can trigger it manually anytime from your terminal (Git Bash or any shell with `curl`):

```bash
curl -H "Authorization: Bearer your-cron-secret" http://localhost:3000/api/cron
```

Replace `your-cron-secret` with the value of `CRON_SECRET` in your `.env.local`.

On Vercel (production):
```bash
curl -H "Authorization: Bearer your-cron-secret" https://your-app.vercel.app/api/cron
```

---

## Testing WhatsApp Connection

Before running the full scan, verify Twilio works:

```bash
curl -H "Authorization: Bearer your-cron-secret" http://localhost:3000/api/test-whatsapp
```

You should receive a test WhatsApp message within a few seconds. If not, your Twilio sandbox join has expired — resend the join keyword from your WhatsApp number.

---

## Turning the Cron On and Off

**Method 1 — Environment variable (works locally and on Vercel):**

In `.env.local`:
```env
CRON_ENABLED=true   # on
CRON_ENABLED=false  # off
```

On Vercel: go to **Project → Settings → Environment Variables**, update `CRON_ENABLED`, no redeployment needed.

**Method 2 — Vercel dashboard:**

Go to **Project → Settings → Cron Jobs** → pause or resume the cron job directly.

---

## Deploying to Vercel

```bash
npm i -g vercel
vercel
```

Then go to **Vercel Dashboard → Project → Settings → Environment Variables** and add every key from your `.env.local`.

The cron schedule is defined in `vercel.json`:
```json
{ "crons": [{ "path": "/api/cron", "schedule": "0 1 * * *" }] }
```

`0 1 * * *` = 1:00 AM UTC = 9:00 AM Philippine Time (PHT). Change the schedule there if you want a different time.

---

## What Claude Filters Out

The AI rejects a job if any of these are true:
- Stack is primarily Java, Python, .NET, PHP, Ruby, or Go (JS must be the main language)
- Role is DevOps, Data, ML, or QA — even if it mentions JavaScript
- Not remote (hybrid is accepted only if Philippines-based)
- Salary is clearly below PHP 120,000/month equivalent
- Junior or intern level role

If a job passes, Claude generates:
1. A personalized email (150–220 words, references specific things from the job)
2. A tailored resume PDF (same content as your real resume, reordered to highlight most relevant experience first)

Both are saved as a Gmail draft with the PDF attached.

---

## Common Issues

**"No fresh jobs found" every day**
→ JSearch's `date_posted=week` filter might be too strict for your region. Check `lib/scraper.ts` and change the queries to be more specific.

**STATUS: FAILED on Gmail draft**
→ Your Gmail refresh token has expired. Repeat the OAuth Playground steps to get a new one (Section B above).

**WhatsApp messages stop arriving**
→ The Twilio sandbox expires after 72 hours of no inactivity from your number. Resend the join keyword to re-activate.

**"invalid x-api-key" errors in terminal**
→ Your Anthropic API key is invalid or has no credits. Go to https://console.anthropic.com and check your key and billing.

**PDF has missing fonts error in terminal**
→ This is a Next.js bundling issue with PDFKit. Make sure `next.config.js` has:
```js
experimental: {
  serverComponentsExternalPackages: ['pdfkit'],
}
```

---

## Costs

Running this daily costs roughly:
- **Vercel** — Free (Hobby plan covers cron + serverless)
- **JSearch** — Free (90 req/month out of 200 limit)
- **Twilio** — Free (sandbox, no charge)
- **Gmail API** — Free
- **Claude API** — ~$0.05–0.15 per daily run (3 analyzeRole calls + up to 5 generateApplication calls using claude-sonnet-4-6)

Total: roughly **$1.50–4.50/month** depending on how many jobs qualify each day.
