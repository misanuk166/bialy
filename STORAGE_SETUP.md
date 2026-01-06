# Supabase Storage Bucket Setup

Follow these steps to create the storage bucket for CSV files:

## Step 1: Create the Storage Bucket

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **mcnzdiflwnzyenhhyqqo**
3. Navigate to **Storage** in the left sidebar
4. Click the **"New bucket"** button
5. Configure the bucket:
   - **Name**: `csv-files`
   - **Public bucket**: `OFF` (keep it private)
   - **File size limit**: `10 MB` (or higher if you have large CSV files)
   - **Allowed MIME types**: Leave empty or add: `text/csv`, `application/csv`
6. Click **"Create bucket"**

## Step 2: Apply RLS Policies

1. In the Supabase Dashboard, navigate to **SQL Editor**
2. Click **"New query"**
3. Copy and paste the contents of `supabase/migrations/003_storage_setup.sql`
4. Click **"Run"** to execute the SQL

**Or** run this command directly:

```sql
-- Create policy: Users can upload files to their own folder
CREATE POLICY "Users can upload to their own folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'csv-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create policy: Users can read files from accessible dashboards
CREATE POLICY "Users can read files from accessible dashboards"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'csv-files' AND
    (
      (storage.foldername(name))[1] = auth.uid()::text
      OR
      EXISTS (
        SELECT 1 FROM public.metrics m
        JOIN public.dashboards d ON d.id = m.dashboard_id
        WHERE m.data_file_path = storage.objects.name
        AND (
          d.owner_id = auth.uid()
          OR
          (
            d.permission_level = 'domain' AND
            SPLIT_PART((SELECT email FROM public.profiles WHERE id = auth.uid()), '@', 2) =
            SPLIT_PART((SELECT email FROM public.profiles WHERE id = d.owner_id), '@', 2)
          )
          OR
          d.permission_level = 'public'
        )
      )
    )
  );

-- Create policy: Users can update their own files
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

-- Create policy: Users can delete their own files
CREATE POLICY "Users can delete their own files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'csv-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

## Step 3: Verify Setup

After creating the bucket and applying policies:

1. Check that the bucket appears in **Storage** section
2. Verify the bucket is **private** (not public)
3. Test by uploading a CSV file in the app

## File Structure

Files are stored with this path structure:
```
{user_id}/{timestamp}-{filename}.csv
```

Example:
```
a1b2c3d4-e5f6-7890-abcd-ef1234567890/1704528000000-revenue.csv
```

## Security Features

The RLS policies ensure:
- ✅ Users can only upload to their own folder
- ✅ Users can only read files they own or from shared dashboards
- ✅ Users can only update/delete their own files
- ✅ Domain-level sharing works (same email domain)
- ✅ Public dashboards are accessible to all authenticated users

## Troubleshooting

**Error: "new row violates row-level security policy"**
- Make sure you ran the RLS policies SQL from Step 2
- Verify you're logged in with Google OAuth

**Error: "Bucket not found"**
- Make sure the bucket name is exactly `csv-files`
- Check that you're looking at the correct Supabase project

**Files not uploading**
- Check browser console for errors
- Verify MIME types are allowed in bucket settings
- Ensure file size is under the bucket limit

---

**Ready to test?** After completing these steps, try uploading a CSV file in the app!
