# Fresh Mart – Production Setup & Deployment Guide

## 1. Local Installation

```bash
npm install
cp .env.example .env
# Fill in GEMINI_API_KEY, SUPABASE_*, WHATSAPP_*, and ADMIN_* in .env
npm run dev
```

Open `http://localhost:3000`.

## 2. Supabase Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run the migration scripts in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rpc_and_rls.sql`
   - `supabase/seed.sql`
3. Copy your project values into environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured, the backend automatically switches from the local development store to Supabase PostgreSQL + atomic `create_cod_order` RPC.

## 3. Initial Admin Setup & Fixed Karachi Delivery Fee

1. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a 64-character `ADMIN_SESSION_SECRET` in environment variables.
2. Sign in via **Admin** in the top navigation bar.
3. Open **Karachi Delivery** and configure:
   - Fixed Delivery Fee in PKR (required before COD orders can be placed)
   - Minimum Order Amount in PKR
   - Optional Free Delivery Threshold in PKR
   - Active Karachi Neighborhoods & Delivery Instructions

## 4. WhatsApp Business Cloud API Setup (Meta)

1. Create a Meta Developer app with the **WhatsApp** product.
2. Add your business phone (`03233469424` / `+923233469424`) and generate a permanent System User access token.
3. Set these server-only environment variables:
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_BUSINESS_ACCOUNT_ID`
   - `WHATSAPP_VERIFY_TOKEN`
   - `WHATSAPP_APP_SECRET`
4. Configure your Meta Webhook Callback URL to:
   `https://<your-domain>/api/whatsapp/webhook`
   with the matching `WHATSAPP_VERIFY_TOKEN` and subscribe to `messages` and `message_statuses`.

## 5. Gemini AI Setup

1. Obtain an API key from Google AI Studio (or configure `GEMINI_API_KEY` in AI Studio **Settings > Secrets**).
2. `Fresh Mart AI` runs exclusively on the backend (`/api/ai/chat`) using `@google/genai` (`gemini-4-hydrogen`) and function calling grounded in live database inventory, delivery settings, and order tracking.

## 6. Vercel Deployment

1. Push the repository to GitHub and import into Vercel.
2. `vercel.json` routes `/api/*` to `server.ts` and static assets from `dist/`.
3. Add all environment variables from `.env.example` in Vercel **Project Settings → Environment Variables**.
4. Deploy with `npm run build`.
