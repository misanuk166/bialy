-- =============================================
-- Bialy Storage Configuration
-- Migration 003: Storage Bucket and RLS Policies
-- =============================================

-- Note: Storage bucket creation must be done via Supabase Dashboard UI
-- This file contains the RLS policies for the storage bucket

-- =============================================
-- STORAGE BUCKET RLS POLICIES
-- =============================================

-- Create policy: Users can upload files to their own folder
CREATE POLICY "Users can upload to their own folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'csv-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create policy: Users can read files from dashboards they have access to
CREATE POLICY "Users can read files from accessible dashboards"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'csv-files' AND
    (
      -- User owns the file (first folder is their user_id)
      (storage.foldername(name))[1] = auth.uid()::text
      OR
      -- File is from a dashboard the user has access to
      EXISTS (
        SELECT 1 FROM public.metrics m
        JOIN public.dashboards d ON d.id = m.dashboard_id
        WHERE m.data_file_path = storage.objects.name
        AND (
          -- Owner can access
          d.owner_id = auth.uid()
          OR
          -- Domain sharing
          (
            d.permission_level = 'domain' AND
            SPLIT_PART((SELECT email FROM public.profiles WHERE id = auth.uid()), '@', 2) =
            SPLIT_PART((SELECT email FROM public.profiles WHERE id = d.owner_id), '@', 2)
          )
          OR
          -- Public dashboards
          d.permission_level = 'public'
        )
      )
    )
  );

-- Create policy: Users can update files in their own folder
CREATE POLICY "Users can update their own files"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'csv-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'csv-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create policy: Users can delete files in their own folder
CREATE POLICY "Users can delete their own files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'csv-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================
-- STORAGE BUCKET CONFIGURATION
-- =============================================
--
-- To create the bucket, go to Supabase Dashboard:
-- 1. Navigate to Storage
-- 2. Click "New bucket"
-- 3. Bucket name: csv-files
-- 4. Public bucket: OFF (private)
-- 5. File size limit: 10MB
-- 6. Allowed MIME types: text/csv, application/csv
--
-- After creating the bucket, run this SQL file to apply RLS policies
--
-- File Path Structure:
-- {user_id}/{dashboard_id}/{metric_id}.csv
-- Example: a1b2c3d4-e5f6-7890-abcd-ef1234567890/d1e2f3a4-b5c6-7890-def1-234567890abc/m1n2o3p4-q5r6-7890-ghi1-234567890def.csv
