import { test, expect, Page } from '@playwright/test';
import path from 'path';

/**
 * Storage Persistence Tests
 *
 * These tests verify that uploaded CSV files persist across:
 * - Auto-saves (triggered every ~1 second)
 * - Page refreshes
 * - Multiple dashboard loads
 */

// Helper to wait for console logs and capture them
async function captureConsoleLogs(page: Page) {
  const logs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(`[${msg.type()}] ${text}`);
  });
  return logs;
}

// Helper to create a test CSV file
async function createTestCSV(filename: string = 'test-metric.csv'): Promise<string> {
  const csvContent = `date,value
2024-01-01,100
2024-02-01,150
2024-03-01,200
2024-04-01,175
2024-05-01,225`;

  const testDir = path.join(process.cwd(), 'test-data');
  const filePath = path.join(testDir, filename);

  // Create test-data directory if it doesn't exist
  const fs = await import('fs/promises');
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(filePath, csvContent);

  return filePath;
}

test.describe('Storage Persistence', () => {
  let logs: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Capture console logs
    logs = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(`[${msg.type()}] ${text}`);
      console.log(`Browser: ${text}`); // Also print to test output
    });

    // Navigate to app
    await page.goto('/');

    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test('should persist files after upload and auto-save', async ({ page }) => {
    // Step 1: Upload a metric
    const csvPath = await createTestCSV('test-metric-1.csv');

    console.log('\n=== STEP 1: Upload CSV ===');
    await page.click('text=Upload CSV');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvPath);

    // Wait for upload to complete
    await page.waitForTimeout(2000);

    // Check for successful upload in logs
    const uploadLog = logs.find(log => log.includes('[SAVE]') && log.includes('insert'));
    console.log('Upload log:', uploadLog);

    // Step 2: Wait for auto-save to trigger
    console.log('\n=== STEP 2: Wait for Auto-Save ===');
    await page.waitForTimeout(3000); // Wait for auto-save debounce

    // Check for update log (should NOT be insert again)
    const updateLog = logs.find(log => log.includes('[SAVE]') && log.includes('update'));
    console.log('Auto-save log:', updateLog);

    // Step 3: Refresh page
    console.log('\n=== STEP 3: Refresh Page ===');
    logs = []; // Clear logs
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Step 4: Verify metric still loads
    console.log('\n=== STEP 4: Verify Data Persists ===');
    const errorLog = logs.find(log => log.includes('File does not exist'));
    const placeholderLog = logs.find(log => log.includes('no data_file_path'));

    console.log('Error log:', errorLog || 'None');
    console.log('Placeholder log:', placeholderLog || 'None');

    // Assertions
    expect(errorLog).toBeUndefined(); // Should NOT see file errors
    expect(placeholderLog).toBeUndefined(); // Should NOT see placeholder

    // Verify chart is visible
    const chart = page.locator('svg').first();
    await expect(chart).toBeVisible();
  });

  test('should persist multiple metrics across refreshes', async ({ page }) => {
    console.log('\n=== TEST: Multiple Metrics Persistence ===');

    // Upload 3 metrics
    for (let i = 1; i <= 3; i++) {
      const csvPath = await createTestCSV(`test-metric-${i}.csv`);
      await page.click('text=Upload CSV');
      await page.locator('input[type="file"]').setInputFiles(csvPath);
      await page.waitForTimeout(1500);
    }

    // Wait for auto-save
    await page.waitForTimeout(3000);

    // Refresh multiple times
    for (let i = 1; i <= 3; i++) {
      console.log(`\n=== Refresh #${i} ===`);
      logs = [];
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const errors = logs.filter(log =>
        log.includes('File does not exist') ||
        log.includes('no data_file_path')
      );

      console.log(`Errors on refresh #${i}:`, errors.length);
      expect(errors.length).toBe(0);
    }
  });

  test('should track save operations correctly', async ({ page }) => {
    console.log('\n=== TEST: Save Operation Tracking ===');

    // Upload first metric
    const csvPath = await createTestCSV('test-metric-tracking.csv');
    await page.click('text=Upload CSV');
    await page.locator('input[type="file"]').setInputFiles(csvPath);
    await page.waitForTimeout(2000);

    // Find the first save log (should be INSERT)
    const firstSave = logs.find(log =>
      log.includes('[SAVE]') &&
      (log.includes('insert: 1') || log.includes('Insert: 1'))
    );
    console.log('First save (should insert):', firstSave);
    expect(firstSave).toBeDefined();

    // Wait for auto-save
    logs = [];
    await page.waitForTimeout(3000);

    // Second save should be UPDATE
    const secondSave = logs.find(log =>
      log.includes('[SAVE]') &&
      (log.includes('update: 1') || log.includes('Update: 1'))
    );
    console.log('Auto-save (should update):', secondSave);
    expect(secondSave).toBeDefined();
  });
});

test.describe('Production Tests', () => {
  test.use({
    baseURL: 'https://bialy.vercel.app',
  });

  test('should work on production', async ({ page }) => {
    console.log('\n=== PRODUCTION TEST ===');

    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      if (text.includes('[SAVE]') || text.includes('[LOAD]')) {
        console.log(`Production: ${text}`);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for any errors
    const errors = logs.filter(log =>
      log.includes('File does not exist') ||
      log.includes('no data_file_path') ||
      log.includes('Error')
    );

    console.log(`\nProduction errors found: ${errors.length}`);
    errors.forEach(err => console.log(`  - ${err}`));
  });
});
