import { test, expect } from '@playwright/test';

/**
 * Quick diagnostic test for production
 * Just loads the site and captures all console logs
 */

test.describe('Production Diagnostic', () => {
  test.use({
    baseURL: 'https://bialy.vercel.app',
  });

  test('diagnose production metrics loading', async ({ page }) => {
    console.log('\n' + '='.repeat(80));
    console.log('PRODUCTION DIAGNOSTIC TEST');
    console.log('='.repeat(80) + '\n');

    const logs: string[] = [];
    const errors: string[] = [];

    // Capture all console output
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();

      logs.push(`[${type}] ${text}`);

      // Print important logs immediately
      if (text.includes('[SAVE]') || text.includes('[LOAD]') || text.includes('File does not exist') || text.includes('data_file_path')) {
        console.log(`  ${type.toUpperCase()}: ${text}`);
      }

      // Track errors
      if (type === 'error' || text.includes('Error') || text.includes('does not exist')) {
        errors.push(text);
      }
    });

    // Capture network errors
    page.on('response', response => {
      if (response.status() >= 400) {
        const error = `Network ${response.status()}: ${response.url()}`;
        console.log(`  ERROR: ${error}`);
        errors.push(error);
      }
    });

    console.log('Loading https://bialy.vercel.app...\n');

    // Navigate to app
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for initial load
    await page.waitForTimeout(3000);

    console.log('\n--- INITIAL LOAD COMPLETE ---\n');

    // Check what's on the page
    const dashboardTitle = await page.textContent('h1').catch(() => null);
    console.log(`Dashboard title: ${dashboardTitle || 'Not found'}`);

    // Check for loading state
    const isLoading = await page.locator('text=Loading').isVisible().catch(() => false);
    console.log(`Still loading: ${isLoading}`);

    // Check for metrics
    const metricCards = await page.locator('[class*="metric"]').count().catch(() => 0);
    console.log(`Metric elements found: ${metricCards}`);

    // Check for charts
    const charts = await page.locator('svg').count();
    console.log(`SVG charts found: ${charts}`);

    // Now refresh and see what happens
    console.log('\n--- REFRESHING PAGE ---\n');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    console.log('\n--- REFRESH COMPLETE ---\n');

    // Check again after refresh
    const isLoadingAfter = await page.locator('text=Loading').isVisible().catch(() => false);
    console.log(`Still loading after refresh: ${isLoadingAfter}`);

    const chartsAfter = await page.locator('svg').count();
    console.log(`SVG charts after refresh: ${chartsAfter}`);

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total console logs: ${logs.length}`);
    console.log(`Total errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\nERRORS FOUND:');
      errors.forEach((err, i) => {
        console.log(`${i + 1}. ${err}`);
      });
    }

    // Look for specific patterns
    const saveUpdateLogs = logs.filter(l => l.includes('[SAVE]') && l.includes('update'));
    const saveInsertLogs = logs.filter(l => l.includes('[SAVE]') && l.includes('insert'));
    const saveDeleteLogs = logs.filter(l => l.includes('[SAVE]') && l.includes('delete'));
    const fileNotExistLogs = logs.filter(l => l.includes('File does not exist'));
    const placeholderLogs = logs.filter(l => l.includes('no data_file_path'));

    console.log(`\nSave operations:`);
    console.log(`  Updates: ${saveUpdateLogs.length}`);
    console.log(`  Inserts: ${saveInsertLogs.length}`);
    console.log(`  Deletes: ${saveDeleteLogs.length}`);
    console.log(`\nData issues:`);
    console.log(`  "File does not exist": ${fileNotExistLogs.length}`);
    console.log(`  "no data_file_path": ${placeholderLogs.length}`);

    console.log('\n' + '='.repeat(80) + '\n');

    // Print all logs for detailed inspection
    console.log('\nFULL LOG DUMP:');
    console.log('='.repeat(80));
    logs.forEach(log => console.log(log));
    console.log('='.repeat(80) + '\n');
  });
});
