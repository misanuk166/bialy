# Project-Specific Instructions for Bialy

## Date Handling - CRITICAL

**ALWAYS use UTC methods for date arithmetic.** This project has been bitten by timezone bugs multiple times.

### Rules:
1. **Never use local timezone methods** for date math:
   - ❌ `setHours()`, `setDate()`, `setMonth()`, `setFullYear()`
   - ❌ `getDay()`, `getDate()`, `getMonth()`, `getFullYear()`

2. **Always use UTC methods**:
   - ✅ `setUTCHours()`, `setUTCDate()`, `setUTCMonth()`, `setUTCFullYear()`
   - ✅ `getUTCDay()`, `getUTCDate()`, `getUTCMonth()`, `getUTCFullYear()`
   - ✅ `Date.UTC()` for creating dates

3. **When normalizing dates to midnight**:
   ```typescript
   // ✅ CORRECT
   const date = new Date(someDate);
   date.setUTCHours(0, 0, 0, 0);

   // ❌ WRONG - causes off-by-one errors in PST/PDT
   const date = new Date(someDate);
   date.setHours(0, 0, 0, 0);
   ```

### Why?
- User is in PST/PDT (UTC-8/UTC-7)
- Local timezone methods cause off-by-one errors when crossing midnight boundaries
- Shadow alignment and date comparisons must be consistent across timezones

### Files that handle dates:
- `src/utils/shadows.ts` - Shadow temporal transforms
- `src/utils/aggregation.ts` - Data aggregation by time period
- `src/components/TimeSeriesChart.tsx` - D3 time scales
- `src/components/CompactTimeSeriesChart.tsx` - Small charts

## UI Design and Prototyping

**When designing a new UI feature, always create a preview in a local .html file first.**

### Process:
1. Create a standalone HTML file in the project root (e.g., `new-feature-preview.html`)
2. Include all necessary CSS (Tailwind CDN is fine for prototypes)
3. Implement the UI with realistic sample data
4. Let the user review and iterate on the HTML preview
5. Once approved, integrate into the React components

### Benefits:
- Faster iteration without touching the main codebase
- User can see and interact with the design immediately
- Easier to experiment with multiple design options
- No build/compile delays during design phase

### Example:
Create files like `new-feature-preview.html` in the project root for rapid prototyping.

## Architecture Notes

### Shadow Visualization
- Uses progressive saturation fade (25% to 100% desaturation from blue to gray)
- Shadow transforms shift historical data FORWARD in time for overlay comparison
- Day-of-week alignment shifts by up to 4 days to match weekdays

### State Management
- Dashboard settings persist to Supabase database
- Debounced saves (300ms) for performance
- Row heights and column widths are per-dashboard settings
