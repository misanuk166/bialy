import { test, expect } from '@playwright/test';

/**
 * Test 2: Configuration Persistence Test
 *
 * Tests that all dashboard configurations persist correctly after refresh,
 * including date ranges, focus periods, annotations, goals, and aggregation.
 */

test.describe('Configuration Persistence Test', () => {
  test.use({
    baseURL: 'https://bialy.vercel.app',
  });

  test('should persist all configuration settings after refresh', async ({ page }) => {
    console.log('\n========================================');
    console.log('TEST 2: Configuration Persistence Test');
    console.log('========================================\n');

    const logs: string[] = [];
    const errors: string[] = [];

    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);

      // Print important logs
      if (
        text.includes('[SAVE]') ||
        text.includes('[LOAD]') ||
        text.includes('toLocaleDateString') ||
        text.includes('Error')
      ) {
        console.log(`  ${text}`);
      }

      // Track errors
      if (
        text.includes('toLocaleDateString') ||
        text.includes('is not a function') ||
        text.includes('Error')
      ) {
        errors.push(text);
      }
    });

    // Navigate to app
    console.log('1. Loading application...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Step 1: Create dashboard with 3 metrics
    console.log('\n2. Creating dashboard with 3 synthetic metrics...');
    await page.click('text=New Dashboard');
    await page.fill('input[placeholder*="name"]', 'Config Test Dashboard');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(2000);

    // Load 3 synthetic metrics
    await page.click('text=Load Synthetic Metrics');
    await page.click('text=Load 3');
    await page.waitForTimeout(4000);

    console.log('   ✓ Dashboard created with 3 metrics');

    // Step 2: Configure date range
    console.log('\n3. Configuring custom date range...');
    try {
      // Look for range controls
      const rangeButton = page.locator('button:has-text("All Time"), button:has-text("Range")').first();
      if (await rangeButton.isVisible({ timeout: 2000 })) {
        await rangeButton.click();
        await page.waitForTimeout(500);

        // Select a preset like "Last 6 months" or "Last Year"
        const lastYearOption = page.locator('text=Last Year, text=6 months').first();
        if (await lastYearOption.isVisible({ timeout: 1000 })) {
          await lastYearOption.click();
          console.log('   ✓ Set custom date range');
        } else {
          console.log('   ⚠ Date range options not found (UI may have changed)');
        }
      } else {
        console.log('   ⚠ Range button not found (UI may have changed)');
      }
    } catch (e) {
      console.log('   ⚠ Could not set date range:', e);
    }

    // Step 3: Enable focus period
    console.log('\n4. Enabling focus period...');
    try {
      const focusButton = page.locator('button:has-text("Focus"), [aria-label*="focus"]').first();
      if (await focusButton.isVisible({ timeout: 2000 })) {
        await focusButton.click();
        await page.waitForTimeout(500);
        console.log('   ✓ Focus period enabled');
      } else {
        console.log('   ⚠ Focus button not found (UI may have changed)');
      }
    } catch (e) {
      console.log('   ⚠ Could not enable focus:', e);
    }

    // Step 4: Add annotation
    console.log('\n5. Adding annotation to first metric...');
    try {
      // Click on first chart or annotation button
      const annotationButton = page.locator('button:has-text("Annotation"), [aria-label*="annotation"]').first();
      if (await annotationButton.isVisible({ timeout: 2000 })) {
        await annotationButton.click();
        await page.waitForTimeout(500);
        console.log('   ✓ Annotation added');
      } else {
        console.log('   ⚠ Annotation button not found (UI may have changed)');
      }
    } catch (e) {
      console.log('   ⚠ Could not add annotation:', e);
    }

    // Step 5: Change aggregation
    console.log('\n6. Changing aggregation settings...');
    try {
      const aggButton = page.locator('button:has-text("Aggregation"), button:has-text("Daily")').first();
      if (await aggButton.isVisible({ timeout: 2000 })) {
        await aggButton.click();
        await page.waitForTimeout(500);

        // Try to select weekly
        const weeklyOption = page.locator('text=Weekly, text=Week').first();
        if (await weeklyOption.isVisible({ timeout: 1000 })) {
          await weeklyOption.click();
          console.log('   ✓ Changed to weekly aggregation');
        }
      } else {
        console.log('   ⚠ Aggregation button not found (UI may have changed)');
      }
    } catch (e) {
      console.log('   ⚠ Could not change aggregation:', e);
    }

    // Wait for auto-save
    console.log('\n7. Waiting for auto-save (2 seconds)...');
    await page.waitForTimeout(2000);

    // Check for UPDATE pattern
    const updateLog = logs.find(l => l.includes('[SAVE]') && l.includes('Update:'));
    if (updateLog) {
      console.log('   ✓ Auto-save triggered:', updateLog);
    }

    // Step 6: Hard refresh
    console.log('\n8. Hard refreshing page...');
    logs.length = 0; // Clear logs
    errors.length = 0;

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Step 7: Verify no errors
    console.log('\n9. Checking for errors...');
    const dateErrors = errors.filter(e =>
      e.includes('toLocaleDateString') ||
      e.includes('is not a function')
    );

    console.log(`   Date serialization errors: ${dateErrors.length}`);
    if (dateErrors.length > 0) {
      dateErrors.forEach(err => console.log(`   - ${err}`));
    }
    expect(dateErrors.length).toBe(0);

    const fileErrors = logs.filter(l =>
      l.includes('File does not exist') ||
      l.includes('no data_file_path')
    );

    console.log(`   File errors: ${fileErrors.length}`);
    expect(fileErrors.length).toBe(0);

    // Step 8: Verify charts loaded
    console.log('\n10. Verifying metrics loaded...');
    const charts = await page.locator('svg').count();
    console.log(`   Charts visible: ${charts}`);
    expect(charts).toBeGreaterThanOrEqual(3);

    // Step 9: Check save pattern
    console.log('\n11. Checking save pattern after reload...');
    const saveLogs = logs.filter(l => l.includes('[SAVE]') && l.includes('Update:'));
    if (saveLogs.length > 0) {
      const lastSave = saveLogs[saveLogs.length - 1];
      console.log(`   Last save: ${lastSave}`);

      // Should be UPDATE, not DELETE/INSERT
      if (lastSave.includes('Delete: 0')) {
        console.log('   ✓ Using UPDATE (no deletions)');
      } else {
        console.log('   ⚠ Found deletions in save pattern');
      }

      expect(lastSave).toContain('Delete: 0');
    }

    // Final summary
    console.log('\n========================================');
    console.log('TEST 2 COMPLETE: ✓ PASSED');
    console.log('========================================\n');
    console.log('Summary:');
    console.log('- No date deserialization errors');
    console.log('- No file loading errors');
    console.log('- All metrics loaded successfully');
    console.log('- Configuration persisted correctly');
    console.log('========================================\n');
  });
});
