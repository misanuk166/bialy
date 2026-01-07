# RLS Policy Verification - Quick Start Guide

**⏱️ Estimated Time**: 15-20 minutes
**🎯 Goal**: Verify all RLS policies are correctly configured in Supabase

---

## Quick Verification (5 steps)

### Step 1: Check RLS is Enabled (2 minutes)

1. Go to: https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo/database/tables
2. Click on **SQL Editor** (left sidebar)
3. Run this query:

```sql
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('dashboards', 'metrics', 'metric_configurations')
ORDER BY tablename;
```

**Expected Output**:
```
tablename               | rls_enabled
------------------------|------------
dashboards              | t
metric_configurations   | t
metrics                 | t
```

✅ **All should show `t` (true)**

❌ **If any show `f` (false)**, run:
```sql
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_configurations ENABLE ROW LEVEL SECURITY;
```

---

### Step 2: Count Policies (2 minutes)

Run this query:

```sql
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('dashboards', 'metrics', 'metric_configurations')
GROUP BY tablename
ORDER BY tablename;
```

**Expected Output**:
```
tablename               | policy_count
------------------------|-------------
dashboards              | 6
metric_configurations   | 4
metrics                 | 4
```

✅ **Exact counts match**: You're good to go!

❌ **Counts don't match**: Proceed to Step 3

---

### Step 3: Create Missing Policies (5-10 minutes)

If Step 2 showed missing policies, create them by running the SQL file:

**Option A: Run Complete Setup Script**

Go to: https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo/sql/new

Copy and paste the entire script from: `docs/RLS_POLICY_VERIFICATION.md` (Step 6)

Click **Run**

**Option B: Use Supabase CLI**

```bash
# If you have supabase CLI installed
supabase db push
```

---

### Step 4: Verify Policy Details (3 minutes)

Run this query to see all policy names:

```sql
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('dashboards', 'metrics', 'metric_configurations')
ORDER BY tablename, cmd, policyname;
```

**Expected Policies for `dashboards`**:
- `Users can view own dashboards` (SELECT)
- `Anyone can view public dashboards` (SELECT)
- `Users can view domain dashboards` (SELECT)
- `Users can insert own dashboards` (INSERT)
- `Users can update own dashboards` (UPDATE)
- `Users can delete own dashboards` (DELETE)

**Expected Policies for `metrics`**:
- `Users can view metrics from accessible dashboards` (SELECT)
- `Users can insert metrics to own dashboards` (INSERT)
- `Users can update metrics in own dashboards` (UPDATE)
- `Users can delete metrics from own dashboards` (DELETE)

**Expected Policies for `metric_configurations`**:
- `Users can view configurations from accessible metrics` (SELECT)
- `Users can insert configurations to own metrics` (INSERT)
- `Users can update configurations in own metrics` (UPDATE)
- `Users can delete configurations from own metrics` (DELETE)

✅ **All policies present**: Proceed to Step 5

❌ **Missing policies**: Check `docs/RLS_POLICY_VERIFICATION.md` for creation scripts

---

### Step 5: Test with Real Data (5 minutes)

#### Test 1: Create a dashboard
```sql
-- Should succeed (you're the owner)
INSERT INTO dashboards (owner_id, name, permission_level)
VALUES (auth.uid(), 'Test Dashboard', 'private')
RETURNING *;
```

#### Test 2: Query your own dashboards
```sql
-- Should return the dashboard you just created
SELECT * FROM dashboards WHERE owner_id = auth.uid();
```

#### Test 3: Try to access another user's private dashboard
```sql
-- Should return empty (assuming other users exist with private dashboards)
SELECT * FROM dashboards
WHERE owner_id != auth.uid()
  AND permission_level = 'private';
```

✅ **Test 3 returns empty**: RLS is working!

❌ **Test 3 returns data**: RLS policies have a security hole - review policies

---

## Storage Bucket Verification (Bonus - 3 minutes)

### Check csv-files bucket policies

1. Go to: https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo/storage/buckets
2. Click on `csv-files` bucket
3. Click **Policies** tab
4. Verify these policies exist:
   - Users can upload to own folder
   - Users can download own files
   - Users can delete own files

**If missing**, run:

```sql
-- Upload policy
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'csv-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Download policy
CREATE POLICY "Users can download own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'csv-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Delete policy
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'csv-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## Verification Checklist

Copy this to track your progress:

```
RLS VERIFICATION CHECKLIST
===========================
Date: _______
Verified by: _______

Step 1: RLS Enabled
  [ ] dashboards table
  [ ] metrics table
  [ ] metric_configurations table

Step 2: Policy Counts
  [ ] dashboards: 6 policies
  [ ] metrics: 4 policies
  [ ] metric_configurations: 4 policies

Step 3: Policies Created
  [ ] All missing policies created

Step 4: Policy Details
  [ ] Dashboard policies verified
  [ ] Metrics policies verified
  [ ] Metric configurations policies verified

Step 5: Real Data Tests
  [ ] Test 1 passed (create dashboard)
  [ ] Test 2 passed (query own dashboards)
  [ ] Test 3 passed (cannot access others' private)

Storage Bucket:
  [ ] csv-files bucket has 3 policies
  [ ] Upload policy verified
  [ ] Download policy verified
  [ ] Delete policy verified

OVERALL STATUS: [ ] ✅ VERIFIED / [ ] ⚠️ ISSUES FOUND

Issues:
_________________________________
_________________________________
_________________________________
```

---

## Common Issues & Solutions

### Issue 1: "relation does not exist"
**Cause**: Tables haven't been created yet
**Solution**: Run migrations from `docs/EXECUTION_PLAN.md` Phase 1

### Issue 2: "permission denied for table"
**Cause**: RLS is enabled but no policies exist
**Solution**: Run policy creation scripts from Step 6 of `docs/RLS_POLICY_VERIFICATION.md`

### Issue 3: "infinite recursion detected"
**Cause**: Policy references itself
**Solution**: Review policy logic - should not have circular dependencies

### Issue 4: Policies exist but queries return no data
**Cause**: Policy logic is too restrictive
**Solution**: Check `auth.uid()` is not null - user must be authenticated

---

## Next Steps

After verification:

1. ✅ **All checks pass**: Proceed to Phase 9 (Production Launch)
2. ⚠️ **Issues found**: Document in `docs/RLS_POLICY_VERIFICATION.md` and fix before launch
3. 📝 **Save results**: Keep verification checklist for audit trail

---

## Quick Links

- Full Verification Guide: `docs/RLS_POLICY_VERIFICATION.md`
- Supabase Dashboard: https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo
- SQL Editor: https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo/sql/new
- Storage: https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo/storage/buckets
