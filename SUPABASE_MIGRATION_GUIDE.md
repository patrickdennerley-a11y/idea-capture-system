# Supabase Migration Guide - Idea Storage

This guide will help you migrate the Idea Storage feature from local state to Supabase Database.

## 🎯 What's Been Done

✅ **Code Changes Complete:**
- `App.jsx` - Updated to fetch ideas from Supabase on login
- `IdeaCapture.jsx` - Updated to insert, update, and delete ideas in Supabase
- `src/utils/ideaMapper.js` - Created utility for snake_case/camelCase conversion
- `supabase-setup.sql` - SQL script ready to create the ideas table

✅ **Features Implemented:**
- Create new ideas (synced to Supabase)
- Read/fetch ideas from Supabase
- Update existing ideas (synced to Supabase)
- Delete ideas (synced from Supabase)
- User-specific data isolation (RLS policies)

## 📋 Setup Instructions

### Step 1: Create the Ideas Table in Supabase

1. **Open your Supabase project dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to the SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the SQL script**
   - Open the `supabase-setup.sql` file in this project
   - Copy all the contents
   - Paste into the Supabase SQL Editor
   - Click "Run" or press `Ctrl+Enter`

4. **Verify the setup**
   - The script will create the `ideas` table
   - Enable Row Level Security (RLS)
   - Create 4 security policies (SELECT, INSERT, UPDATE, DELETE)
   - Add a trigger for automatic `last_modified` updates
   - Show verification queries at the end

### Step 2: Test the Integration

1. **Login to your app**
   - The app should load without any ideas (fresh start)

2. **Create a new idea**
   - Type an idea in the capture form
   - Add tags, context, and/or due date
   - Click "Save Idea"
   - ✅ The idea should save to Supabase

3. **Verify data persistence**
   - Refresh the page
   - Your idea should still be there (loaded from Supabase)

4. **Test multi-device sync**
   - Login on another device/browser
   - You should see the same ideas
   - Changes on one device appear on the other after refresh

### Step 3: Verify RLS is Working

1. **Create a second test user**
   - Logout and create a new account
   - Add some ideas to this account

2. **Verify data isolation**
   - User A should only see User A's ideas
   - User B should only see User B's ideas
   - No cross-contamination between users

## 🗃️ Database Schema

The `ideas` table has the following structure:

```sql
ideas
├── id (uuid, primary key)
├── user_id (uuid, references auth.users)
├── content (text)
├── tags (text[])
├── context (text)
├── due_date (date)
├── classification_type (text)
├── duration (integer)
├── recurrence (text)
├── time_of_day (text)
├── priority (text)
├── auto_classified (boolean)
├── source (text)
├── created_at (timestamptz)
└── last_modified (timestamptz)
```

## 🔐 Security (Row Level Security)

RLS is **ENABLED** with the following policies:

1. **SELECT Policy**: Users can only view their own ideas
   ```sql
   auth.uid() = user_id
   ```

2. **INSERT Policy**: Users can only create ideas for themselves
   ```sql
   auth.uid() = user_id
   ```

3. **UPDATE Policy**: Users can only update their own ideas
   ```sql
   auth.uid() = user_id
   ```

4. **DELETE Policy**: Users can only delete their own ideas
   ```sql
   auth.uid() = user_id
   ```

## 🔄 Data Flow

### Create Idea
```
User types idea → Click Save → 
JavaScript object (camelCase) → 
jsToDb() converts to snake_case → 
Supabase INSERT → 
Return new row → 
dbToJs() converts to camelCase → 
Update local state → 
UI updates
```

### Fetch Ideas on Login
```
User logs in → 
App.jsx useEffect triggers → 
Supabase SELECT with ORDER BY created_at DESC → 
dbArrayToJs() converts all rows → 
setIdeas(jsIdeas) → 
IdeaCapture displays ideas
```

### Update Idea
```
User edits idea → Click Save in modal → 
jsToDb() converts to snake_case → 
Supabase UPDATE → 
Return updated row → 
dbToJs() converts to camelCase → 
Update local state → 
UI updates
```

### Delete Idea
```
User clicks delete → 
Supabase DELETE by id → 
Filter out from local state → 
UI updates
```

## 🧪 Testing Checklist

- [ ] Run the SQL setup script in Supabase SQL Editor
- [ ] Verify the `ideas` table was created
- [ ] Verify RLS is enabled (check Supabase Dashboard > Authentication > Policies)
- [ ] Login as User A and create 2-3 ideas
- [ ] Refresh the page - ideas should persist
- [ ] Edit an idea - changes should save
- [ ] Delete an idea - should remove from list
- [ ] Logout and login as User B
- [ ] Verify User B sees an empty list (User A's ideas are hidden)
- [ ] Create ideas for User B
- [ ] Verify User B's ideas don't appear for User A

## ⚠️ Important Notes

1. **Local Storage Removed**: The `ideas` data is no longer stored in localStorage. Only `logs`, `reviews`, `checklist`, and other app state still use localStorage.

2. **Auto-Classification**: The background classification feature still uses the API endpoint `/api/classify-idea` (requires backend setup).

3. **Drafts**: The auto-save draft feature (after 3 seconds of typing) still works locally but is not synced to the database. Only completed ideas are saved.

4. **Import/Export**: The import/export feature for ideas may need updates to work with the new database structure. Currently, it still uses the old format.

## 🔧 Troubleshooting

### "You must be logged in to save ideas"
- Ensure you're logged in
- Check that `user.id` is available in AuthContext

### Ideas not appearing after refresh
- Check the browser console for errors
- Verify the SQL script ran successfully
- Check Supabase Dashboard > Table Editor > ideas

### "Failed to save idea" error
- Check browser console for detailed error
- Verify RLS policies are set up correctly
- Ensure `user_id` is being set correctly in the insert

### Ideas from other users are visible
- Verify RLS is enabled: `ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;`
- Check that policies are created correctly
- Ensure `auth.uid()` matches `user_id` in policies

## 📞 Support

If you encounter issues:
1. Check the browser console for error messages
2. Check the Supabase Dashboard > Logs for database errors
3. Verify all SQL commands ran successfully
4. Ensure your Supabase connection credentials are correct in `.env`

## ✅ Success Criteria

You'll know the migration is successful when:
- ✅ New ideas save to Supabase
- ✅ Ideas persist after page refresh
- ✅ Ideas sync across devices/browsers when logged in as the same user
- ✅ Different users see only their own ideas (RLS working)
- ✅ Edit and delete operations work correctly
- ✅ No console errors related to idea operations
