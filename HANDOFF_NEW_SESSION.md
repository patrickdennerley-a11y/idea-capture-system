# Handoff for New Claude Code Session

## Goal
Merge Supabase integration with Railway deployment WITHOUT introducing bugs. The previous session (branch `claude/merge-supabase-railway-01H7wKGGf7fWs5tgtvz6WBUy`) introduced critical bugs that delete user data.

## Background

### What Works (origin/main)
- ✅ Railway deployment with correct config
- ✅ Server serves React frontend correctly
- ✅ All API endpoints working
- ✅ PWA features (icons, manifest)
- ✅ localStorage-based data storage works perfectly
- ✅ No bugs - users can save/edit/delete ideas without issues

### What We Want to Add (from claude/supabase-integration-setup-019jEt5NKZnVwwrNQhh4jX3k)
- ✅ Supabase cloud sync (ideas, logs, reviews)
- ✅ Authentication (password + magic link)
- ✅ Offline queue system
- ✅ Data migration from localStorage to Supabase
- ✅ Falls back to localStorage if Supabase not configured

### Critical Bugs Introduced in claude/merge-supabase-railway-01H7wKGGf7fWs5tgtvz6WBUy

**BUG #1: Sync button deletes all local data**
- File: `src/hooks/useSupabase.js` lines 91-115
- Problem: When user clicks "Sync" and Supabase is empty, it replaces local ideas with empty array
- Impact: **USER DATA LOSS** - all ideas deleted permanently

**BUG #2: Saving new idea makes it disappear**
- File: `src/hooks/useSupabase.js` lines 121-185 (saveToSupabase function)
- Problem: After attempting to fix Bug #1, the save logic broke
- Impact: Users cannot capture new ideas - they disappear on save

**BUG #3: Auth loading timeout may not work correctly**
- File: `src/contexts/AuthContext.jsx` lines 46-67
- Problem: Added timeout but logic may have race conditions
- Impact: Some users stuck on "Loading..." after clicking magic link

## Task for New Session

### Step 1: Create Fresh Branch
```bash
git checkout origin/main
git checkout -b claude/clean-supabase-merge-[YOUR_SESSION_ID]
```

### Step 2: Identify Good Files from Supabase Branch
These files from `claude/supabase-integration-setup-019jEt5NKZnVwwrNQhh4jX3k` are GOOD (no bugs):
- `src/components/Auth.jsx` - Authentication UI
- `src/utils/supabaseClient.js` (ORIGINAL, not my modified version with debug logs)
- `src/utils/dataMigration.js` - Data migration utilities
- `src/utils/offlineQueue.js` - Offline queue system
- `supabase-schema.sql` - Database schema
- `SUPABASE_SETUP.md` - Setup documentation
- `.env.example` - Environment variable examples

### Step 3: Critical Files That Need Careful Merging

#### `src/hooks/useSupabase.js`
**PROBLEM:** My version (commit 8948424) has bugs. Use the ORIGINAL from `claude/supabase-integration-setup-019jEt5NKZnVwwrNQhh4jX3k` BUT with this critical fix:

**Original Bug (lines 91-103):**
```javascript
const transformedData = transformFromSupabase(supabaseData);
setData(transformedData);
saveToLocalStorage(transformedData);  // ❌ Overwrites local data even if Supabase empty!
```

**Correct Fix:**
```javascript
const transformedData = transformFromSupabase(supabaseData);
const localData = loadFromLocalStorage();

// Only replace local data if:
// 1. Supabase has data, OR
// 2. Local data is empty (nothing to lose)
const shouldUseSupabase =
  (Array.isArray(transformedData) && transformedData.length > 0) ||
  (Array.isArray(localData) && localData.length === 0);

if (shouldUseSupabase) {
  setData(transformedData);
  saveToLocalStorage(transformedData);
} else {
  // Keep local data, warn user to migrate
  console.warn(`Keeping local data for ${tableName}. Use migration to sync to cloud.`);
  setData(localData);
}
```

#### `src/contexts/AuthContext.jsx`
**PROBLEM:** My timeout fix (commit f3fddcc) may have race conditions.

**Better approach:**
```javascript
useEffect(() => {
  if (!isSupabaseConfigured()) {
    setLoading(false);
    return;
  }

  let mounted = true;

  const initializeAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error getting session:', error);
      if (mounted) setLoading(false);
    }
  };

  // Set timeout as safety net
  const timeout = setTimeout(() => {
    if (mounted && loading) {
      console.warn('Auth timeout');
      setLoading(false);
    }
  }, 10000);

  initializeAuth();

  const { data: { subscription } } = onAuthStateChange((event, session) => {
    if (mounted) {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }
  });

  return () => {
    mounted = false;
    clearTimeout(timeout);
    subscription?.unsubscribe();
  };
}, []);
```

#### `src/App.jsx`
**MERGE CAREFULLY:**
- Keep all Supabase imports and hooks from Supabase branch
- Keep Railway-compatible code from main
- Test that ideas/logs/reviews work correctly in BOTH modes:
  - localStorage-only (when Supabase not configured)
  - Supabase mode (when env vars set)

### Step 4: Railway Configuration
Keep from origin/main (these are correct):
- `railway.json` - Clean config, no invalid fields
- NO `railway.toml` - This file should NOT exist

Required Railway environment variables:
```bash
NODE_ENV=production  # ❌ NOT development!
ANTHROPIC_API_KEY=sk-ant-...
VITE_SUPABASE_URL=https://xxx.supabase.co  # Optional
VITE_SUPABASE_ANON_KEY=eyJ...  # Optional
```

### Step 5: Testing Checklist

**Before pushing to Railway:**
1. Test localStorage-only mode (no Supabase env vars):
   - ✅ Can save ideas
   - ✅ Ideas persist after refresh
   - ✅ Can edit ideas
   - ✅ Can delete ideas
   - ✅ No errors in console

2. Test Supabase mode (with env vars):
   - ✅ Can authenticate with magic link
   - ✅ Can save ideas to Supabase
   - ✅ Ideas sync across devices
   - ✅ Migration prompt appears when local data exists
   - ✅ Migration works without data loss
   - ✅ Sync button doesn't delete data

3. Test edge cases:
   - ✅ Clicking sync when Supabase is empty doesn't delete local ideas
   - ✅ Saving idea immediately shows in list
   - ✅ Auth timeout doesn't cause infinite loading
   - ✅ Offline mode queues operations correctly

## Files Changed Summary

From `claude/supabase-integration-setup-019jEt5NKZnVwwrNQhh4jX3k`:
- Added: 8 new files (Auth, hooks, utils, schema)
- Modified: 6 existing files (App.jsx, main.jsx, package.json, etc.)

From origin/main (must preserve):
- railway.json (clean config)
- server.cjs (working frontend serving)
- All component files with relative API URLs

## Expected Result

After successful merge:
- ✅ Railway deployment works (uses correct railway.json)
- ✅ Supabase optional (falls back to localStorage)
- ✅ NO data loss bugs
- ✅ Auth works with timeout safety
- ✅ Migration feature works correctly
- ✅ All existing features from main still work

## Commands for New Session

```bash
# Start fresh
git fetch origin
git checkout origin/main
git checkout -b claude/clean-supabase-merge-[SESSION_ID]

# Cherry-pick good commits from Supabase branch
# (Manually inspect and test each one)

# Build and test locally
npm install
npm run build
npm start  # Test server

# Only push when ALL tests pass
git push -u origin claude/clean-supabase-merge-[SESSION_ID]
```

## What NOT to Do

❌ Don't blindly merge `claude/merge-supabase-railway-01H7wKGGf7fWs5tgtvz6WBUy` - it has bugs
❌ Don't trust my modified `useSupabase.js` - start from the original
❌ Don't use `railway.toml` - only use `railway.json`
❌ Don't set `NODE_ENV=development` in Railway - must be `production`
❌ Don't skip testing - data loss bugs are unacceptable

## Priority

**CRITICAL:** User data integrity is #1 priority. If unsure, keep localStorage working perfectly and make Supabase optional/experimental.

Better to ship without Supabase than to ship with data loss bugs.
