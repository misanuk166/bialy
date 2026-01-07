# Row Level Security (RLS) Policy Verification

**Date**: January 7, 2026
**Status**: ⚠️ VERIFICATION REQUIRED
**Priority**: 🔴 CRITICAL - Must be completed before production launch

---

## Overview

This document provides step-by-step instructions to verify that all required Row Level Security (RLS) policies are correctly configured in Supabase.

**Why This Matters**: RLS policies are the primary security mechanism preventing unauthorized data access. Without proper policies, users could view, modify, or delete data they shouldn't have access to.

---

## Database Schema

Based on codebase analysis, the following tables exist:

### 1. `dashboards` Table
```sql
CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'private' CHECK (permission_level IN ('private', 'domain', 'public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2. `metrics` Table
```sql
CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT,
  data_file_path TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3. `metric_configurations` Table
```sql
CREATE TABLE metric_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id UUID NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  config_type TEXT NOT NULL,
  config_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4. `profiles` Table (Optional - for user metadata)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5. Storage Bucket: `csv-files`
- Private bucket for storing CSV files
- Files stored at path: `{user_id}/{timestamp}-{filename}.csv`

---

## Required Indexes

```sql
-- Dashboard indexes
CREATE INDEX idx_dashboards_owner_id ON dashboards(owner_id);
CREATE INDEX idx_dashboards_permission_level ON dashboards(permission_level);
CREATE INDEX idx_dashboards_updated_at ON dashboards(updated_at DESC);

-- Metrics indexes
CREATE INDEX idx_metrics_dashboard_id ON metrics(dashboard_id);
CREATE INDEX idx_metrics_order_index ON metrics(dashboard_id, order_index);

-- Metric configurations indexes
CREATE INDEX idx_metric_configs_metric_id ON metric_configurations(metric_id);
CREATE INDEX idx_metric_configs_type ON metric_configurations(metric_id, config_type);
```

---

## Step 1: Verify RLS is Enabled

### Instructions:
1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `bialy-production`
3. Go to **Database** → **Tables**
4. For each table (`dashboards`, `metrics`, `metric_configurations`, `profiles`), click on the table
5. Check if **RLS Enabled** toggle is ON

### Verification Query:
Run this in **SQL Editor**:

```sql
-- Check RLS status for all tables
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('dashboards', 'metrics', 'metric_configurations', 'profiles')
ORDER BY tablename;
```

### Expected Result:
All tables should have `rls_enabled = true`

**✅ Pass Criteria**: All 4 tables show RLS enabled
**❌ Fail Action**: Enable RLS on tables where it's disabled

---

## Step 2: Verify `dashboards` Table Policies

### Required Policies:

#### Policy 1: Users can view their own dashboards
```sql
CREATE POLICY "Users can view own dashboards"
ON dashboards
FOR SELECT
USING (auth.uid() = owner_id);
```

#### Policy 2: Users can view public dashboards
```sql
CREATE POLICY "Anyone can view public dashboards"
ON dashboards
FOR SELECT
USING (permission_level = 'public');
```

#### Policy 3: Users can view domain-shared dashboards
```sql
CREATE POLICY "Users can view domain dashboards"
ON dashboards
FOR SELECT
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
```

#### Policy 4: Users can insert their own dashboards
```sql
CREATE POLICY "Users can insert own dashboards"
ON dashboards
FOR INSERT
WITH CHECK (auth.uid() = owner_id);
```

#### Policy 5: Users can update their own dashboards
```sql
CREATE POLICY "Users can update own dashboards"
ON dashboards
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);
```

#### Policy 6: Users can delete their own dashboards
```sql
CREATE POLICY "Users can delete own dashboards"
ON dashboards
FOR DELETE
USING (auth.uid() = owner_id);
```

### Verification Query:
```sql
-- List all policies on dashboards table
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'dashboards'
ORDER BY policyname;
```

### Expected Result:
Should see 6 policies listed above (or combined equivalents)

**✅ Pass Criteria**: All 6 policies exist with correct logic
**❌ Fail Action**: Create missing policies using SQL scripts in Step 6

---

## Step 3: Verify `metrics` Table Policies

### Required Policies:

#### Policy 1: Users can view metrics from accessible dashboards
```sql
CREATE POLICY "Users can view metrics from accessible dashboards"
ON metrics
FOR SELECT
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
```

#### Policy 2: Users can insert metrics to their own dashboards
```sql
CREATE POLICY "Users can insert metrics to own dashboards"
ON metrics
FOR INSERT
WITH CHECK (
  dashboard_id IN (
    SELECT id FROM dashboards WHERE owner_id = auth.uid()
  )
);
```

#### Policy 3: Users can update metrics in their own dashboards
```sql
CREATE POLICY "Users can update metrics in own dashboards"
ON metrics
FOR UPDATE
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
```

#### Policy 4: Users can delete metrics from their own dashboards
```sql
CREATE POLICY "Users can delete metrics from own dashboards"
ON metrics
FOR DELETE
USING (
  dashboard_id IN (
    SELECT id FROM dashboards WHERE owner_id = auth.uid()
  )
);
```

### Verification Query:
```sql
-- List all policies on metrics table
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'metrics'
ORDER BY policyname;
```

### Expected Result:
Should see 4 policies listed above

**✅ Pass Criteria**: All 4 policies exist with correct logic
**❌ Fail Action**: Create missing policies using SQL scripts in Step 6

---

## Step 4: Verify `metric_configurations` Table Policies

### Required Policies:

#### Policy 1: Users can view configurations from accessible metrics
```sql
CREATE POLICY "Users can view configurations from accessible metrics"
ON metric_configurations
FOR SELECT
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
```

#### Policy 2: Users can insert configurations to metrics in their dashboards
```sql
CREATE POLICY "Users can insert configurations to own metrics"
ON metric_configurations
FOR INSERT
WITH CHECK (
  metric_id IN (
    SELECT m.id FROM metrics m
    JOIN dashboards d ON m.dashboard_id = d.id
    WHERE d.owner_id = auth.uid()
  )
);
```

#### Policy 3: Users can update configurations in their metrics
```sql
CREATE POLICY "Users can update configurations in own metrics"
ON metric_configurations
FOR UPDATE
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
```

#### Policy 4: Users can delete configurations from their metrics
```sql
CREATE POLICY "Users can delete configurations from own metrics"
ON metric_configurations
FOR DELETE
USING (
  metric_id IN (
    SELECT m.id FROM metrics m
    JOIN dashboards d ON m.dashboard_id = d.id
    WHERE d.owner_id = auth.uid()
  )
);
```

### Verification Query:
```sql
-- List all policies on metric_configurations table
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'metric_configurations'
ORDER BY policyname;
```

### Expected Result:
Should see 4 policies listed above

**✅ Pass Criteria**: All 4 policies exist with correct logic
**❌ Fail Action**: Create missing policies using SQL scripts in Step 6

---

## Step 5: Verify Storage Bucket Policies

### Storage Bucket: `csv-files`

#### Policy 1: Users can upload files to their own folder
```sql
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'csv-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

#### Policy 2: Users can view files from accessible dashboards
```sql
CREATE POLICY "Users can view files from accessible dashboards"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'csv-files'
  AND (
    -- User's own files
    (storage.foldername(name))[1] = auth.uid()::text
    -- OR files from shared dashboards (complex - may need application-level check)
  )
);
```

**Note**: Storage RLS for shared dashboards is complex. May need to rely on signed URLs or application-level access control.

### Verification Query:
```sql
-- List all policies on storage.objects for csv-files bucket
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
ORDER BY policyname;
```

### Expected Result:
Should see storage policies listed

**✅ Pass Criteria**: Users can only upload to their own folders
**❌ Fail Action**: Create storage policies using SQL scripts in Step 6

---

## Step 6: SQL Scripts to Create Missing Policies

If any policies are missing, run these scripts in **SQL Editor**:

### Enable RLS on All Tables
```sql
-- Enable RLS
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

### Create All Dashboard Policies
```sql
-- Dashboards: SELECT policies
CREATE POLICY "Users can view own dashboards"
ON dashboards FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Anyone can view public dashboards"
ON dashboards FOR SELECT
USING (permission_level = 'public');

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

-- Dashboards: INSERT policy
CREATE POLICY "Users can insert own dashboards"
ON dashboards FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- Dashboards: UPDATE policy
CREATE POLICY "Users can update own dashboards"
ON dashboards FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Dashboards: DELETE policy
CREATE POLICY "Users can delete own dashboards"
ON dashboards FOR DELETE
USING (auth.uid() = owner_id);
```

### Create All Metrics Policies
```sql
-- Metrics: SELECT policy
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

-- Metrics: INSERT policy
CREATE POLICY "Users can insert metrics to own dashboards"
ON metrics FOR INSERT
WITH CHECK (
  dashboard_id IN (
    SELECT id FROM dashboards WHERE owner_id = auth.uid()
  )
);

-- Metrics: UPDATE policy
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

-- Metrics: DELETE policy
CREATE POLICY "Users can delete metrics from own dashboards"
ON metrics FOR DELETE
USING (
  dashboard_id IN (
    SELECT id FROM dashboards WHERE owner_id = auth.uid()
  )
);
```

### Create All Metric Configurations Policies
```sql
-- Metric Configurations: SELECT policy
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

-- Metric Configurations: INSERT policy
CREATE POLICY "Users can insert configurations to own metrics"
ON metric_configurations FOR INSERT
WITH CHECK (
  metric_id IN (
    SELECT m.id FROM metrics m
    JOIN dashboards d ON m.dashboard_id = d.id
    WHERE d.owner_id = auth.uid()
  )
);

-- Metric Configurations: UPDATE policy
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

-- Metric Configurations: DELETE policy
CREATE POLICY "Users can delete configurations from own metrics"
ON metric_configurations FOR DELETE
USING (
  metric_id IN (
    SELECT m.id FROM metrics m
    JOIN dashboards d ON m.dashboard_id = d.id
    WHERE d.owner_id = auth.uid()
  )
);
```

### Create Storage Bucket Policies
```sql
-- Storage: Upload policy
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'csv-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage: Download policy (own files only)
CREATE POLICY "Users can download own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'csv-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage: Delete policy
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'csv-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## Step 7: Test RLS Policies

### Test Scenario 1: Own Dashboard Access
1. Create a test dashboard as User A
2. Verify User A can view, update, and delete it
3. Verify User B **cannot** see User A's private dashboard

### Test Scenario 2: Public Dashboard Access
1. Set a dashboard to `permission_level = 'public'` as User A
2. Verify User B (different email) can view it
3. Verify User B **cannot** edit or delete it

### Test Scenario 3: Domain Dashboard Access
1. Create User A with email: `alice@example.com`
2. Create User B with email: `bob@example.com`
3. User A creates dashboard with `permission_level = 'domain'`
4. Verify User B **can** view it (same domain)
5. Create User C with email: `charlie@different.com`
6. Verify User C **cannot** view it (different domain)

### Test Scenario 4: Metrics Cascade
1. User A creates a dashboard with metrics
2. User A shares dashboard as public
3. Verify User B can view metrics
4. Verify User B **cannot** delete metrics

### Test Scenario 5: File Upload
1. User A uploads a CSV file
2. Verify file is stored at `{user_a_id}/{timestamp}-file.csv`
3. User B attempts to upload to User A's folder
4. Verify upload is **denied**

---

## Step 8: Document Results

After completing verification, fill out this checklist:

### RLS Status Checklist

- [ ] **RLS Enabled** on `dashboards` table
- [ ] **RLS Enabled** on `metrics` table
- [ ] **RLS Enabled** on `metric_configurations` table
- [ ] **RLS Enabled** on `profiles` table (if exists)
- [ ] **6 policies** exist on `dashboards` table
- [ ] **4 policies** exist on `metrics` table
- [ ] **4 policies** exist on `metric_configurations` table
- [ ] **3 policies** exist on `storage.objects` for `csv-files` bucket
- [ ] **Test Scenario 1** passed (Own dashboard access)
- [ ] **Test Scenario 2** passed (Public dashboard access)
- [ ] **Test Scenario 3** passed (Domain dashboard access)
- [ ] **Test Scenario 4** passed (Metrics cascade)
- [ ] **Test Scenario 5** passed (File upload security)

### Verification Sign-Off

**Completed By**: _______________
**Date**: _______________
**Status**: ⚠️ IN PROGRESS / ✅ VERIFIED / ❌ ISSUES FOUND

**Issues Found**:
-
-
-

**Remediation Actions**:
-
-
-

---

## Security Notes

### Critical Warnings:
1. **Never disable RLS** on production tables
2. **Test all policies** before launching to production
3. **Domain-based sharing** relies on email domain matching - ensure this is intended behavior
4. **Storage files** should be accessed via signed URLs for security
5. **Cascading deletes** are handled by database foreign keys (ON DELETE CASCADE)

### Additional Recommendations:
1. **Audit logging**: Consider adding audit trails for sensitive operations
2. **Rate limiting**: Implement rate limits on dashboard creation/sharing
3. **File scanning**: Add virus/malware scanning for uploaded CSV files
4. **Backup strategy**: Ensure regular database backups are configured
5. **Monitoring**: Set up alerts for RLS policy violations

---

## References

- Supabase RLS Documentation: https://supabase.com/docs/guides/auth/row-level-security
- Execution Plan: `docs/EXECUTION_PLAN.md` (Phase 1 - Section 1.3)
- Dashboard Service: `src/services/dashboardService.ts`
- Storage Service: `src/services/storageService.ts`

---

**Next Steps**: After verification is complete, proceed to Phase 9 (Production Launch)
