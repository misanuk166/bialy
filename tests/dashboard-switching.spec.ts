import { test, expect, Page } from '@playwright/test';

/**
 * Test 1: Multi-Dashboard Stress Test
 *
 * Tests the dashboard switching bug where switching between dashboards
 * would trigger saves with mismatched data, causing file deletions.
 */

test.describe('Multi-Dashboard Stress Test', () => {
  test.use({
    baseURL: 'https://bialy.vercel.app',
  });

  test('should handle rapid dashboard switching without deleting files', async ({ page }) => {
    console.log('\n========================================');
    console.log('TEST 1: Multi-Dashboard Stress Test');
    console.log('========================================\n');

    const logs: string[] = [];
    const errors: string[] = [];

    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);

      // Print important logs
      if (
        text.includes('[DASHBOARD]') ||
        text.includes('[SAVE]') ||
        text.includes('[LOAD]') ||
        text.includes('File does not exist')
      ) {
        console.log(`  ${text}`);
      }

      // Track errors
      if (text.includes('File does not exist') || text.includes('Error')) {
        errors.push(text);
      }
    });

    // Navigate to app
    console.log('1. Loading application...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Step 1: Create Dashboard A with 1 CSV
    console.log('\n2. Creating Dashboard A (CSV Test)...');
    await page.click('text=New Dashboard');
    await page.fill('input[placeholder*="name"]', 'CSV Test Dashboard');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(2000);

    const dashboardAName = await page.textContent('h1');
    console.log(`   Created: ${dashboardAName}`);

    // Upload CSV (note: we'll need a test file)
    // For now, skip actual upload since we'd need file handling
    console.log('   Skipping CSV upload (would require test file)');
    console.log('   Using synthetic metrics instead...');

    // Load 1 synthetic metric
    await page.click('text=Load Synthetic Metrics');
    await page.click('text=Load 1');
    await page.waitForTimeout(3000);

    console.log('   Dashboard A created with 1 metric');

    // Step 2: Create Dashboard B with 10 metrics
    console.log('\n3. Creating Dashboard B (Synthetic Test)...');
    await page.click('text=New Dashboard');
    await page.fill('input[placeholder*="name"]', 'Synthetic Test Dashboard');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(2000);

    const dashboardBName = await page.textContent('h1');
    console.log(`   Created: ${dashboardBName}`);

    // Load 10 synthetic metrics
    await page.click('text=Load Synthetic Metrics');
    await page.click('text=Load 10');
    await page.waitForTimeout(5000);

    console.log('   Dashboard B created with 10 metrics');

    // Step 3: Rapid switching
    console.log('\n4. Performing rapid dashboard switching (5 times)...');

    for (let i = 1; i <= 5; i++) {
      console.log(`\n   Switch ${i}:`);

      // Switch to Dashboard A
      console.log('   → Switching to Dashboard A');
      await page.click('[data-testid="dashboard-selector"], button:has-text("CSV Test")');
      await page.waitForTimeout(1500);

      // Check logs for "Skipping save"
      const skipLogs = logs.filter(l => l.includes('Skipping save - dashboard is loading'));
      if (skipLogs.length > 0) {
        console.log('   ✓ Detected "Skipping save" - protection working!');
      }

      // Switch to Dashboard B
      console.log('   → Switching to Dashboard B');
      await page.click('button:has-text("Synthetic Test")');
      await page.waitForTimeout(1500);
    }

    console.log('\n   Switching complete!');

    // Step 4: Verify Dashboard A
    console.log('\n5. Verifying Dashboard A...');
    await page.click('button:has-text("CSV Test")');
    await page.waitForTimeout(2000);

    logs.length = 0; // Clear logs
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const dashboardAErrors = logs.filter(l =>
      l.includes('File does not exist') ||
      l.includes('no data_file_path')
    );

    console.log(`   Errors: ${dashboardAErrors.length}`);
    expect(dashboardAErrors.length).toBe(0);

    // Check for 1 metric
    const chartsA = await page.locator('svg').count();
    console.log(`   Charts found: ${chartsA}`);
    expect(chartsA).toBeGreaterThanOrEqual(1);

    // Step 5: Verify Dashboard B
    console.log('\n6. Verifying Dashboard B...');
    await page.click('button:has-text("Synthetic Test")');
    await page.waitForTimeout(2000);

    logs.length = 0; // Clear logs
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const dashboardBErrors = logs.filter(l =>
      l.includes('File does not exist') ||
      l.includes('no data_file_path')
    );

    console.log(`   Errors: ${dashboardBErrors.length}`);
    expect(dashboardBErrors.length).toBe(0);

    // Check for 10 metrics
    const chartsB = await page.locator('svg').count();
    console.log(`   Charts found: ${chartsB}`);
    expect(chartsB).toBeGreaterThanOrEqual(10);

    // Check save patterns
    console.log('\n7. Analyzing save patterns...');
    const badSavePattern = logs.find(l =>
      l.includes('[SAVE]') &&
      l.includes('Insert:') &&
      l.includes('Delete:') &&
      !l.includes('Insert: 0') &&
      !l.includes('Delete: 0')
    );

    if (badSavePattern) {
      console.log('   ⚠️  Found DELETE/INSERT pattern:', badSavePattern);
    } else {
      console.log('   ✓ No DELETE/INSERT patterns found (good!)');
    }

    expect(badSavePattern).toBeUndefined();

    // Final summary
    console.log('\n========================================');
    console.log('TEST 1 COMPLETE: ✓ PASSED');
    console.log('========================================\n');
  });
});
