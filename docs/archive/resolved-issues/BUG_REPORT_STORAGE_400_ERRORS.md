# Bug Report: Storage 400 Errors When Loading Dashboards

**Date**: January 7, 2026
**Status**: 🔴 UNRESOLVED
**Priority**: HIGH
**Affects**: Dashboard loading, synthetic metrics persistence

---

## Problem Summary

When loading existing dashboards, all metrics fail to load CSV data from Supabase Storage with 400 Bad Request errors. Additionally, a TypeError crash occurs due to focus period date serialization.

---

## Symptoms

1. **Storage 400 errors** in browser console:
   ```
   GET https://[project].supabase.co/storage/v1/object/csv-files/[userId]/[filename].csv 400 (Bad Request)
   StorageUnknownError: {}
   ```

2. **TypeError crash**:
   ```
   TypeError: focusPeriod.startDate.toLocaleDateString is not a function
   ```

3. **UI shows**: "No data available" for all metrics despite database records existing

---

## Reproduction Steps

1. Load 10 synthetic metrics using "Load 10 Synthetic Metrics" button
2. Save dashboard (auto-save triggers)
3. Refresh browser (Cmd+Shift+R)
4. Dashboard loads but all metrics show "No data available"
5. Console shows 10x 400 errors for CSV downloads

---

## Investigation & Findings

### Finding #1: Duplicate Storage Policies with Wrong Roles

**Discovery**: Multiple conflicting RLS policies on `storage.objects` table

**Evidence** (from Step 4 of SQL diagnostic):
```
✅ CORRECT (our policies):
- "Users can upload to own folder"   - INSERT - {authenticated}
- "Users can download own files"     - SELECT - {authenticated}
- "Users can delete own files"       - DELETE - {authenticated}

❌ PROBLEMATIC (old policies):
- "Users can upload to their own folder"           - INSERT - {public}
- "Users can delete their own files"               - DELETE - {public}
- "Users can update their own files"               - UPDATE - {public}
- "Users can read files from accessible dashboards" - SELECT - {public}
```

**Issue**: `{public}` role policies apply to unauthenticated users, potentially interfering with authenticated access.

---

### Finding #2: NO FILES EXIST IN STORAGE

**Discovery**: Step 6 query returned "Success. No rows returned"

**Query**:
```sql
SELECT COUNT(*) as total_files, bucket_id, (storage.foldername(name))[1] as user_folder
FROM storage.objects
WHERE bucket_id = 'csv-files'
GROUP BY bucket_id, user_folder;
```

**Result**: 0 files in `csv-files` bucket

**Implication**: The 400 errors occur because files don't exist, NOT because of permission issues.

---

### Finding #3: Focus Period Date Deserialization Bug

**Discovery**: Focus period dates stored as JSON strings, not Date objects

**Error Location**: `FocusPeriodControls.tsx:128`
```
focusPeriod.startDate.toLocaleDateString()
```

**Fix Applied**: Added date deserialization in `dashboardService.ts:190-196`
```typescript
if (globalSettings.focusPeriod?.startDate) {
  globalSettings.focusPeriod.startDate = new Date(globalSettings.focusPeriod.startDate);
}
if (globalSettings.focusPeriod?.endDate) {
  globalSettings.focusPeriod.endDate = new Date(globalSettings.focusPeriod.endDate);
}
```

**Status**: ✅ FIXED (committed in 6bde447)

---

## Root Cause Analysis

### Why are files missing from storage?

**Theory #1: Upload Failed Silently**
- `saveSeriesAsCSV()` was called but blocked by RLS policies
- Error was caught and logged but metric still added to state
- Code at `DashboardPage.tsx:229` catches upload errors:
  ```typescript
  } catch (error) {
    console.error('Failed to save synthetic metric:', error);
    // Still add the metric even if storage fails (will be in-memory only)
    handleSeriesLoaded(series);
  }
  ```

**Theory #2: Wrong Policy Blocking Upload**
- Old `{public}` role INSERT policy may have prevented authenticated uploads
- Policy conflict between `{public}` and `{authenticated}` roles

**Theory #3: Files Uploaded to Wrong Bucket**
- Check if files exist in different bucket
- Verify `STORAGE_BUCKET = 'csv-files'` constant is correct

---

## Fixes Attempted

### ✅ Fix #1: Date Deserialization (SUCCESSFUL)
**Commit**: 6bde447
**Files**: `src/services/dashboardService.ts`
**Status**: Working - TypeError no longer occurs

### ⚠️ Fix #2: Enhanced SQL Script (PARTIAL)
**Commit**: f980aeb
**Files**: `sql/fix_storage_permissions.sql`
**Changes**:
- Added DROP statements for all duplicate policies
- Added diagnostic queries (Steps 3-6)
- Removed `ALTER TABLE` command (permission error)

**Status**: Policies can be cleaned up, but doesn't solve missing files issue

### ❌ Fix #3: Reload Synthetic Metrics (NOT TESTED)
**Reason**: Would need to:
1. Run updated SQL to clean policies
2. Clear dashboard
3. Reload synthetic metrics
4. Verify files uploaded
5. Check console for upload errors

**Status**: User stopped before testing this step

---

## Diagnostic Information

### Bucket Configuration (Step 5)
```
bucket: csv-files
public: false ✅
file_size_limit: null (unlimited) ✅
allowed_mime_types: null (all types) ✅
```

### RLS Status (Step 3)
Not provided by user, but assumed to be enabled (Supabase default)

### File Count (Step 6)
```
Result: No rows returned
Meaning: 0 files in csv-files bucket
```

---

## Next Steps to Debug

### 1. Clean Up Policies First
Run updated SQL script to remove all duplicate policies:
- Drop all 7 existing policies
- Create only 3 new `{authenticated}` policies (INSERT, SELECT, DELETE)

### 2. Test File Upload
Clear dashboard and reload synthetic metrics:
```
1. Hard refresh app
2. Click "Clear All"
3. Open browser DevTools Console (F12)
4. Click "Load 10 Synthetic Metrics"
5. Watch console for errors during upload
6. Note any "Failed to save synthetic metric" errors
7. Save dashboard
```

### 3. Verify Files in Storage
Check Supabase Storage UI:
```
1. Go to: Storage → Buckets → csv-files
2. Look for folder matching your user ID
3. Should see 10 CSV files with timestamps
4. Try downloading one manually to test permissions
```

### 4. Run Diagnostic Query Again
```sql
SELECT COUNT(*) as total_files, bucket_id, (storage.foldername(name))[1] as user_folder
FROM storage.objects
WHERE bucket_id = 'csv-files'
GROUP BY bucket_id, user_folder;
```
Should show 10 files.

### 5. Check Upload Error Logs
In browser console, filter for:
- "Failed to save synthetic metric"
- "Error uploading file"
- "StorageApiError"

### 6. Verify Auth Token
Check if user is authenticated during upload:
```javascript
// Run in browser console
const { data: { user } } = await supabase.auth.getUser();
console.log('User ID:', user?.id);
console.log('Authenticated:', !!user);
```

### 7. Manual Upload Test
Try uploading a test file via Supabase Storage UI:
```
1. Go to Storage → csv-files
2. Create folder with your user ID (from Step 6)
3. Try uploading a test.csv file
4. If upload fails, RLS policies are still blocking
5. If upload succeeds, check if app can download it
```

---

## Code References

### Upload Logic
**File**: `src/services/storageService.ts:11-35`
**Function**: `uploadCSVFile()`
```typescript
export async function uploadCSVFile(file: File, userId: string): Promise<string> {
  const filePath = `${userId}/${timestamp}-${fileName}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Error uploading file:', error);
    throw error;
  }

  return data.path;
}
```

### Save Series as CSV
**File**: `src/services/storageService.ts:108-151`
**Function**: `saveSeriesAsCSV()`

### Synthetic Metrics Handler
**File**: `src/pages/DashboardPage.tsx:212-242`
**Function**: `handleLoadSyntheticMetrics()`

### Download Logic
**File**: `src/services/storageService.ts:41-82`
**Function**: `downloadCSVFile()`

### Dashboard Loading
**File**: `src/services/dashboardService.ts:82-195`
**Function**: `fetchDashboard()`
**Line**: 133 - Downloads CSV: `series = await downloadCSVFile(metric.data_file_path)`

---

## Questions to Answer

1. **Are files being uploaded at all?**
   - Check Supabase Storage UI
   - Check console logs during "Load Synthetic Metrics"

2. **If upload is attempted, what error occurs?**
   - Look for console.error in storageService.ts:26
   - Check for RLS policy violation errors

3. **Are the old {public} policies actually blocking uploads?**
   - Test before and after running updated SQL script

4. **Is the user ID in the file path matching auth.uid()?**
   - Log both values during upload
   - Verify folder structure: `csv-files/{userId}/{filename}`

5. **Could there be a timing issue?**
   - Does upload complete before dashboard save?
   - Are file paths being saved to database correctly?

---

## Workarounds

### Temporary: Disable RLS (NOT RECOMMENDED FOR PRODUCTION)
```sql
-- TESTING ONLY - Makes all storage public
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

If this allows uploads/downloads to work, the problem is definitely RLS policies.

**Remember to re-enable**:
```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

---

## Related Files

- `sql/fix_storage_permissions.sql` - RLS policy fix script
- `docs/FIX_STORAGE_PERMISSIONS.md` - User guide (may be outdated)
- `src/services/storageService.ts` - Upload/download logic
- `src/services/dashboardService.ts` - Dashboard loading, date deserialization
- `src/pages/DashboardPage.tsx` - Synthetic metrics handler

---

## Commits Related to This Bug

- `6bde447` - Fix storage permissions and focus period date deserialization
- `f980aeb` - Drop all duplicate storage policies including public role policies
- `85cdbc4` - Remove ALTER TABLE command from storage permissions SQL
- `bcdc88d` - (Previous) Add saveSeriesAsCSV and enhance logging

---

## Open Questions

- Why didn't the original `DROP POLICY IF EXISTS` statements remove the old policies?
- When were the `{public}` role policies created?
- Is there a migration or setup script that created them?
- Should we add UPDATE policy for authenticated users?

---

## Success Criteria

When this bug is fixed, you should see:

1. ✅ Console shows: `✓ Loaded "Metric Name" - 913 data points` (10 times)
2. ✅ No 400 errors in Network tab
3. ✅ Step 6 query shows 10 files in csv-files bucket
4. ✅ Dashboard displays all 10 metrics with charts
5. ✅ Browser refresh loads all metrics successfully
6. ✅ No TypeError crashes

---

**Last Updated**: January 7, 2026
**Investigated By**: Claude Code
**Reporter**: User (misanuk)
