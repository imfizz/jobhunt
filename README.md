# JobHunt — Automated Job Application Pipeline

An AI-powered job hunting bot built by **Francis Albert Ilacad**. Every day it searches for remote fullstack/JS jobs, has Claude AI analyze each one, generates a tailored application email, attaches your resume PDF, saves drafts to Gmail, and sends you a WhatsApp notification with the job details.

---

## How It Works (Full Flow)

```
Vercel Cron (1:00 AM UTC = 9:00 AM PHT, daily)
  → GET /api/cron
      → JSearch API fetches fresh job listings (3 queries, ~20–30 results)
          Priority order: LinkedIn → JobStreet → Indeed → others
          Freshness filter: jobs posted within last 7 days
          Deduplication: same company+title across sources removed

      → Phase 1 — Claude AI analyzes each listing:
          - Is it JS/TS focused? Is it remote? Does it meet salary?
          - Confidence score must be ≥ 60% to qualify
          - Stops once 5 qualifying jobs are found

      → WhatsApp: "X jobs matched out of Y analyzed, rejected: Z not JS stack..."

      → Phase 2 — For each qualifying job:
          - Claude generates personalized email body (150–220 words)
          - Draft saved to Gmail with resume.pdf attached (from public/resume.pdf)
          - WhatsApp notification sent: (1/3) 📝 Job details...

      → WhatsApp: "Done. X drafts saved to Gmail. Review and send when ready."
```

Open Gmail → read each draft → hit Send. Resume is already attached.

---

## WhatsApp Message Flow

Every run sends this sequence of messages:

```
Job scan started. Fetching fresh listings...
Found 17 fresh listings. Analyzing now...
3 jobs matched out of 12 analyzed, rejected: 7 not JS stack, 2 not remote, 1 low confidence (55%). Preparing drafts...
(1/3) 📝 Job Application — [full job details]
(2/3) 📝 Job Application — [full job details]
(3/3) 📝 Job Application — [full job details]
Done. 3 drafts saved to Gmail. Review and send when ready.
```

If a Gmail draft fails, the WhatsApp shows the exact error:
```
📊 Status: FAILED
⚠️ Gmail error: invalid_grant
```

---

## Tech Stack

| Service | Purpose | Free Tier |
|---|---|---|
| Next.js 14 | API routes + app framework | — |
| Vercel | Hosting + cron scheduler | 2 cron jobs/day |
| JSearch (RapidAPI) | Job board aggregator (LinkedIn, Indeed, JobStreet, etc.) | 200 req/month |
| Claude API (Anthropic) | Job analysis + email generation (claude-sonnet-4-6) | Pay per use |
| Gmail API | Save drafts to your inbox | Free |
| Twilio WhatsApp Sandbox | Send WhatsApp notifications | Free (sandbox) |

---

## Project Structure

```
jobhunt/
├── app/
│   └── api/
│       ├── cron/route.ts          ← Daily automated scan (main entry point)
│       ├── manual/route.ts        ← Manual: paste a job URL to process it
│       ├── send/route.ts          ← Send an email + WhatsApp from the UI
│       └── test-whatsapp/route.ts ← Quick test to verify Twilio is working
├── lib/
│   ├── resume.ts                  ← YOUR RESUME DATA — Claude reads this for email generation
│   ├── scraper.ts                 ← JSearch API calls + dedup + priority sorting
│   ├── claude.ts                  ← Claude AI prompts (analyzeRole, generateApplication)
│   ├── gmail.ts                   ← Gmail API (save drafts with PDF attachment)
│   └── whatsapp.ts                ← Twilio WhatsApp (send + format notifications)
├── public/
│   └── resume.pdf                 ← YOUR ACTUAL RESUME PDF — attached to every draft
├── vercel.json                    ← Cron schedule config
├── next.config.js                 ← Next.js config
├── .env.local                     ← Your secrets (never commit this)
└── .env.example                   ← Template — copy this to .env.local
```

---

## First-Time Setup

### Step 1 — Install dependencies

```bash
npm install
```

### Step 2 — Add your resume PDF

Place your resume PDF at:
```
public/resume.pdf
```

This file is attached to every Gmail draft automatically. Update it whenever your resume changes.

### Step 3 — Update your resume data

Open `lib/resume.ts` — Claude reads this when generating application emails. It must match your actual resume. Update it whenever you change jobs or add skills.

### Step 4 — Get your API keys

You need credentials from 4 services:

---

#### A. Anthropic (Claude AI)
1. Go to https://console.anthropic.com/settings/keys
2. Click **Create Key**
3. Copy the key — starts with `sk-ant-api03-...`
4. Add billing at https://console.anthropic.com/settings/billing (costs ~$1–5/month)

---

#### B. Gmail API
The app saves email drafts to your Gmail via OAuth2.

1. Go to https://console.cloud.google.com
2. Create a new project
3. **APIs & Services → Library** → search "Gmail API" → Enable
4. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add `https://developers.google.com/oauthplayground` to **Authorized redirect URIs**
7. Copy **Client ID** and **Client Secret**

Get the Refresh Token:
1. Go to https://developers.google.com/oauthplayground
2. Click gear icon (top right) → check **Use your own OAuth credentials**
3. Enter your Client ID and Client Secret
4. In Step 1 → find `Gmail API v1` → select `https://mail.google.com/`
5. Click **Authorize APIs** → sign in
6. In Step 2 → click **Exchange authorization code for tokens**
7. Copy the **Refresh Token**

> The refresh token eventually expires. When it does, the WhatsApp will show `Gmail error: invalid_grant` — just repeat these steps to get a new one.

---

#### C. Twilio WhatsApp Sandbox
Free sandbox for sending WhatsApp messages without a business account.

1. Go to https://console.twilio.com → sign up
2. Go to **Messaging → Try it out → Send a WhatsApp message**
3. Your **Account SID** and **Auth Token** are on the dashboard home page
4. Sandbox FROM number is always: `whatsapp:+14155238886`
5. Your TO number: `whatsapp:+639060766219`

**Join the sandbox first (required):**
From your WhatsApp (+639060766219), send the join keyword to **+1 415 523 8886**.
The keyword is shown in the Twilio console — looks like `join <word>`.

> The sandbox expires after 72 hours of inactivity. If messages stop arriving, resend the join keyword.

---

#### D. JSearch API (RapidAPI)
Aggregates jobs from LinkedIn, Indeed, JobStreet, Glassdoor, and 100+ other boards.

1. Go to https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
2. Sign up → subscribe to **Basic (Free)** — 200 requests/month
3. Copy your **X-RapidAPI-Key**

> The app uses 3 requests per daily run. At 3/day × 30 days = 90/month, well within the 200 free limit.

---

### Step 5 — Create `.env.local`

Copy `.env.example` to `.env.local` and fill in all values:

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

# Cron security — any long random string
CRON_SECRET=change-this-to-a-long-random-string

# Toggle the cron on/off without redeploying
CRON_ENABLED=true

# App URL — update after deploying to Vercel
APP_URL=https://your-app.vercel.app

# Job filtering
JOB_MIN_SALARY_PHP=120000
JOB_KEYWORDS=fullstack,javascript,typescript,react,node
```

### Step 6 — Run locally

```bash
npm run dev
```

---

## Running the Job Scan

**From Git Bash (recommended on Windows):**
```bash
curl -H "Authorization: Bearer your-cron-secret" http://localhost:3000/api/cron
```

**From PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/cron" -Headers @{ Authorization = "Bearer your-cron-secret" }
```

**On Vercel (production):**
```bash
curl -H "Authorization: Bearer your-cron-secret" https://jobhunt.francisilacad.com/api/cron
```

Replace `your-cron-secret` with the value of `CRON_SECRET` in your `.env.local`.

---

## Dev Mode vs Production Mode

When running locally (`npm run dev`), `NODE_ENV` is automatically `development`. In this mode:
- Claude API is **not called** (saves tokens)
- WhatsApp is **not sent**
- The cron just fetches listings and prints them to the terminal

This lets you test the JSearch scraping without spending Claude credits.

**To test the full flow locally** (Claude + WhatsApp), temporarily set in `.env.local`:
```env
NODE_ENV=production
```
Restart the dev server, run the cron, then revert it back to `development`.

On Vercel, `NODE_ENV` is always `production` so the full flow runs automatically.

---

## Turning the Cron On and Off

**Via environment variable:**

In `.env.local` (or Vercel → Settings → Environment Variables):
```env
CRON_ENABLED=true    # on
CRON_ENABLED=false   # off
```
No redeployment needed on Vercel — takes effect on the next cron trigger.

**Via Vercel dashboard:**

Project → **Settings → Cron Jobs** → pause or resume directly.

---

## Testing WhatsApp

Verify Twilio is working before the first full run:

```bash
curl -H "Authorization: Bearer your-cron-secret" http://localhost:3000/api/test-whatsapp
```

You should receive a test message within seconds.

---

## Deploying to Vercel

```bash
npm i -g vercel
vercel
```

Add all `.env.local` keys to **Vercel → Project → Settings → Environment Variables**.

The cron schedule is in `vercel.json`:
```json
{ "crons": [{ "path": "/api/cron", "schedule": "0 1 * * *" }] }
```
`0 1 * * *` = 1:00 AM UTC = 9:00 AM PHT. Edit the schedule there to change the time.

**Custom domain:** `jobhunt.francisilacad.com` is configured in Vercel → Settings → Domains with a CNAME record in GoDaddy pointing to Vercel.

---

## What Claude Filters Out

Claude rejects a job if any of these are true:
- Stack is primarily Java, Python, .NET, PHP, Ruby, or Go
- Role is DevOps, Data/ML, or QA — even if it mentions JavaScript
- Not remote (hybrid only accepted if Philippines-based)
- Salary clearly below PHP 120,000/month (or ~USD 2,200/month)
- Junior or intern level (Francis has 4+ years experience)
- AI confidence in the match is below 60%

The WhatsApp "matched X out of Y analyzed" message tells you exactly how many were rejected and why.

---

## Common Issues

**WhatsApp shows `STATUS: FAILED` + `Gmail error: invalid_grant`**
→ Gmail refresh token expired. Redo the OAuth Playground steps (Section B) to get a new one.

**WhatsApp messages stop arriving**
→ Twilio sandbox expired (72hr inactivity). Resend the join keyword from your WhatsApp.

**"invalid x-api-key" in terminal logs**
→ Anthropic API key invalid or no billing credits. Check https://console.anthropic.com.

**"No fresh jobs found" every day**
→ Try changing `date_posted=week` to `date_posted=month` in `lib/scraper.ts`, or adjust the search queries to be more specific to your target roles.

**Cron runs but 0 jobs qualify**
→ Check the WhatsApp skip summary (e.g. "16 not JS stack"). The JSearch queries may need tuning in `lib/scraper.ts`.

---

## Costs

| Service | Cost |
|---|---|
| Vercel Hobby | Free |
| JSearch | Free (90/200 req/month used) |
| Twilio Sandbox | Free |
| Gmail API | Free |
| Claude API | ~$0.05–0.15 per daily run |

**Total: ~$1.50–4.50/month** depending on how many jobs qualify each day.
