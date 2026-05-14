# Setup Guide

Complete walkthrough to get JobHunt running on the free tier.

---

## 1. Claude API Key (5 mins)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / log in
3. Settings → API Keys → Create Key
4. Copy the key (starts with `sk-ant-...`)
5. Add ~$5 credit (this lasts a long time at Claude API pricing)

→ Save as `ANTHROPIC_API_KEY` in `.env.local`

---

## 2. Gmail API (15 mins, trickiest part)

### Create a Google Cloud project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create new project → name it "JobHunt"
3. Enable Gmail API: APIs & Services → Library → search "Gmail API" → Enable

### Create OAuth credentials
1. APIs & Services → OAuth consent screen → External → fill in app name, your email
2. Add your email as a test user
3. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
4. Application type: **Web application**
5. Authorized redirect URI: `https://developers.google.com/oauthplayground`
6. Save the Client ID and Client Secret

### Get a refresh token
1. Go to [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)
2. Top-right gear icon → check "Use your own OAuth credentials" → paste Client ID + Secret
3. In left panel scroll to "Gmail API v1" → select scope: `https://mail.google.com/`
4. Click "Authorize APIs" → sign in with your Gmail
5. Click "Exchange authorization code for tokens"
6. Copy the **refresh_token** value

→ Save as `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_FROM_EMAIL` in `.env.local`

---

## 3. Twilio WhatsApp Sandbox (5 mins)

1. Sign up at [twilio.com](https://www.twilio.com/try-twilio) (free, no credit card needed)
2. Console → Messaging → Try it out → Send a WhatsApp message
3. You'll see a sandbox number (e.g. `+1 415 523 8886`) and a join code (e.g. `join puppy-cat`)
4. From your WhatsApp, send `join puppy-cat` to that number
5. You'll get confirmation that you're in the sandbox
6. From the Twilio console main page, copy:
   - Account SID
   - Auth Token

→ Save in `.env.local`:
```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WHATSAPP_TO=whatsapp:+639060766219
```

**Important**: The sandbox session stays alive as long as you receive a message at least every 3 days. Since the app sends daily, this won't expire.

---

## 4. Vercel Deployment (5 mins)

### Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create jobhunt --public --source=. --push
```

### Deploy
```bash
npm i -g vercel
vercel
```

Follow the prompts. After first deploy:

1. Go to your project on [vercel.com/dashboard](https://vercel.com/dashboard)
2. Settings → Environment Variables
3. Add ALL the variables from your `.env.local`
4. Settings → Cron Jobs → verify `/api/cron` is scheduled for `0 1 * * *` (1 AM UTC = 9 AM Manila)
5. Redeploy: `vercel --prod`

Your app is now live at `your-project.vercel.app`!

---

## 5. Optional — Custom Domain

If you have a domain like `francisilacad.dev`:
1. In Vercel project → Settings → Domains → Add
2. Follow DNS setup instructions
3. Free SSL is automatic

---

## Cost Summary

| Service | Free Tier | Your Usage |
|---|---|---|
| Vercel | 100 GB bandwidth, unlimited cron | Way under |
| Claude API | Pay-per-use | ~$0.01 per email generated |
| Gmail API | 1B requests/day | A few per day |
| Twilio WhatsApp Sandbox | Unlimited | ✅ |
| GitHub | Unlimited public repos | ✅ |

**Total monthly cost: $0–$1** depending on how many applications you send.

---

## Daily Workflow

**Automatic** (runs at 9 AM PHT every day):
1. Cron triggers `/api/cron`
2. Scrapes Remotive + RemoteOK for matching JS/TS roles
3. Top 3 jobs get AI-generated emails saved as Gmail DRAFTS (you review before sending)
4. WhatsApp pings you for each draft with preview + match score
5. You open Gmail, review, edit if needed, hit send

**Manual** (anytime):
1. Visit your dashboard
2. Paste a job URL or description
3. Click "Generate application"
4. Review the AI email + tailored resume highlights
5. Click "Send + notify WhatsApp" or "Save as Gmail draft"

---

## Troubleshooting

**Cron isn't firing**: Check Vercel project → Logs. Make sure `CRON_SECRET` is set as env var.

**Gmail API errors**: Refresh tokens can expire if the OAuth app is in "Testing" mode for >7 days. Move app to "Production" in Google Cloud Console (no review needed for personal use).

**WhatsApp not arriving**: Sandbox session expired. Re-send the join code from your phone.

**AI returns invalid JSON**: Rare but possible. The `lib/claude.ts` parser throws — retry the request.
