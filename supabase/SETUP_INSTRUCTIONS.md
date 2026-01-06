# Supabase Database Setup Instructions

**Phase 1 - Backend Setup**

This guide will walk you through setting up the Bialy database schema, RLS policies, and storage in Supabase.

---

## Prerequisites

✅ Supabase project created
✅ Google OAuth configured
✅ Migration SQL files created

---

## Step-by-Step Setup

### Part 1: Create Database Schema

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo
   - Click **"SQL Editor"** in the left sidebar

2. **Run Migration 001 - Create Schema**
   - Click **"New query"**
   - Copy the entire contents of `supabase/migrations/001_create_schema.sql`
   - Paste into the SQL editor
   - Click **"Run"** (or press Ctrl/Cmd + Enter)
   - ✅ You should see: "Success. No rows returned"

3. **Verify Tables Created**
   - Click **"Table Editor"** in the left sidebar
   - You should see 4 new tables:
     - ✅ profiles
     - ✅ dashboards
     - ✅ metrics
     - ✅ metric_configurations

---

### Part 2: Enable Row Level Security

4. **Run Migration 002 - Enable RLS**
   - Go back to **"SQL Editor"**
   - Click **"New query"**
   - Copy the entire contents of `supabase/migrations/002_enable_rls.sql`
   - Paste into the SQL editor
   - Click **"Run"**
   - ✅ You should see: "Success. No rows returned"

5. **Verify RLS Enabled**
   - Go to **"Table Editor"**
   - Click on the **"dashboards"** table
   - Click the **shield icon** (RLS) in the top toolbar
   - You should see: **"Row Level Security is enabled"**
   - You should see multiple policies listed (view own, view domain, view public, etc.)

---

### Part 3: Create Storage Bucket

6. **Create CSV Files Bucket**
   - Click **"Storage"** in the left sidebar
   - Click **"New bucket"**
   - Bucket name: `csv-files`
   - **Public bucket**: OFF (keep it private)
   - Click **"Create bucket"**

7. **Configure Bucket Settings**
   - Click on the **"csv-files"** bucket you just created
   - Click **"Configuration"** (gear icon)
   - Set:
     - **File size limit**: 10485760 (10MB in bytes)
     - **Allowed MIME types**: `text/csv,application/csv`
   - Click **"Save"**

8. **Apply Storage RLS Policies**
   - Go back to **"SQL Editor"**
   - Click **"New query"**
   - Copy the entire contents of `supabase/migrations/003_storage_setup.sql`
   - Paste into the SQL editor
   - Click **"Run"**
   - ✅ You should see: "Success. No rows returned"

---

### Part 4: Create Database Triggers

9. **Run Migration 004 - Triggers**
   - In **"SQL Editor"**, click **"New query"**
   - Copy the entire contents of `supabase/migrations/004_triggers.sql`
   - Paste into the SQL editor
   - Click **"Run"**
   - ✅ You should see: "Success. No rows returned"

10. **Verify Triggers Created**
    - Go to **"Database"** > **"Triggers"** in the left sidebar
    - You should see triggers for:
      - ✅ set_updated_at_dashboards
      - ✅ set_updated_at_metrics
      - ✅ set_updated_at_metric_configurations
      - ✅ on_auth_user_created
      - ✅ on_metric_deleted

---

## Verification & Testing

### Test 1: Check Table Structure

```sql
-- Run this in SQL Editor to verify tables
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'dashboards', 'metrics', 'metric_configurations')
ORDER BY table_name, ordinal_position;
```

Expected: Should return all columns for all 4 tables

---

### Test 2: Check RLS Policies

```sql
-- Run this in SQL Editor to verify RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Expected: Should return ~18 policies across all tables

---

### Test 3: Check Storage Bucket

```sql
-- Run this in SQL Editor to verify storage bucket
SELECT * FROM storage.buckets WHERE name = 'csv-files';
```

Expected: Should return 1 row with csv-files bucket

---

### Test 4: Test Profile Auto-Creation

This will be tested when you first log in with Google OAuth (Phase 3).
The trigger will automatically create a profile when you authenticate.

---

## What's Next?

✅ **Phase 1 Complete!**

Your Supabase backend is now fully configured with:
- Database schema (4 tables with proper relationships)
- Row Level Security policies (18 policies for access control)
- Storage bucket for CSV files
- Auto-update triggers and utility functions

### Next: Phase 3 - Frontend Authentication

Now that the backend is ready, the next step is to implement Google OAuth login in the frontend. This will allow users to:
1. Sign in with Google
2. Auto-create their profile
3. Start creating dashboards

---

## Troubleshooting

**Issue: SQL migration fails with "already exists" error**
- Solution: Skip that migration, the object already exists

**Issue: RLS policies prevent test queries**
- Solution: Test queries might fail due to RLS. This is expected! Policies will work correctly when auth is implemented.

**Issue: Storage bucket creation fails**
- Solution: Check if a bucket with that name already exists, delete it first

**Issue: Trigger creation fails**
- Solution: Check if functions already exist, drop them first with `DROP FUNCTION IF EXISTS function_name CASCADE;`

---

## Support

If you encounter any issues, check:
1. Supabase project logs (Logs tab in dashboard)
2. SQL error messages in the SQL Editor
3. RLS policy definitions in the policies view

All migrations are idempotent - you can safely re-run them if needed.
