# Manual Testing Guide

Run these tests on **https://bialy.vercel.app** to validate the core workflow.

---

## Test 1: Multi-Dashboard Switching (5 min)

**Goal**: Ensure dashboards don't delete each other's files when switching

### Steps:

1. **Create Dashboard A** - "CSV Test"
   - Click "New Dashboard"
   - Name it "CSV Test"
   - Click "Load Synthetic Metrics" → "Load 1"
   - Wait for metric to load

2. **Create Dashboard B** - "Synthetic Test"
   - Click "New Dashboard"
   - Name it "Synthetic Test"
   - Click "Load Synthetic Metrics" → "Load 10"
   - Wait for all 10 to load

3. **Switch rapidly** (A → B → A → B → A)
   - Use dashboard selector dropdown
   - Switch 5 times total
   - Watch console for `[DASHBOARD] Skipping save - dashboard is loading`

4. **Verify Dashboard A** (1 metric)
   - Switch to "CSV Test"
   - **Refresh page** (Cmd+R)
   - Should show 1 chart with data
   - Check console: NO "File does not exist" errors

5. **Verify Dashboard B** (10 metrics)
   - Switch to "Synthetic Test"
   - **Refresh page** (Cmd+R)
   - Should show 10 charts with data
   - Check console: NO "File does not exist" errors

### ✅ Success Criteria:
- Both dashboards retain correct number of metrics
- No "File does not exist" errors
- Console shows: `[SAVE] Update: X, Insert: 0, Delete: 0` (no deletions!)
- Console shows: `[DASHBOARD] Skipping save - dashboard is loading`

### ❌ Failure Signs:
- Metrics missing after switching
- "File does not exist" errors
- `[SAVE] ... Delete: X` where X > 0 (bad!)

---

## Test 2: Configuration Persistence (3 min)

**Goal**: Ensure all configurations persist after refresh

### Steps:

1. **Create dashboard** with 3 synthetic metrics
   - Click "New Dashboard" → "Config Test"
   - Load 3 synthetic metrics

2. **Configure settings**:
   - **Date Range**: Change from "All Time" to a custom range
   - **Focus Period**: Enable focus mode
   - **Aggregation**: Change from default to weekly grouping
   - **Shadow**: Add a shadow (previous period)

3. **Wait 2 seconds** for auto-save
   - Watch console for `[SAVE] Update: 3, Insert: 0, Delete: 0`

4. **Hard refresh** (Cmd+Shift+R)

5. **Verify everything loaded**:
   - Date range still custom
   - Focus period still enabled
   - Aggregation still weekly
   - Shadow still visible
   - All 3 charts show data

### ✅ Success Criteria:
- NO `toLocaleDateString is not a function` errors
- All configurations persist
- Console shows: `[SAVE] Update: 3, Insert: 0, Delete: 0`
- All charts display data

### ❌ Failure Signs:
- `toLocaleDateString` errors
- Configurations reset to defaults
- Charts show "No data available"

---

## Quick Console Check

Open browser console (Cmd+Option+J) and watch for:

### GOOD patterns ✅:
```
[DASHBOARD] Starting to load dashboard: xxx
[DASHBOARD] Loaded dashboard with X metrics
[DASHBOARD] Skipping save - dashboard is loading
[SAVE] Update: X, Insert: 0, Delete: 0
[LOAD] ✓ Loaded "Metric Name" - XXX data points
```

### BAD patterns ❌:
```
[SAVE] Update: 0, Insert: X, Delete: X  ← Delete/Insert = bad!
File does not exist
toLocaleDateString is not a function
no data_file_path
```

---

## Expected Results

If both tests pass:
- ✅ Dashboard switching is safe
- ✅ No file deletions
- ✅ Configurations persist
- ✅ Date handling works correctly
- ✅ **Core workflow is solid!**

If any test fails, share:
1. Which test failed
2. Console logs
3. What behavior you saw
