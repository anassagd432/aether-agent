# Deployment Guide

## Vercel (Recommended)

### 1. Setup

1. Push your fork to GitHub
2. Import in [Vercel Dashboard](https://vercel.com/new)
3. Framework: **Vite** (auto-detected)
4. Build command: `pnpm build`
5. Output directory: `dist`

### 2. Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (Settings → API → service_role) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key (for cloud AI) |
| `OPENROUTER_API_KEY` | Optional | OpenRouter key for GPT-4o cloud access |
| `ALLOWED_ORIGIN` | ✅ | Your production URL (e.g. `https://agdi-dev.vercel.app`) |
| `MAILCHIMP_API_KEY` | Optional | For newsletter signup |
| `MAILCHIMP_LIST_ID` | Optional | Mailchimp audience ID |

> **Warning:** `SUPABASE_SERVICE_ROLE_KEY` has full admin access. Never expose it in client-side code or `.env` files committed to git.

### 3. Supabase Auth Providers

Configure these in Supabase Dashboard → Authentication → Providers:

#### GitHub OAuth (for developer sign-in)
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create OAuth App → Callback URL: `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
3. Copy Client ID and Client Secret into Supabase → Auth → Providers → GitHub

#### Google OAuth (for business owner sign-in)
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client → Authorized redirect URI: `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
3. Copy Client ID and Client Secret into Supabase → Auth → Providers → Google

#### Email (magic link)
1. Supabase → Auth → Providers → Email → Enable
2. Customize email templates in Supabase → Auth → Email Templates

### 4. Custom Domain

1. Vercel → Settings → Domains → Add your domain
2. Point DNS: `CNAME` record → `cname.vercel-dns.com`
3. Update `ALLOWED_ORIGIN` env var to match your domain
4. Update Supabase auth redirect URLs to include your domain

### 5. Security Headers

All production security headers (HSTS, CSP, CORS, Permissions-Policy, COOP/COEP) are configured in `vercel.json`. No additional setup needed.

### 6. Monitoring

- **Vercel Analytics** — Enable in Vercel Dashboard → Analytics
- **Supabase Dashboard** — Monitor auth, API usage, and database
- **Audit Logs** — CLI logs to `~/.agdi/audit.log`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails on Vercel | Check Node.js version is ≥ 20. Set in Vercel → Settings → General → Node.js Version |
| Auth redirects broken | Verify Supabase redirect URLs include your production domain |
| Cloud AI returns 401 | Check `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel env vars |
| Cloud AI returns 403 | User email not verified — check Supabase auth email confirmation |
| CORS errors | Update `ALLOWED_ORIGIN` env var to match your domain exactly |
| CSP blocks resources | Check `vercel.json` CSP header includes required domains |
