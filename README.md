# JobHunt — Automated Job Application Pipeline

An AI-powered job application automation built by **Francis Albert Ilacad**. Scrapes remote fullstack/JS roles, generates personalized application emails using Claude AI grounded in real resume facts, sends via Gmail, and pings WhatsApp after each application.

## Features

- 🔍 **Auto job scraping** — Daily cron scrapes Remotive, WeWorkRemotely, and Remote OK for matching JS/TS fullstack roles
- 🤖 **AI email generation** — Claude API generates truthful, tailored emails based on the job description and your real resume
- 📄 **Resume tailoring** — AI adjusts your resume highlights per job (kept truthful to your actual experience)
- 📧 **Gmail auto-send** — Sends application emails via Gmail API
- 📱 **WhatsApp notifications** — Twilio sandbox pings you after each application
- 🔗 **Manual mode** — Paste any job URL to generate a tailored email on-demand
- 💯 **100% free hosting** — Vercel + Twilio Sandbox + Gmail (no database needed)

## Tech Stack

- **Next.js 14** (App Router) — Frontend + API routes
- **Claude API** — Email + resume generation
- **Gmail API** — Email sending
- **Twilio WhatsApp** — Notifications
- **Cheerio** — Job board scraping
- **Vercel Cron** — Scheduled execution
- **Tailwind CSS** — Styling

## Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd jobhunt
npm install
```

### 2. Environment variables

Create `.env.local`:

```env
# Claude API — https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...

# Gmail — https://console.cloud.google.com (OAuth2 credentials)
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_FROM_EMAIL=your-email@gmail.com

# Twilio WhatsApp Sandbox — https://console.twilio.com
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WHATSAPP_TO=whatsapp:+639060766219

# Cron security
CRON_SECRET=any-long-random-string

# App config
APP_URL=https://your-app.vercel.app
JOB_MIN_SALARY_PHP=120000
JOB_KEYWORDS=fullstack,javascript,typescript,react,node
```

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:3000

### 4. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Then add all environment variables in the Vercel dashboard (Settings → Environment Variables).

## How the cron works

`vercel.json` schedules `/api/cron` to run daily at 9 AM PHT. Vercel's free tier allows 2 cron invocations per day, which is plenty for daily job hunting.

## Project structure

```
app/
  page.tsx              — Dashboard UI
  api/
    cron/route.ts       — Daily scraper trigger
    generate/route.ts   — AI email + resume generation
    send/route.ts       — Gmail send
    manual/route.ts     — Manual job URL processing
lib/
  resume.ts             — Your resume as structured data
  scraper.ts            — Job board scrapers
  claude.ts             — Anthropic API helpers
  gmail.ts              — Gmail API helpers
  whatsapp.ts           — Twilio WhatsApp helpers
```

## License

MIT — Built by Francis Albert Ilacad as both a job search tool and portfolio project.
