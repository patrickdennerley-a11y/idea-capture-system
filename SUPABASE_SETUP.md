# Supabase Integration Setup Guide

This guide will help you set up Supabase for cloud sync and authentication in Neural Capture.

## Why Supabase?

Neural Capture now supports cloud sync via Supabase, solving the iOS PWA limitation where Safari and home screen apps have separate localStorage instances. With Supabase:

- ✅ Sync data across all devices (iPhone, iPad, laptop)
- ✅ Share data between Safari and home screen PWA
- ✅ Real-time updates across devices
- ✅ Offline support with automatic sync
- ✅ Secure authentication with magic links (passwordless)
- ✅ Automatic conflict resolution

## Prerequisites

- A Supabase account (free tier is perfect for personal use)
- Node.js and npm installed

## Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Sign up or log in
3. Click **"New Project"**
4. Fill in:
   - **Project Name**: `neural-capture` (or your preferred name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose the closest region to you
   - **Pricing Plan**: Free tier is sufficient
5. Click **"Create new project"** (takes ~2 minutes)

## Step 2: Set Up Database Schema

1. In your Supabase project, go to the **SQL Editor** tab
2. Click **"New Query"**
3. Copy the entire contents of `supabase-schema.sql` from the project root
4. Paste it into the SQL editor
5. Click **"Run"** or press `Ctrl+Enter`
6. You should see: `Success. No rows returned`

This creates all the necessary tables, indexes, Row Level Security (RLS) policies, and triggers.

## Step 3: Configure Environment Variables

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJhbGc...`)

3. Create a `.env` file in the project root:

```bash
cp .env.example .env
```

4. Edit `.env` and add your Supabase credentials:

```env
# Anthropic API Key
ANTHROPIC_API_KEY=your_api_key_here

# Server Configuration
PORT=3001
NODE_ENV=development

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 4: Enable Real-time (Optional but Recommended)

For instant sync across devices:

1. In Supabase dashboard, go to **Database** → **Replication**
2. Enable replication for all tables:
   - `ideas`
   - `logs`
   - `checklist_items`
   - `reviews`
   - `routines`
   - `reminder_history`
   - `timetable`

3. Alternatively, run this SQL in the SQL Editor:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE ideas;
ALTER PUBLICATION supabase_realtime ADD TABLE logs;
ALTER PUBLICATION supabase_realtime ADD TABLE checklist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE routines;
ALTER PUBLICATION supabase_realtime ADD TABLE reminder_history;
ALTER PUBLICATION supabase_realtime ADD TABLE timetable;
```

## Step 5: Configure Authentication

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. **Email** provider is enabled by default
3. For magic links (passwordless - recommended for ADHD-friendly UX):
   - Email provider settings → Enable **"Enable Email OTP"**
   - Customize email templates if desired

4. **Optional**: Configure redirect URLs
   - Go to **Authentication** → **URL Configuration**
   - Add your production URL (e.g., `https://idea-capture-system-production.up.railway.app`)
   - Add localhost for development: `http://localhost:5173`

## Step 6: Test Locally

1. Install dependencies (if not already done):

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open [http://localhost:5173](http://localhost:5173)
4. You should see the authentication screen
5. Try signing up with magic link or email/password
6. Check your email for the confirmation/magic link
7. After login, you should see the main app

## Step 7: Test Data Migration

If you already have data in localStorage:

1. Log in to the app
2. You'll see a migration prompt with the number of items to migrate
3. Click **"Migrate Now"**
4. Wait for confirmation (usually takes 1-5 seconds)
5. Your data is now in the cloud!

## Step 8: Deploy to Railway

1. In your Railway project settings, add environment variables:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
   - `ANTHROPIC_API_KEY`: Your existing API key
   - `PORT`: 3001
   - `NODE_ENV`: production

2. Push your changes to the branch:

```bash
git add .
git commit -m "Add Supabase integration for cloud sync"
git push -u origin claude/supabase-integration-setup-019jEt5NKZnVwwrNQhh4jX3k
```

3. Railway will auto-deploy from the branch

## How It Works

### Dual-Mode Operation

The app intelligently operates in two modes:

1. **Cloud Mode** (when Supabase is configured):
   - All data syncs to Supabase
   - Real-time updates across devices
   - Offline queue for pending changes
   - Automatic migration from localStorage

2. **Local Mode** (when Supabase is not configured):
   - Falls back to localStorage
   - No auth required
   - Works completely offline
   - Same functionality, just no sync

### Authentication Flow

1. User opens app
2. If Supabase configured and not logged in → Show auth screen
3. User can choose:
   - **Magic Link** (passwordless, ADHD-friendly) - Default
   - **Email + Password** (traditional)
4. After login → Check for localStorage data
5. If data exists → Prompt to migrate
6. User can skip migration and do it later

### Data Sync

- **Writes**: Debounced 500ms → Save to Supabase → Also save to localStorage (backup)
- **Reads**: Load from Supabase → Cache in localStorage (offline access)
- **Offline**: Queue changes → Auto-sync when back online
- **Real-time**: Subscribe to changes → Update UI instantly

### Conflict Resolution

Currently using "last-write-wins" strategy:
- Timestamp comparison
- Most recent update wins
- Future enhancement: User-prompted resolution for important conflicts

## Testing Checklist

- [ ] Can sign up with magic link
- [ ] Can sign in with email/password
- [ ] Data migration works (if you have existing data)
- [ ] Adding an idea saves to Supabase
- [ ] Idea appears in Supabase dashboard (Database → Table Editor)
- [ ] Opening app in new browser/device shows same data after login
- [ ] Offline mode works (disable network, add data, re-enable, see it sync)
- [ ] Sign out works
- [ ] Real-time sync works (open two browser windows, change in one, see in other)

## Troubleshooting

### "Supabase is not configured"

- Check `.env` file exists and has correct values
- Restart dev server after changing `.env`
- In production, verify Railway environment variables

### Authentication not working

- Check Supabase Auth settings
- Verify redirect URLs are configured
- Check browser console for errors
- Confirm email provider is enabled

### Data not syncing

- Check browser console for errors
- Verify RLS policies are created (Step 2)
- Test connection: `supabase.auth.getSession()` in console
- Check Supabase logs (Dashboard → Logs)

### Migration failed

- Check browser console for error details
- Verify database schema is created correctly
- Ensure user is authenticated
- Try migrating one table at a time (modify `dataMigration.js`)

## Architecture

```
┌─────────────────────────────────────────┐
│           Neural Capture App            │
│                                         │
│  ┌─────────────┐      ┌──────────────┐ │
│  │   React UI  │◄────►│ Auth Context │ │
│  └─────────────┘      └──────────────┘ │
│         │                     │         │
│         ▼                     ▼         │
│  ┌─────────────┐      ┌──────────────┐ │
│  │  Components │◄────►│ useSupabase  │ │
│  └─────────────┘      │     Hook     │ │
│                       └──────────────┘ │
│                              │         │
│         ┌────────────────────┼─────┐   │
│         ▼                    ▼     ▼   │
│  ┌────────────┐    ┌──────────────────┐│
│  │localStorage│◄──►│ Supabase Client  ││
│  │  (backup)  │    │   (cloud sync)   ││
│  └────────────┘    └──────────────────┘│
└─────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Supabase Cloud │
                    │                  │
                    │  • PostgreSQL DB │
                    │  • Real-time     │
                    │  • Auth          │
                    │  • Storage       │
                    └──────────────────┘
```

## Cost Estimation

Supabase Free Tier includes:
- **Database**: 500MB storage
- **Auth**: Unlimited users
- **Bandwidth**: 2GB per month
- **Real-time**: 200 concurrent connections

For personal use (1 user, ~1000 ideas, ~500 logs):
- **Storage**: ~5MB (plenty of room!)
- **Bandwidth**: ~10MB/month
- **Cost**: $0/month 🎉

If you exceed free tier limits, Pro plan is $25/month with:
- 8GB storage
- 50GB bandwidth
- 500 concurrent real-time connections

## Security Notes

- ✅ Row Level Security (RLS) ensures users only see their own data
- ✅ API keys are public-safe (anon key only allows authenticated operations)
- ✅ Never commit `.env` file to git (already in `.gitignore`)
- ✅ Use magic links to avoid password fatigue
- ✅ All connections are encrypted (HTTPS/WSS)

## Next Steps

After setup, consider:

1. **Custom domain**: Configure in Railway
2. **Email templates**: Customize in Supabase Auth settings
3. **Backup strategy**: Export data regularly (Supabase dashboard → Database → Backups)
4. **Analytics**: Enable Supabase Analytics for usage insights
5. **Social auth**: Add Google/GitHub login (Supabase Auth → Providers)

## Support

- **Supabase Docs**: [https://supabase.com/docs](https://supabase.com/docs)
- **Supabase Discord**: [https://discord.supabase.com](https://discord.supabase.com)
- **Project Issues**: [GitHub Issues](https://github.com/yourusername/neural-capture/issues)

---

**Happy syncing! 🧠☁️**
