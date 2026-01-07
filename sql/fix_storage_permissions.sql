-- ============================================================================
-- Fix Supabase Storage Permissions for CSV Files
-- ============================================================================
-- Run this in Supabase SQL Editor to fix 400 errors when downloading CSV files
-- https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo/sql/new
-- ============================================================================

-- Step 1: Drop existing storage policies (if any)
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can download own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Step 2: Create storage policies for csv-files bucket
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

-- Step 3: Verify policies were created
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
ORDER BY policyname;

-- ============================================================================
-- Expected Output: 3 policies
-- - Users can upload to own folder (INSERT)
-- - Users can download own files (SELECT)
-- - Users can delete own files (DELETE)
-- ============================================================================
