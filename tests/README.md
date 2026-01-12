# Playwright Tests for Bialy

## Quick Start

### Run all tests (headless)
```bash
npm test
```

### Run with UI mode (recommended for debugging)
```bash
npm run test:ui
```

### Run with browser visible
```bash
npm run test:headed
```

### Debug mode (step through tests)
```bash
npm run test:debug
```

### Test production site
```bash
npm run test:production
```

## Test Files

### `storage-persistence.spec.ts`
Tests that verify CSV files persist correctly across:
- File uploads
- Auto-save operations
- Page refreshes
- Multiple dashboard loads

**Key Tests:**
1. **should persist files after upload and auto-save** - Uploads 1 metric, waits for auto-save, refreshes, verifies data loads
2. **should persist multiple metrics across refreshes** - Uploads 3 metrics, refreshes 3 times, verifies all persist
3. **should track save operations correctly** - Verifies INSERT on first save, UPDATE on auto-save (not DELETE/INSERT)

## What the Tests Check

✅ Files upload successfully
✅ Auto-save uses UPDATE (not DELETE/INSERT)
✅ Files persist after refresh
✅ No "File does not exist" errors
✅ No placeholder metrics with empty file paths
✅ Charts render with data

## Console Log Patterns

The tests watch for these console patterns:

**Good Signs:**
- `[SAVE] Metrics to update: 1, insert: 0, delete: 0` - Auto-save updating (good!)
- `[SAVE] Dashboard saved successfully` - Save completed
- `[LOAD] Loading metric data from...` - Loading from file

**Bad Signs:**
- `[LOAD] Metric has no data_file_path` - Empty file path (should not happen)
- `File does not exist` - File missing from storage (should not happen)
- `[SAVE] Metrics to update: 0, insert: 1, delete: 1` - Deleting and re-inserting (should not happen)

## Debugging Failed Tests

If tests fail:

1. **Check console logs** - Tests print all browser console output
2. **View screenshots** - Failed tests save screenshots to `test-results/`
3. **Watch video** - Failed tests save video to `test-results/`
4. **Run in UI mode** - `npm run test:ui` lets you watch tests live

## Running Specific Tests

```bash
# Run only storage tests
npx playwright test storage-persistence

# Run only one test
npx playwright test -g "should persist files after upload"

# Run on specific browser
npx playwright test --project=chromium
```

## Checking Production

To verify the fix is working on bialy.vercel.app:

```bash
npm run test:production
```

This runs the same tests but against the live production site.
