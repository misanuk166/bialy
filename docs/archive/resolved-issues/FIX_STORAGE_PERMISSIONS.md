# Fix Storage 400 Errors - Quick Guide

**Problem**: Metrics show "No data available" with 400 errors when loading CSV files from Supabase Storage.

**Cause**: Row Level Security (RLS) policies on storage bucket not configured correctly.

---

## Quick Fix (5 minutes)

### Step 1: Run SQL Script

1. **Go to Supabase SQL Editor**:
   - https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo/sql/new

2. **Copy & Paste** the SQL from `sql/fix_storage_permissions.sql`

3. **Click Run** (or press Cmd/Ctrl + Enter)

4. **Verify Output**: You should see 3 policies listed:
   ```
   Users can upload to own folder (INSERT)
   Users can download own files (SELECT)
   Users can delete own files (DELETE)
   ```

### Step 2: Check Storage Bucket Settings

1. **Go to Storage**:
   - https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo/storage/buckets

2. **Click on `csv-files` bucket**

3. **Check settings**:
   - ✅ **Public bucket**: Should be **OFF** (unchecked)
   - ✅ **File size limit**: 10MB or higher
   - ✅ **Allowed MIME types**: text/csv (or leave empty for all)

### Step 3: Test the Fix

1. **Hard refresh** the app: https://bialy.vercel.app (Cmd+Shift+R)

2. **Open browser console** (F12)

3. **Open your dashboard**

4. **Check console** - you should now see:
   ```
   ✓ Loaded "Customer Satisfaction Score" - 913 data points
   ✓ Loaded "Daily Active Users" - 913 data points
   ✓ Loaded "Revenue per Customer" - 913 data points
   ...
   ```

5. **Charts should display with data** ✅

---

## If Still Not Working

### Check 1: Verify Bucket Exists

In Supabase dashboard:
- Go to Storage → Buckets
- Confirm `csv-files` bucket exists
- If not, create it:
  - Name: `csv-files`
  - Public: **OFF**
  - File size limit: 10MB

### Check 2: Verify User Authentication

In browser console, run:
```javascript
console.log(await supabase.auth.getUser())
```

Should show your user object with `id` field. If not authenticated, sign in again.

### Check 3: Manual Policy Check

Run this SQL to see all storage policies:
```sql
SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
ORDER BY policyname;
```

Expected to see 3 policies for `csv-files` bucket.

### Check 4: Test File Upload/Download Manually

Try uploading a test file through Supabase dashboard:
1. Go to Storage → csv-files
2. Click your user ID folder (should match auth.uid())
3. Try uploading a CSV file
4. Try downloading it back

If this fails, RLS policies need debugging.

---

## Understanding the Error

**400 Bad Request** from storage means:
- The file exists in storage
- But RLS policy blocks you from reading it
- Policy checks folder name matches your user ID

**File path structure**:
```
csv-files/
  └── {userId}/           ← Must match auth.uid()
      └── metric-file.csv
```

**RLS Policy Logic**:
```sql
(storage.foldername(name))[1] = auth.uid()::text
```

This extracts the first folder from the path and checks it equals your user ID.

---

## Alternative: Temporarily Disable RLS (NOT RECOMMENDED)

**Only for testing** - this makes ALL files public:

```sql
-- TEMPORARY TEST ONLY - REMOVE AFTER TESTING
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

If this fixes it, the problem is definitely the RLS policies. Re-enable RLS and fix policies:

```sql
-- Re-enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Then run fix_storage_permissions.sql
```

---

## Success Checklist

After running the fix:

- [ ] SQL script ran without errors
- [ ] 3 storage policies exist
- [ ] csv-files bucket is private (not public)
- [ ] Hard refresh shows ✓ success messages in console
- [ ] All 10 metrics display with charts
- [ ] No more 400 errors in Network tab

---

## Still Having Issues?

If the fix doesn't work:

1. **Share the SQL output** from Step 1
2. **Share console logs** after refresh
3. **Share Network tab** showing the 400 request details
4. **Check Supabase logs** for more error details

---

**Last Updated**: January 7, 2026
