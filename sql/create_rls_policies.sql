-- ============================================================================
-- Bialy - Row Level Security (RLS) Policies Setup
-- ============================================================================
-- This script creates all necessary RLS policies for the Bialy application.
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo/sql/new
--
-- Date: January 7, 2026
-- Version: 1.0
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable RLS on all tables
-- ============================================================================

ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_configurations ENABLE ROW LEVEL SECURITY;

-- Optional: Enable on profiles table if it exists
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Drop existing policies (if re-running script)
-- ============================================================================

-- Drop dashboard policies
DROP POLICY IF EXISTS "Users can view own dashboards" ON dashboards;
DROP POLICY IF EXISTS "Anyone can view public dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can view domain dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can insert own dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can update own dashboards" ON dashboards;
DROP POLICY IF EXISTS "Users can delete own dashboards" ON dashboards;

-- Drop metrics policies
DROP POLICY IF EXISTS "Users can view metrics from accessible dashboards" ON metrics;
DROP POLICY IF EXISTS "Users can insert metrics to own dashboards" ON metrics;
DROP POLICY IF EXISTS "Users can update metrics in own dashboards" ON metrics;
DROP POLICY IF EXISTS "Users can delete metrics from own dashboards" ON metrics;

-- Drop metric_configurations policies
DROP POLICY IF EXISTS "Users can view configurations from accessible metrics" ON metric_configurations;
DROP POLICY IF EXISTS "Users can insert configurations to own metrics" ON metric_configurations;
DROP POLICY IF EXISTS "Users can update configurations in own metrics" ON metric_configurations;
DROP POLICY IF EXISTS "Users can delete configurations from own metrics" ON metric_configurations;

-- Drop storage policies
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can download own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- ============================================================================
-- STEP 3: Create Dashboard Policies
-- ============================================================================

-- Allow users to view their own dashboards
CREATE POLICY "Users can view own dashboards"
ON dashboards FOR SELECT
USING (auth.uid() = owner_id);

-- Allow anyone to view public dashboards
CREATE POLICY "Anyone can view public dashboards"
ON dashboards FOR SELECT
USING (permission_level = 'public');

-- Allow users to view dashboards shared with their domain
CREATE POLICY "Users can view domain dashboards"
ON dashboards FOR SELECT
USING (
  permission_level = 'domain'
  AND split_part(
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    '@',
    2
  ) = split_part(
    (SELECT email FROM auth.users WHERE id = owner_id),
    '@',
    2
  )
);

-- Allow users to create dashboards (must be owner)
CREATE POLICY "Users can insert own dashboards"
ON dashboards FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- Allow users to update their own dashboards
CREATE POLICY "Users can update own dashboards"
ON dashboards FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Allow users to delete their own dashboards
CREATE POLICY "Users can delete own dashboards"
ON dashboards FOR DELETE
USING (auth.uid() = owner_id);

-- ============================================================================
-- STEP 4: Create Metrics Policies
-- ============================================================================

-- Allow users to view metrics from dashboards they can access
CREATE POLICY "Users can view metrics from accessible dashboards"
ON metrics FOR SELECT
USING (
  dashboard_id IN (
    SELECT id FROM dashboards
    WHERE
      owner_id = auth.uid()
      OR permission_level = 'public'
      OR (
        permission_level = 'domain'
        AND split_part(
          (SELECT email FROM auth.users WHERE id = auth.uid()),
          '@',
          2
        ) = split_part(
          (SELECT email FROM auth.users WHERE id = dashboards.owner_id),
          '@',
          2
        )
      )
  )
);

-- Allow users to create metrics in their own dashboards
CREATE POLICY "Users can insert metrics to own dashboards"
ON metrics FOR INSERT
WITH CHECK (
  dashboard_id IN (
    SELECT id FROM dashboards WHERE owner_id = auth.uid()
  )
);

-- Allow users to update metrics in their own dashboards
CREATE POLICY "Users can update metrics in own dashboards"
ON metrics FOR UPDATE
USING (
  dashboard_id IN (
    SELECT id FROM dashboards WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  dashboard_id IN (
    SELECT id FROM dashboards WHERE owner_id = auth.uid()
  )
);

-- Allow users to delete metrics from their own dashboards
CREATE POLICY "Users can delete metrics from own dashboards"
ON metrics FOR DELETE
USING (
  dashboard_id IN (
    SELECT id FROM dashboards WHERE owner_id = auth.uid()
  )
);

-- ============================================================================
-- STEP 5: Create Metric Configurations Policies
-- ============================================================================

-- Allow users to view configurations from metrics they can access
CREATE POLICY "Users can view configurations from accessible metrics"
ON metric_configurations FOR SELECT
USING (
  metric_id IN (
    SELECT m.id FROM metrics m
    JOIN dashboards d ON m.dashboard_id = d.id
    WHERE
      d.owner_id = auth.uid()
      OR d.permission_level = 'public'
      OR (
        d.permission_level = 'domain'
        AND split_part(
          (SELECT email FROM auth.users WHERE id = auth.uid()),
          '@',
          2
        ) = split_part(
          (SELECT email FROM auth.users WHERE id = d.owner_id),
          '@',
          2
        )
      )
  )
);

-- Allow users to create configurations in their own metrics
CREATE POLICY "Users can insert configurations to own metrics"
ON metric_configurations FOR INSERT
WITH CHECK (
  metric_id IN (
    SELECT m.id FROM metrics m
    JOIN dashboards d ON m.dashboard_id = d.id
    WHERE d.owner_id = auth.uid()
  )
);

-- Allow users to update configurations in their own metrics
CREATE POLICY "Users can update configurations in own metrics"
ON metric_configurations FOR UPDATE
USING (
  metric_id IN (
    SELECT m.id FROM metrics m
    JOIN dashboards d ON m.dashboard_id = d.id
    WHERE d.owner_id = auth.uid()
  )
)
WITH CHECK (
  metric_id IN (
    SELECT m.id FROM metrics m
    JOIN dashboards d ON m.dashboard_id = d.id
    WHERE d.owner_id = auth.uid()
  )
);

-- Allow users to delete configurations from their own metrics
CREATE POLICY "Users can delete configurations from own metrics"
ON metric_configurations FOR DELETE
USING (
  metric_id IN (
    SELECT m.id FROM metrics m
    JOIN dashboards d ON m.dashboard_id = d.id
    WHERE d.owner_id = auth.uid()
  )
);

-- ============================================================================
-- STEP 6: Create Storage Bucket Policies
-- ============================================================================

-- Allow users to upload files to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'csv-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to download their own files
CREATE POLICY "Users can download own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'csv-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'csv-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- STEP 7: Verification Queries
-- ============================================================================

-- Verify RLS is enabled
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('dashboards', 'metrics', 'metric_configurations')
ORDER BY tablename;

-- Count policies per table
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('dashboards', 'metrics', 'metric_configurations')
GROUP BY tablename
ORDER BY tablename;

-- List all policy names
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('dashboards', 'metrics', 'metric_configurations')
ORDER BY tablename, cmd, policyname;

-- ============================================================================
-- Expected Results:
-- ============================================================================
--
-- RLS Enabled:
--   dashboards: t
--   metrics: t
--   metric_configurations: t
--
-- Policy Counts:
--   dashboards: 6
--   metrics: 4
--   metric_configurations: 4
--
-- Storage Policies:
--   3 policies on storage.objects for csv-files bucket
--
-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
