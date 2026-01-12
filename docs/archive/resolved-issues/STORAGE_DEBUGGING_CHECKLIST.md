# Storage Debugging Checklist

## Current Issue
Files upload successfully, pass verification (including download), but disappear from storage within seconds/minutes.

## Evidence
- Upload logs show: `[VERIFY] ✓ File verified (list + download) - 31199 bytes in 769ms`
- After refresh: `[LOAD] ✗ File does not exist` for ALL files
- `check-storage.js` confirms: `NO FILES FOUND IN STORAGE`

## What to Check in Supabase Dashboard

### 1. Storage Bucket Configuration
**Path**: Storage → csv-files bucket → Settings

Check for:
- [ ] **Auto-deletion policies** - any cleanup rules?
- [ ] **Bucket is PUBLIC** - should be checked/enabled
- [ ] **File size limits** - should be reasonable (e.g., 50MB+)
- [ ] **Allowed MIME types** - should include `text/csv` or `*`

### 2. Check ALL RLS Policies on storage.objects
**Path**: Database → Policies → Filter by "storage.objects"

Look for:
- [ ] Any policies with `FOR DELETE` we didn't explicitly create
- [ ] Any policies with `{public}` role (should be none)
- [ ] Any policies with wildcards or overly permissive conditions
- [ ] Any policies NOT listed in our SQL script

**Expected policies (ONLY these 3)**:
1. "Users can upload to own folder" - FOR INSERT TO authenticated
2. "Users can download own files" - FOR SELECT TO authenticated
3. "Users can delete own files" - FOR DELETE TO authenticated

### 3. Check for Database Triggers
**Path**: Database → Triggers

Look for:
- [ ] Any triggers on `storage.objects` table
- [ ] Any triggers on `storage.buckets` table
- [ ] Any triggers with DELETE operations

### 4. Check Bucket "Public" Setting
**Path**: Storage → csv-files bucket

Verify:
- [ ] **Public bucket** checkbox is ENABLED
- [ ] **Public URL access** is working

### 5. Check Storage Logs
**Path**: Logs → Filter by Storage

Look for:
- [ ] DELETE operations happening automatically
- [ ] Failed INSERT operations
- [ ] Permission errors

## Quick SQL Diagnostics

Run these in SQL Editor to check current state:

```sql
-- 1. Check ALL policies on storage.objects
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects';

-- 2. Check bucket configuration
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE name = 'csv-files';

-- 3. Check for any triggers
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'storage'
  AND event_object_table IN ('objects', 'buckets');

-- 4. Try to manually check if any files exist (run as authenticated user)
SELECT
  name,
  bucket_id,
  created_at,
  metadata
FROM storage.objects
WHERE bucket_id = 'csv-files'
ORDER BY created_at DESC
LIMIT 10;
```

## Next Steps

After checking above:
1. Share screenshots or output from the checks
2. Share results of the SQL queries
3. We'll identify what's deleting the files and fix it
