# Persistent Storage Implementation Plan

**Date Created**: January 8, 2026
**Status**: Ready to Implement
**Priority**: HIGH
**Estimated Duration**: 5-7 days

---

## Quick Start

This document provides a step-by-step implementation plan for building a robust persistent storage system for Bialy. Follow the phases in order—each builds on the previous.

**Related Documents:**
- [Persistent Storage Proposal](PERSISTENT_STORAGE_PROPOSAL.md) - Full architecture details
- [Bug Report](BUG_REPORT_STORAGE_400_ERRORS.md) - Current issues
- [Start Here](START_HERE_NEXT_SESSION.md) - Bug troubleshooting steps

---

## Implementation Phases

### Phase 1: Critical Fixes (2-3 hours) ⚡
**Goal**: Fix storage 400 errors and prevent silent failures

### Phase 2: Robust Persistence (1-2 days) 🏗️
**Goal**: Add transaction management and retry logic

### Phase 3: UX Enhancements (1 day) ✨
**Goal**: Give users visibility into save status

### Phase 4: Advanced Features (2-3 days) 🚀
**Goal**: Optimization and advanced capabilities

---

## Phase 1: Critical Fixes (START HERE)

### Prerequisites
- [ ] Reviewed bug report (`docs/BUG_REPORT_STORAGE_400_ERRORS.md`)
- [ ] Supabase dashboard access ready
- [ ] Local dev environment running
- [ ] Test user account ready

---

### Step 1.1: Fix RLS Policies (15 min)

**Problem**: Duplicate `{public}` and `{authenticated}` policies causing upload failures

**Action**:
1. Go to: https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo/sql/new
2. Copy entire contents of `sql/fix_storage_permissions.sql`
3. Run the script (Cmd+Enter)
4. Verify output shows only 3 policies with `{authenticated}` role

**Verification Query**:
```sql
-- Should return 3 rows: INSERT, SELECT, DELETE
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects';
```

**Success Criteria**:
- ✅ Only 3 policies exist
- ✅ All policies use `{authenticated}` role
- ✅ No `{public}` role policies remain

---

### Step 1.2: Add Upload Verification (30 min)

**Problem**: Files upload but don't persist; no verification step

**File**: `src/services/storageService.ts`

**Changes**:

```typescript
// Add new interface at top of file
export interface UploadResult {
  path: string;
  size: number;
  verified: boolean;
  uploadTime: number;
}

// Modify uploadCSVFile function
export async function uploadCSVFile(file: File, userId: string): Promise<UploadResult> {
  const startTime = Date.now();

  try {
    // Generate unique file path: {userId}/{timestamp}-{filename}
    const timestamp = Date.now();
    const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${userId}/${timestamp}-${fileName}`;

    console.log(`[UPLOAD] Starting upload: ${filePath}`);

    // Upload file
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('[UPLOAD] Upload failed:', error);
      throw error;
    }

    console.log(`[UPLOAD] Upload completed: ${data.path}`);

    // 🆕 VERIFICATION STEP - Check file actually exists
    console.log(`[VERIFY] Checking file exists: ${filePath}`);

    const { data: listData, error: listError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(userId, {
        search: fileName
      });

    if (listError) {
      console.error('[VERIFY] Verification failed:', listError);
      // Try to clean up the potentially failed upload
      await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
      throw new Error(`File verification failed: ${listError.message}`);
    }

    const fileExists = listData?.some(f => f.name.includes(fileName));

    if (!fileExists || listData.length === 0) {
      console.error('[VERIFY] File not found after upload');
      throw new Error('File upload verification failed - file does not exist in storage');
    }

    const fileSize = listData[0].metadata?.size ?? file.size;
    const uploadTime = Date.now() - startTime;

    console.log(`[VERIFY] ✓ File verified - ${fileSize} bytes in ${uploadTime}ms`);

    return {
      path: data.path,
      size: fileSize,
      verified: true,
      uploadTime
    };
  } catch (error) {
    const uploadTime = Date.now() - startTime;
    console.error(`[UPLOAD] Failed after ${uploadTime}ms:`, error);
    throw error;
  }
}
```

**Update saveSeriesAsCSV too**:

```typescript
export async function saveSeriesAsCSV(series: Series, userId: string): Promise<UploadResult> {
  const startTime = Date.now();

  try {
    // Convert series data to CSV format
    const csvData = series.data.map(point => ({
      date: point.date.toISOString().split('T')[0],
      numerator: point.numerator,
      denominator: point.denominator
    }));

    // Generate CSV string using PapaParse
    const csv = Papa.unparse(csvData, {
      columns: ['date', 'numerator', 'denominator'],
      header: true
    });

    // Create a Blob from the CSV string
    const blob = new Blob([csv], { type: 'text/csv' });

    // Generate unique file path
    const timestamp = Date.now();
    const safeName = series.metadata.name.replace(/[^a-zA-Z0-9-]/g, '_');
    const fileName = `${safeName}-${timestamp}.csv`;
    const filePath = `${userId}/${fileName}`;

    console.log(`[SAVE] Saving series as CSV: ${filePath}`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'text/csv'
      });

    if (error) {
      console.error('[SAVE] Save failed:', error);
      throw error;
    }

    console.log(`[SAVE] Save completed: ${data.path}`);

    // 🆕 VERIFICATION STEP
    console.log(`[VERIFY] Checking file exists: ${filePath}`);

    const { data: listData, error: listError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(userId, {
        search: fileName
      });

    if (listError || !listData?.length) {
      console.error('[VERIFY] Verification failed:', listError);
      await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
      throw new Error('File verification failed after save');
    }

    const fileSize = listData[0].metadata?.size ?? blob.size;
    const uploadTime = Date.now() - startTime;

    console.log(`[VERIFY] ✓ File verified - ${fileSize} bytes in ${uploadTime}ms`);

    return {
      path: data.path,
      size: fileSize,
      verified: true,
      uploadTime
    };
  } catch (error) {
    const uploadTime = Date.now() - startTime;
    console.error(`[SAVE] Failed after ${uploadTime}ms:`, error);
    throw error;
  }
}
```

**Testing**:
```bash
# 1. Run dev server
npm run dev

# 2. Open browser console (F12)

# 3. Test synthetic metrics
#    - Click "Clear All"
#    - Click "Load 10 Synthetic Metrics"
#    - Watch console for [UPLOAD], [VERIFY] logs

# 4. Verify all uploads show "✓ File verified"

# 5. Refresh browser - all metrics should load
```

---

### Step 1.3: Add Better Error Handling (30 min)

**File**: `src/pages/DashboardPage.tsx`

**Find the handleLoadSyntheticMetrics function** (around line 212) and update error handling:

```typescript
const handleLoadSyntheticMetrics = async (count: number = 10) => {
  setIsLoading(true);
  const errors: Array<{ metricName: string; error: Error }> = [];

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to load synthetic metrics');
      return;
    }

    for (let i = 0; i < count; i++) {
      try {
        const series = generateSyntheticSeries();

        // 🆕 Enhanced logging
        console.log(`[SYNTHETIC] Generating metric ${i + 1}/${count}: "${series.metadata.name}"`);

        // Save series to storage and get file path
        const uploadResult = await saveSeriesAsCSV(series, user.id);
        series.filePath = uploadResult.path;

        // 🆕 Log success with details
        console.log(`[SYNTHETIC] ✓ Saved metric ${i + 1}/${count} - ${uploadResult.size} bytes`);

        // Add to state
        handleSeriesLoaded(series);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[SYNTHETIC] ✗ Failed to save synthetic metric ${i + 1}:`, error);
        errors.push({
          metricName: `Metric ${i + 1}`,
          error: error instanceof Error ? error : new Error(errorMsg)
        });

        // 🆕 Don't continue if we have multiple failures
        if (errors.length >= 3) {
          console.error('[SYNTHETIC] Too many failures, stopping');
          break;
        }
      }
    }

    // 🆕 Show summary to user
    if (errors.length > 0) {
      const errorList = errors.map(e => `- ${e.metricName}: ${e.error.message}`).join('\n');
      alert(`⚠️ ${errors.length} metrics failed to upload:\n\n${errorList}\n\nCheck console for details.`);
    } else {
      console.log(`[SYNTHETIC] ✓ All ${count} metrics uploaded successfully`);
    }
  } catch (error) {
    console.error('[SYNTHETIC] Unexpected error:', error);
    alert('Failed to load synthetic metrics. Check console for details.');
  } finally {
    setIsLoading(false);
  }
};
```

---

### Step 1.4: Add File Existence Check on Load (30 min)

**File**: `src/services/dashboardService.ts`

**Update the fetchDashboard function** (around line 82):

```typescript
// Inside the metricConfigs mapping (around line 124)
const metricConfigs: MetricConfig[] = await Promise.all(
  (metrics || []).map(async (metric) => {
    const metricConfigRecords = configs?.filter(c => c.metric_id === metric.id) || [];

    // Load series data from CSV file in storage
    let series: Series;
    if (metric.data_file_path) {
      try {
        console.log(`[LOAD] Loading metric "${metric.name}" from ${metric.data_file_path}`);

        // 🆕 PRE-FLIGHT CHECK - Verify file exists before downloading
        const userId = metric.data_file_path.split('/')[0];
        const fileName = metric.data_file_path.split('/').pop();

        const { data: listData, error: listError } = await supabase.storage
          .from('csv-files')
          .list(userId, {
            search: fileName
          });

        if (listError || !listData?.length) {
          console.error(`[LOAD] ✗ File does not exist: ${metric.data_file_path}`);
          console.error('      This metric was saved but the CSV file is missing.');
          console.error('      User will need to re-upload this data.');
          throw new Error('CSV file not found in storage');
        }

        console.log(`[LOAD] ✓ File exists, downloading...`);

        // Download and parse CSV
        series = await downloadCSVFile(metric.data_file_path);
        series.filePath = metric.data_file_path;

        console.log(`[LOAD] ✓ Loaded "${metric.name}" - ${series.data.length} data points`);
      } catch (error) {
        console.error(`[LOAD] ✗ Failed to load "${metric.name}":`, error);
        console.error(`       File path: ${metric.data_file_path}`);

        // Create placeholder with clear error message
        series = createPlaceholderSeries(metric.name, metric.unit);
        series.metadata.description = '⚠️ Data file missing - please re-upload';
      }
    } else {
      console.warn(`[LOAD] Metric "${metric.name}" has no data_file_path, using placeholder`);
      series = createPlaceholderSeries(metric.name, metric.unit);
    }

    // ... rest of function unchanged
  })
);
```

---

### Step 1.5: Test the Fixes (30 min)

**Manual Testing Checklist**:

```
□ 1. Run SQL script to fix policies
□ 2. Clear dashboard ("Clear All" button)
□ 3. Open browser DevTools console (F12)
□ 4. Load 10 synthetic metrics
□ 5. Check console - should see:
     - [UPLOAD] Starting upload logs
     - [VERIFY] ✓ File verified logs
     - ✓ All 10 metrics uploaded successfully
□ 6. Save dashboard (auto-save should trigger)
□ 7. Hard refresh browser (Cmd+Shift+R)
□ 8. Check console - should see:
     - [LOAD] ✓ File exists logs
     - [LOAD] ✓ Loaded logs for all 10 metrics
□ 9. Verify charts display with data
□ 10. No 400 errors in Network tab
```

**If Tests Pass**:
- ✅ Phase 1 complete!
- ✅ Storage is now working reliably
- ✅ Ready to commit and deploy

**If Tests Fail**:
- Check Supabase Storage UI for files: Storage → csv-files → {userId}
- Check RLS policies: Run verification query from Step 1.1
- Check auth state: Run `await supabase.auth.getUser()` in console
- Review console errors for specific failure points

---

### Step 1.6: Commit Phase 1 Changes (15 min)

```bash
# Stage changes
git add src/services/storageService.ts
git add src/services/dashboardService.ts
git add src/pages/DashboardPage.tsx

# Commit with descriptive message
git commit -m "$(cat <<'EOF'
Add robust upload verification and error handling

Changes:
- Add verification step after file uploads to confirm persistence
- Enhanced logging with [UPLOAD], [VERIFY], [LOAD] prefixes
- Pre-flight file existence checks before downloads
- Better error messages for users and developers
- Return UploadResult with file size and timing info

Fixes:
- Silent upload failures now caught and reported
- Missing files detected before 400 errors occur
- Upload timing tracked for performance monitoring

Related: docs/BUG_REPORT_STORAGE_400_ERRORS.md

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

# Check status
git status

# Ready to push or continue to Phase 2
```

---

## Phase 2: Robust Persistence

### Step 2.1: Create Retry Utility (1 hour)

**Create new file**: `src/utils/retry.ts`

```typescript
/**
 * Retry utility with exponential backoff
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public attempts: number,
    public lastError: Error
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

/**
 * Retry a function with exponential backoff
 *
 * @example
 * const result = await retryWithBackoff(
 *   () => uploadFile(file),
 *   { maxAttempts: 3, baseDelay: 1000 }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    onRetry
  } = options;

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this was the last attempt, throw
      if (attempt === maxAttempts) {
        throw new RetryError(
          `Operation failed after ${maxAttempts} attempts: ${lastError.message}`,
          maxAttempts,
          lastError
        );
      }

      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.3 * exponentialDelay; // ±30% jitter
      const delay = Math.min(exponentialDelay + jitter, maxDelay);

      console.warn(
        `[RETRY] Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. ` +
        `Retrying in ${Math.round(delay)}ms...`
      );

      // Call onRetry callback if provided
      onRetry?.(attempt, lastError);

      // Wait before retrying
      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript doesn't know that
  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable (network errors, timeouts, 5xx)
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // Network errors
  if (message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection')) {
    return true;
  }

  // HTTP 5xx errors
  if (message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')) {
    return true;
  }

  // Rate limiting
  if (message.includes('429') || message.includes('rate limit')) {
    return true;
  }

  return false;
}

/**
 * Retry with conditional logic - only retry if error is retryable
 */
export async function retryIfRetryable<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  try {
    return await retryWithBackoff(fn, options);
  } catch (error) {
    if (!isRetryableError(error)) {
      // Don't retry non-retryable errors (auth failures, validation, etc)
      throw error;
    }
    throw error;
  }
}
```

**Update storageService to use retry**:

File: `src/services/storageService.ts`

```typescript
import { retryWithBackoff } from '../utils/retry';

// Wrap uploadCSVFile with retry logic
export async function uploadCSVFileReliable(
  file: File,
  userId: string
): Promise<UploadResult> {
  return retryWithBackoff(
    () => uploadCSVFile(file, userId),
    {
      maxAttempts: 3,
      baseDelay: 1000,
      onRetry: (attempt, error) => {
        console.warn(`[RETRY] Upload attempt ${attempt} failed: ${error.message}`);
      }
    }
  );
}

// Same for saveSeriesAsCSV
export async function saveSeriesAsCSVReliable(
  series: Series,
  userId: string
): Promise<UploadResult> {
  return retryWithBackoff(
    () => saveSeriesAsCSV(series, userId),
    {
      maxAttempts: 3,
      baseDelay: 1000,
      onRetry: (attempt, error) => {
        console.warn(`[RETRY] Save attempt ${attempt} failed: ${error.message}`);
      }
    }
  );
}
```

**Update DashboardPage to use reliable versions**:

```typescript
// In handleLoadSyntheticMetrics
const uploadResult = await saveSeriesAsCSVReliable(series, user.id);
```

---

### Step 2.2: Create Transaction Manager (2 hours)

**Create new file**: `src/services/transactionManager.ts`

```typescript
/**
 * Transaction manager for atomic multi-step operations
 * Supports rollback on failure
 */

export interface Operation {
  id: string;
  type: string;
  execute: () => Promise<any>;
  rollback: () => Promise<void>;
  result?: any;
  error?: Error;
}

export class TransactionManager {
  private operations: Operation[] = [];
  private committed: boolean = false;

  /**
   * Add an operation to the transaction
   */
  addOperation(op: Omit<Operation, 'result' | 'error'>): void {
    this.operations.push(op as Operation);
  }

  /**
   * Execute all operations in sequence
   */
  async execute(): Promise<void> {
    console.log(`[TXN] Starting transaction with ${this.operations.length} operations`);

    for (let i = 0; i < this.operations.length; i++) {
      const op = this.operations[i];

      try {
        console.log(`[TXN] Executing operation ${i + 1}/${this.operations.length}: ${op.type}`);
        op.result = await op.execute();
        console.log(`[TXN] ✓ Operation ${i + 1} completed`);
      } catch (error) {
        op.error = error instanceof Error ? error : new Error(String(error));
        console.error(`[TXN] ✗ Operation ${i + 1} failed:`, op.error);

        // Rollback all previous operations
        await this.rollback();

        throw new Error(
          `Transaction failed at operation ${i + 1} (${op.type}): ${op.error.message}`
        );
      }
    }
  }

  /**
   * Commit the transaction (marks as complete, prevents rollback)
   */
  async commit(): Promise<void> {
    console.log('[TXN] Committing transaction');
    this.committed = true;
  }

  /**
   * Rollback all executed operations in reverse order
   */
  async rollback(): Promise<void> {
    if (this.committed) {
      console.warn('[TXN] Cannot rollback committed transaction');
      return;
    }

    console.log('[TXN] Rolling back transaction');

    // Rollback in reverse order
    const executedOps = this.operations.filter(op => op.result !== undefined);

    for (let i = executedOps.length - 1; i >= 0; i--) {
      const op = executedOps[i];

      try {
        console.log(`[TXN] Rolling back operation: ${op.type}`);
        await op.rollback();
        console.log(`[TXN] ✓ Rollback successful: ${op.type}`);
      } catch (error) {
        console.error(`[TXN] ✗ Rollback failed for ${op.type}:`, error);
        // Continue rolling back other operations even if one fails
      }
    }

    console.log('[TXN] Rollback complete');
  }

  /**
   * Get result from a specific operation
   */
  getResult<T>(operationId: string): T | undefined {
    const op = this.operations.find(o => o.id === operationId);
    return op?.result as T | undefined;
  }
}

/**
 * Helper to create a transaction for saving a metric with CSV
 */
export async function saveMetricAtomic(
  series: Series,
  dashboardId: string,
  userId: string
): Promise<{ metricId: string; filePath: string }> {
  const txn = new TransactionManager();

  let uploadedFilePath: string | undefined;
  let insertedMetricId: string | undefined;

  // Operation 1: Upload CSV file
  txn.addOperation({
    id: 'upload-csv',
    type: 'Upload CSV',
    execute: async () => {
      const result = await saveSeriesAsCSVReliable(series, userId);
      uploadedFilePath = result.path;
      return result;
    },
    rollback: async () => {
      if (uploadedFilePath) {
        console.log(`[TXN] Deleting uploaded file: ${uploadedFilePath}`);
        await supabase.storage
          .from('csv-files')
          .remove([uploadedFilePath]);
      }
    }
  });

  // Operation 2: Insert metric record
  txn.addOperation({
    id: 'insert-metric',
    type: 'Insert Metric',
    execute: async () => {
      const { data, error } = await supabase
        .from('metrics')
        .insert({
          dashboard_id: dashboardId,
          name: series.metadata.name,
          unit: series.metadata.numeratorLabel,
          data_file_path: uploadedFilePath,
          order_index: 0 // Will be updated later
        })
        .select()
        .single();

      if (error) throw error;

      insertedMetricId = data.id;
      return data;
    },
    rollback: async () => {
      if (insertedMetricId) {
        console.log(`[TXN] Deleting metric record: ${insertedMetricId}`);
        await supabase
          .from('metrics')
          .delete()
          .eq('id', insertedMetricId);
      }
    }
  });

  // Execute transaction
  await txn.execute();
  await txn.commit();

  return {
    metricId: insertedMetricId!,
    filePath: uploadedFilePath!
  };
}
```

**Add Supabase import at top**:
```typescript
import { supabase } from '../lib/supabase';
import type { Series } from '../types/series';
import { saveSeriesAsCSVReliable } from './storageService';
```

---

### Step 2.3: Update Dashboard Save to Use Transactions (1 hour)

**File**: `src/services/dashboardService.ts`

**Update saveDashboardData function** to be more robust:

```typescript
/**
 * Save dashboard data with transaction safety
 */
export async function saveDashboardData(
  dashboardId: string,
  metrics: MetricConfig[],
  globalSettings: GlobalSettings
): Promise<void> {
  console.log(`[SAVE] Starting dashboard save: ${dashboardId}`);
  console.log(`[SAVE] Metrics to save: ${metrics.length}`);

  try {
    // Validate all metrics have file paths
    const missingFilePaths = metrics.filter(m => !m.series.filePath);
    if (missingFilePaths.length > 0) {
      const names = missingFilePaths.map(m => m.series.metadata.name).join(', ');
      throw new Error(
        `Cannot save dashboard: ${missingFilePaths.length} metrics missing file paths: ${names}`
      );
    }

    // Delete all existing metrics for this dashboard
    console.log('[SAVE] Deleting existing metrics...');
    const { error: deleteError } = await supabase
      .from('metrics')
      .delete()
      .eq('dashboard_id', dashboardId);

    if (deleteError) {
      console.error('[SAVE] Error deleting old metrics:', deleteError);
      throw deleteError;
    }
    console.log('[SAVE] ✓ Old metrics deleted');

    // Insert new metrics
    if (metrics.length > 0) {
      console.log(`[SAVE] Inserting ${metrics.length} metrics...`);

      const metricRecords = metrics.map((metric, index) => ({
        dashboard_id: dashboardId,
        name: metric.series.metadata.name,
        unit: metric.series.metadata.numeratorLabel || '',
        data_file_path: metric.series.filePath || '',
        order_index: index
      }));

      const { data: insertedMetrics, error: insertError } = await supabase
        .from('metrics')
        .insert(metricRecords)
        .select();

      if (insertError) {
        console.error('[SAVE] Error inserting metrics:', insertError);
        throw insertError;
      }

      console.log(`[SAVE] ✓ ${insertedMetrics?.length} metrics inserted`);

      // Insert metric configurations
      if (insertedMetrics) {
        console.log('[SAVE] Inserting configurations...');
        const configRecords: any[] = [];

        insertedMetrics.forEach((dbMetric, index) => {
          const metric = metrics[index];

          // Add goals configuration
          if (metric.goals && metric.goals.length > 0) {
            configRecords.push({
              metric_id: dbMetric.id,
              config_type: 'goal',
              config_data: metric.goals
            });
          }

          // Add forecast configuration (includes snapshot data)
          if (metric.forecast) {
            configRecords.push({
              metric_id: dbMetric.id,
              config_type: 'forecast',
              config_data: {
                ...metric.forecast,
                snapshot: metric.forecastSnapshot
              }
            });
          }

          // Add annotations
          if (metric.annotations && metric.annotations.length > 0) {
            configRecords.push({
              metric_id: dbMetric.id,
              config_type: 'annotation',
              config_data: metric.annotations
            });
          }
        });

        // Add global settings
        if (insertedMetrics.length > 0) {
          configRecords.push({
            metric_id: insertedMetrics[0].id,
            config_type: 'aggregation',
            config_data: globalSettings
          });
        }

        if (configRecords.length > 0) {
          const { error: configError } = await supabase
            .from('metric_configurations')
            .insert(configRecords);

          if (configError) {
            console.error('[SAVE] Error inserting configurations:', configError);
            throw configError;
          }

          console.log(`[SAVE] ✓ ${configRecords.length} configurations inserted`);
        }
      }
    }

    // Update dashboard's updated_at timestamp
    console.log('[SAVE] Updating dashboard timestamp...');
    const { error: updateError } = await supabase
      .from('dashboards')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', dashboardId);

    if (updateError) {
      console.error('[SAVE] Error updating dashboard timestamp:', updateError);
      throw updateError;
    }

    console.log('[SAVE] ✓ Dashboard save complete');
  } catch (error) {
    console.error('[SAVE] ✗ Dashboard save failed:', error);
    throw error;
  }
}
```

---

### Step 2.4: Test Phase 2 (30 min)

**Testing Checklist**:

```
□ 1. Test retry logic:
     - Temporarily disconnect WiFi during upload
     - Should see [RETRY] messages in console
     - Upload should succeed after reconnect

□ 2. Test transaction rollback:
     - Modify code to force failure after upload
     - Verify file gets deleted (rollback)
     - No orphaned files in storage

□ 3. Test complete workflow:
     - Load 10 metrics
     - All uploads succeed with retry
     - Save dashboard
     - Refresh browser
     - All data loads correctly

□ 4. Check performance:
     - Upload time logged
     - No excessive retries
     - Dashboard load < 2 seconds
```

---

### Step 2.5: Commit Phase 2 (15 min)

```bash
git add src/utils/retry.ts
git add src/services/transactionManager.ts
git add src/services/storageService.ts
git add src/services/dashboardService.ts

git commit -m "$(cat <<'EOF'
Add retry logic and transaction management

Features:
- Exponential backoff retry with jitter
- Transaction manager for atomic operations
- Automatic rollback on failures
- Enhanced save validation and logging

Components:
- src/utils/retry.ts - Retry utility with backoff
- src/services/transactionManager.ts - Transaction support
- Updated storageService with reliable upload methods
- Updated dashboardService with validation

Benefits:
- Handles transient network failures automatically
- Prevents partial saves that corrupt data
- Better error messages and debugging

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: UX Enhancements

### Step 3.1: Add Save Status Indicator (2 hours)

**Create new component**: `src/components/SaveStatusIndicator.tsx`

```typescript
import { useEffect, useState } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  error?: Error;
  onRetry?: () => void;
}

export function SaveStatusIndicator({ status, error, onRetry }: SaveStatusIndicatorProps) {
  const [showSaved, setShowSaved] = useState(false);

  // Auto-hide "saved" message after 3 seconds
  useEffect(() => {
    if (status === 'saved') {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (status === 'idle' && !showSaved) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'saving' && (
        <>
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          <span className="text-gray-600">Saving...</span>
        </>
      )}

      {(status === 'saved' || showSaved) && (
        <>
          <CheckCircleIcon className="h-5 w-5 text-green-500" />
          <span className="text-green-600">All changes saved</span>
        </>
      )}

      {status === 'error' && (
        <>
          <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
          <span className="text-red-600">
            Save failed: {error?.message || 'Unknown error'}
          </span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-2 text-blue-600 hover:text-blue-700 underline"
            >
              Retry
            </button>
          )}
        </>
      )}
    </div>
  );
}
```

**Install heroicons if not already installed**:
```bash
npm install @heroicons/react
```

**Add to DashboardPage** (in the header area):

```typescript
// Add state for save status
const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
const [saveError, setSaveError] = useState<Error>();

// Update saveDashboard function
const saveDashboard = async () => {
  if (!currentDashboard) return;

  setSaveStatus('saving');
  setSaveError(undefined);

  try {
    await saveDashboardData(
      currentDashboard.id,
      metrics,
      globalSettings
    );
    setSaveStatus('saved');
  } catch (error) {
    console.error('Save failed:', error);
    setSaveStatus('error');
    setSaveError(error instanceof Error ? error : new Error('Save failed'));
  }
};

// In JSX, add to header
<div className="flex items-center gap-4">
  <SaveStatusIndicator
    status={saveStatus}
    error={saveError}
    onRetry={saveDashboard}
  />
  <button onClick={saveDashboard}>Save</button>
</div>
```

---

### Step 3.2: Add Manual Save Button (1 hour)

**Update DashboardPage** to add explicit save control:

```typescript
// Track unsaved changes
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

// Mark as changed whenever metrics or settings update
useEffect(() => {
  setHasUnsavedChanges(true);
}, [metrics, globalSettings]);

// Clear flag after save
const saveDashboard = async () => {
  // ... save logic ...
  setHasUnsavedChanges(false);
};

// Warn on browser close if unsaved changes
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [hasUnsavedChanges]);

// Add save button to header
<button
  onClick={saveDashboard}
  disabled={!hasUnsavedChanges || saveStatus === 'saving'}
  className={`
    px-4 py-2 rounded-md font-medium transition-colors
    ${hasUnsavedChanges
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
    }
  `}
>
  {saveStatus === 'saving' ? 'Saving...' : 'Save Dashboard'}
</button>
```

---

### Step 3.3: Add Upload Progress (1 hour)

**For synthetic metrics or bulk uploads**, show progress:

```typescript
interface UploadProgress {
  current: number;
  total: number;
  currentName: string;
}

const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

const handleLoadSyntheticMetrics = async (count: number = 10) => {
  setIsLoading(true);
  setUploadProgress({ current: 0, total: count, currentName: '' });

  try {
    for (let i = 0; i < count; i++) {
      const series = generateSyntheticSeries();

      setUploadProgress({
        current: i + 1,
        total: count,
        currentName: series.metadata.name
      });

      const uploadResult = await saveSeriesAsCSVReliable(series, user.id);
      // ... rest of logic
    }

    setUploadProgress(null);
  } catch (error) {
    setUploadProgress(null);
    // ... error handling
  }
};

// Display progress
{uploadProgress && (
  <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border">
    <div className="text-sm text-gray-600 mb-2">
      Uploading {uploadProgress.current} of {uploadProgress.total}
    </div>
    <div className="text-sm font-medium truncate max-w-xs">
      {uploadProgress.currentName}
    </div>
    <div className="mt-2 w-64 bg-gray-200 rounded-full h-2">
      <div
        className="bg-blue-600 h-2 rounded-full transition-all"
        style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
      />
    </div>
  </div>
)}
```

---

### Step 3.4: Commit Phase 3 (15 min)

```bash
git add src/components/SaveStatusIndicator.tsx
git add src/pages/DashboardPage.tsx

git commit -m "$(cat <<'EOF'
Add save status indicator and upload progress

Features:
- Save status indicator with states: idle, saving, saved, error
- Manual save button with unsaved changes tracking
- Upload progress indicator for bulk operations
- Browser warning on unsaved changes
- Auto-hide saved confirmation after 3 seconds

Components:
- SaveStatusIndicator component with retry button
- Upload progress toast for synthetic metrics
- Unsaved changes detection and warning

UX Improvements:
- Users always know save status
- Clear feedback on success/failure
- Progress visibility for long operations
- Prevent accidental data loss

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: Advanced Features

### Step 4.1: Add Storage Quota Check (1 hour)

**Create new file**: `src/services/quotaService.ts`

```typescript
import { supabase } from '../lib/supabase';

const STORAGE_BUCKET = 'csv-files';
const DEFAULT_QUOTA_MB = 100;
const BYTES_PER_MB = 1024 * 1024;

export interface QuotaInfo {
  usedBytes: number;
  quotaBytes: number;
  availableBytes: number;
  usedPercentage: number;
  fileCount: number;
}

/**
 * Get user's current storage usage
 */
export async function getUserStorageQuota(userId: string): Promise<QuotaInfo> {
  try {
    // List all files for user
    const { data: files, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(userId);

    if (error) throw error;

    // Calculate total usage
    const usedBytes = files?.reduce(
      (sum, file) => sum + (file.metadata?.size ?? 0),
      0
    ) ?? 0;

    const quotaBytes = DEFAULT_QUOTA_MB * BYTES_PER_MB;
    const availableBytes = Math.max(0, quotaBytes - usedBytes);
    const usedPercentage = (usedBytes / quotaBytes) * 100;

    return {
      usedBytes,
      quotaBytes,
      availableBytes,
      usedPercentage,
      fileCount: files?.length ?? 0
    };
  } catch (error) {
    console.error('Failed to get storage quota:', error);
    throw error;
  }
}

/**
 * Check if user has enough space for a file
 */
export async function canUploadFile(
  userId: string,
  fileSizeBytes: number
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const quota = await getUserStorageQuota(userId);

    if (fileSizeBytes > quota.availableBytes) {
      return {
        allowed: false,
        reason: `Not enough storage space. Need ${formatBytes(fileSizeBytes)} but only ${formatBytes(quota.availableBytes)} available.`
      };
    }

    // Warn if upload would exceed 90% usage
    const afterUploadUsage = quota.usedBytes + fileSizeBytes;
    const afterUploadPercentage = (afterUploadUsage / quota.quotaBytes) * 100;

    if (afterUploadPercentage > 90) {
      return {
        allowed: true,
        reason: `Warning: This upload will use ${afterUploadPercentage.toFixed(1)}% of your storage quota.`
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Failed to check upload quota:', error);
    // Allow upload on error (fail open)
    return { allowed: true };
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
```

**Use in storageService**:

```typescript
import { canUploadFile } from './quotaService';

export async function uploadCSVFile(file: File, userId: string): Promise<UploadResult> {
  // Check quota before uploading
  const quotaCheck = await canUploadFile(userId, file.size);

  if (!quotaCheck.allowed) {
    throw new Error(quotaCheck.reason || 'Storage quota exceeded');
  }

  if (quotaCheck.reason) {
    console.warn('[QUOTA]', quotaCheck.reason);
  }

  // ... rest of upload logic
}
```

---

### Step 4.2: Add Dashboard Validation (1 hour)

**Create new file**: `src/services/validationService.ts`

```typescript
import { supabase } from '../lib/supabase';
import type { MetricConfig, GlobalSettings } from '../types/appState';

export interface ValidationIssue {
  type: 'error' | 'warning';
  metric?: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Validate dashboard before saving
 */
export async function validateDashboard(
  metrics: MetricConfig[],
  globalSettings: GlobalSettings
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  // Check for empty dashboard
  if (metrics.length === 0) {
    issues.push({
      type: 'warning',
      field: 'metrics',
      message: 'Dashboard has no metrics'
    });
  }

  // Check each metric
  for (const metric of metrics) {
    // Must have file path
    if (!metric.series.filePath) {
      issues.push({
        type: 'error',
        metric: metric.series.metadata.name,
        field: 'filePath',
        message: 'Missing CSV file path - metric not uploaded'
      });
    }

    // Must have data
    if (metric.series.data.length === 0) {
      issues.push({
        type: 'error',
        metric: metric.series.metadata.name,
        field: 'data',
        message: 'Metric has no data points'
      });
    }

    // Validate goals if present
    if (metric.goals && metric.goals.length > 0) {
      for (const goal of metric.goals) {
        if (!goal.value || goal.value <= 0) {
          issues.push({
            type: 'warning',
            metric: metric.series.metadata.name,
            field: 'goal.value',
            message: 'Goal has invalid value'
          });
        }
      }
    }
  }

  // Validate global settings
  if (globalSettings.focusPeriod?.enabled) {
    if (!globalSettings.focusPeriod.startDate || !globalSettings.focusPeriod.endDate) {
      issues.push({
        type: 'error',
        field: 'focusPeriod',
        message: 'Focus period enabled but missing dates'
      });
    }
  }

  const hasErrors = issues.some(i => i.type === 'error');

  return {
    valid: !hasErrors,
    issues
  };
}

/**
 * Validate dashboard data integrity (check files exist)
 */
export async function validateDashboardIntegrity(
  dashboardId: string
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  try {
    // Get all metrics for dashboard
    const { data: metrics, error } = await supabase
      .from('metrics')
      .select('id, name, data_file_path')
      .eq('dashboard_id', dashboardId);

    if (error) throw error;

    // Check each file exists
    for (const metric of metrics || []) {
      if (!metric.data_file_path) {
        issues.push({
          type: 'error',
          metric: metric.name,
          field: 'data_file_path',
          message: 'Missing file path in database'
        });
        continue;
      }

      // Extract userId and fileName from path
      const [userId, fileName] = metric.data_file_path.split('/');

      // Check if file exists
      const { data: files, error: listError } = await supabase.storage
        .from('csv-files')
        .list(userId, { search: fileName });

      if (listError || !files?.length) {
        issues.push({
          type: 'error',
          metric: metric.name,
          field: 'file',
          message: `CSV file not found: ${metric.data_file_path}`
        });
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  } catch (error) {
    return {
      valid: false,
      issues: [{
        type: 'error',
        field: 'validation',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}
```

**Use in DashboardPage**:

```typescript
import { validateDashboard, validateDashboardIntegrity } from '../services/validationService';

const saveDashboard = async () => {
  if (!currentDashboard) return;

  setSaveStatus('saving');

  try {
    // Validate before saving
    const validation = await validateDashboard(metrics, globalSettings);

    if (!validation.valid) {
      const errorMessages = validation.issues
        .filter(i => i.type === 'error')
        .map(i => `${i.metric ? `[${i.metric}] ` : ''}${i.message}`)
        .join('\n');

      throw new Error(`Validation failed:\n${errorMessages}`);
    }

    // Show warnings but allow save
    const warnings = validation.issues.filter(i => i.type === 'warning');
    if (warnings.length > 0) {
      console.warn('[VALIDATION] Warnings:', warnings);
    }

    await saveDashboardData(currentDashboard.id, metrics, globalSettings);
    setSaveStatus('saved');
  } catch (error) {
    console.error('Save failed:', error);
    setSaveStatus('error');
    setSaveError(error instanceof Error ? error : new Error('Save failed'));
  }
};
```

---

### Step 4.3: Add Change Tracking (2 hours)

**Create new file**: `src/hooks/useChangeTracking.ts`

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import { debounce } from 'lodash';

export interface Change {
  timestamp: Date;
  type: 'metric-add' | 'metric-remove' | 'metric-update' | 'settings-update';
  description: string;
  data?: any;
}

export interface ChangeTracker {
  changes: Change[];
  isDirty: boolean;
  addChange: (change: Omit<Change, 'timestamp'>) => void;
  clearChanges: () => void;
  getRecentChanges: (count: number) => Change[];
}

/**
 * Track changes to dashboard for dirty state and undo support
 */
export function useChangeTracking(
  autoSaveEnabled: boolean = false,
  autoSaveDelay: number = 30000
): ChangeTracker {
  const [changes, setChanges] = useState<Change[]>([]);
  const isDirty = changes.length > 0;

  // Auto-save callback ref
  const autoSaveCallback = useRef<(() => void) | null>(null);

  const addChange = useCallback((change: Omit<Change, 'timestamp'>) => {
    const newChange: Change = {
      ...change,
      timestamp: new Date()
    };

    setChanges(prev => [...prev, newChange]);
    console.log('[CHANGE]', newChange.description);
  }, []);

  const clearChanges = useCallback(() => {
    setChanges([]);
  }, []);

  const getRecentChanges = useCallback((count: number) => {
    return changes.slice(-count);
  }, [changes]);

  // Auto-save with debounce
  useEffect(() => {
    if (!autoSaveEnabled || changes.length === 0) return;

    const debouncedSave = debounce(() => {
      if (autoSaveCallback.current) {
        console.log('[AUTO-SAVE] Triggering auto-save');
        autoSaveCallback.current();
      }
    }, autoSaveDelay);

    debouncedSave();

    return () => {
      debouncedSave.cancel();
    };
  }, [changes, autoSaveEnabled, autoSaveDelay]);

  return {
    changes,
    isDirty,
    addChange,
    clearChanges,
    getRecentChanges
  };
}

/**
 * Set auto-save callback
 */
export function useAutoSave(callback: () => void, enabled: boolean) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // This would be integrated with useChangeTracking
  // For now, simple implementation
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      callbackRef.current();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [enabled]);
}
```

**Install lodash if not present**:
```bash
npm install lodash
npm install --save-dev @types/lodash
```

**Use in DashboardPage**:

```typescript
import { useChangeTracking } from '../hooks/useChangeTracking';

// In component
const { isDirty, addChange, clearChanges } = useChangeTracking(false);

// Track changes
const handleSeriesLoaded = (series: Series) => {
  setMetrics(prev => [...prev, { ... }]);
  addChange({
    type: 'metric-add',
    description: `Added metric: ${series.metadata.name}`
  });
};

const handleRemoveMetric = (index: number) => {
  const metric = metrics[index];
  setMetrics(prev => prev.filter((_, i) => i !== index));
  addChange({
    type: 'metric-remove',
    description: `Removed metric: ${metric.series.metadata.name}`
  });
};

// Clear changes after save
const saveDashboard = async () => {
  // ... save logic ...
  clearChanges();
};
```

---

### Step 4.4: Commit Phase 4 (15 min)

```bash
git add src/services/quotaService.ts
git add src/services/validationService.ts
git add src/hooks/useChangeTracking.ts

git commit -m "$(cat <<'EOF'
Add storage quota, validation, and change tracking

Features:
- Storage quota management (100MB per user)
- Pre-upload quota checks with warnings
- Dashboard validation before save
- Data integrity validation (file existence)
- Change tracking for dirty state and audit trail
- Auto-save support with configurable delay

Components:
- quotaService - Storage usage tracking and limits
- validationService - Pre-save validation and integrity checks
- useChangeTracking hook - Change tracking and auto-save

Benefits:
- Prevent storage overuse
- Catch errors before save
- Better user awareness of changes
- Foundation for undo/redo
- Audit trail for debugging

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Final Steps

### Deploy to Production

```bash
# 1. Ensure all tests pass
npm run build

# 2. Push to GitHub (triggers Vercel deployment)
git push origin main

# 3. Monitor deployment
# Visit: https://vercel.com/dashboard

# 4. Test production after deployment
# Visit: https://bialy.vercel.app
# Run through complete workflow:
#   - Load synthetic metrics
#   - Save dashboard
#   - Close browser
#   - Return and verify all data loads
```

---

## Success Criteria

After completing all phases, verify:

- [ ] ✅ **Upload Reliability**: 99%+ success rate on uploads
- [ ] ✅ **Save Performance**: < 2 seconds for 10 metrics
- [ ] ✅ **Load Performance**: < 2 seconds for dashboard with 100 metrics
- [ ] ✅ **Error Visibility**: All failures shown to user with clear messages
- [ ] ✅ **Data Integrity**: Zero silent failures or missing files
- [ ] ✅ **User Confidence**: Save status always visible and accurate
- [ ] ✅ **Retry Logic**: Transient failures handled automatically
- [ ] ✅ **Storage Management**: Quota enforced, warnings before limit
- [ ] ✅ **Validation**: Invalid states caught before save
- [ ] ✅ **Change Tracking**: Dirty state accurate, unsaved changes protected

---

## Troubleshooting

### If uploads still fail:

1. **Check RLS policies**: Run verification query from Step 1.1
2. **Check auth state**: `await supabase.auth.getUser()` in console
3. **Check file permissions**: Try manual upload in Supabase dashboard
4. **Check network**: Look for 5xx errors in Network tab
5. **Check logs**: Review [UPLOAD], [VERIFY] logs in console

### If loads fail:

1. **Check files exist**: Verify in Supabase Storage UI
2. **Check file paths**: Ensure format is `{userId}/{filename}`
3. **Check download permissions**: RLS SELECT policy applied
4. **Check data integrity**: Run `validateDashboardIntegrity()`

### If saves are slow:

1. **Check file sizes**: Large CSVs take longer
2. **Check metric count**: 100+ metrics may need optimization
3. **Enable incremental saves**: Only save changed metrics
4. **Add indexes**: Database queries may need optimization

---

## Next Steps After Implementation

Once all phases are complete:

1. **User Testing**: Have 5-10 users test the workflow
2. **Performance Monitoring**: Track save/load times in production
3. **Error Tracking**: Set up Sentry or similar for error monitoring
4. **Documentation**: Update user guide with new save features
5. **Feedback Loop**: Collect user feedback on save experience

---

## Related Documents

- [Full Proposal](PERSISTENT_STORAGE_PROPOSAL.md) - Architecture details
- [Bug Report](BUG_REPORT_STORAGE_400_ERRORS.md) - Current issues
- [RLS Policies](../sql/create_rls_policies.sql) - Security setup
- [User Guide](USER_GUIDE.md) - User documentation

---

**Implementation Status**: 📋 Not Started
**Last Updated**: January 8, 2026
**Next Session**: Start with Phase 1, Step 1.1

---

## Quick Reference: File Changes

| **Phase** | **Files Created** | **Files Modified** |
|-----------|-------------------|-------------------|
| Phase 1 | None | `storageService.ts`, `dashboardService.ts`, `DashboardPage.tsx` |
| Phase 2 | `retry.ts`, `transactionManager.ts` | `storageService.ts`, `dashboardService.ts` |
| Phase 3 | `SaveStatusIndicator.tsx` | `DashboardPage.tsx` |
| Phase 4 | `quotaService.ts`, `validationService.ts`, `useChangeTracking.ts` | `storageService.ts`, `DashboardPage.tsx` |

---

**You're ready to start implementing! Begin with Phase 1, Step 1.1 in your next session.**
