-- ============================================================================
-- Fix Supabase Storage Permissions for CSV Files
-- ============================================================================
-- Run this in Supabase SQL Editor to fix 400 errors when downloading CSV files
-- https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo/sql/new
-- ============================================================================

-- Step 1: Ensure RLS is enabled on storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing storage policies (if any)
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can download own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Step 3: Create storage policies for csv-files bucket
-- These policies allow users to manage files in their own user ID folder

-- Upload: Users can upload to their own folder (userId/*)
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'csv-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Download: Users can download from their own folder (userId/*)
CREATE POLICY "Users can download own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'csv-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Delete: Users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'csv-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Step 4: Verify RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'storage'
  AND tablename = 'objects';

-- Expected: rls_enabled = true

-- Step 5: Verify policies were created
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

-- Expected Output: 3 policies
-- - Users can upload to own folder (INSERT)
-- - Users can download own files (SELECT)
-- - Users can delete own files (DELETE)

-- Step 6: Check csv-files bucket configuration
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE name = 'csv-files';

-- Expected: public = false

-- Step 7: Count files in csv-files bucket
SELECT
  COUNT(*) as total_files,
  bucket_id,
  (storage.foldername(name))[1] as user_folder
FROM storage.objects
WHERE bucket_id = 'csv-files'
GROUP BY bucket_id, user_folder;

-- Shows how many files per user folder

-- ============================================================================
-- TROUBLESHOOTING NOTES:
-- If you still get 400 errors after running this:
-- 1. Verify the bucket name is exactly 'csv-files' (Step 6)
-- 2. Verify files exist in storage (Step 7)
-- 3. Verify your user ID matches the folder names in storage
-- 4. Check browser console for auth.uid() value
-- 5. Hard refresh the app (Cmd+Shift+R or Ctrl+Shift+R)
-- ============================================================================
