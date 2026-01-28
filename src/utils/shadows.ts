import type { TimeSeriesPoint } from '../types/series';
import type { Shadow, ShadowData, ShadowPeriodUnit } from '../types/shadow';

/**
 * Calculate the minimum number of days to shift to align day-of-week
 * Returns offset in days (-4 to +4) to align shadowDate with targetDate's day-of-week
 * Uses UTC to avoid timezone issues
 */
export function calculateDayOfWeekAlignment(targetDate: Date, shadowDate: Date): number {
  const targetDay = targetDate.getUTCDay(); // 0 (Sunday) to 6 (Saturday)
  const shadowDay = shadowDate.getUTCDay();

  const diff = targetDay - shadowDay;

  if (diff === 0) return 0; // Already aligned

  // Calculate forward and backward shifts
  const forwardShift = diff > 0 ? diff : diff + 7;
  const backwardShift = diff < 0 ? diff : diff - 7;

  // Choose minimum absolute value (maximum 4 days allowed)
  // This means we prefer the direction that requires fewer days, up to 4 days
  return Math.abs(forwardShift) <= Math.abs(backwardShift) ? forwardShift : backwardShift;
}

/**
 * Apply temporal transform to create shadow data
 * Shifts dates forward by the specified period so historical data
 * appears aligned with current data on the time axis
 * If alignDayOfWeek is enabled, also shifts by up to 4 days to align day-of-week
 */
export function createShadowData(
  data: TimeSeriesPoint[],
  shadow: Shadow,
  _referenceDate?: Date // Optional reference date (unused - alignment based on each date point)
): TimeSeriesPoint[] {
  if (!shadow.enabled) return [];

  return data.map((point) => {
    // Normalize to midnight UTC to avoid timezone issues
    const normalizedDate = new Date(point.date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    // Apply calendar-aware offset to get the historical date
    const historicalDate = applyCalendarOffset(new Date(normalizedDate), shadow.periods, shadow.unit);

    // Calculate day-of-week alignment for THIS specific data point
    let alignmentOffsetMs = 0;
    if (shadow.alignDayOfWeek) {
      const alignmentDays = calculateDayOfWeekAlignment(normalizedDate, historicalDate);
      alignmentOffsetMs = alignmentDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    }

    // Apply day-of-week alignment to the historical date
    const shiftedDate = new Date(historicalDate.getTime() + alignmentOffsetMs);

    return {
      date: shiftedDate,
      numerator: point.numerator,
      denominator: point.denominator
    };
  });
}

/**
 * Get time offset in milliseconds using calendar-aware date arithmetic
 */
function getTimeOffset(periods: number, unit: ShadowPeriodUnit): number {
  const msPerDay = 24 * 60 * 60 * 1000;

  switch (unit) {
    case 'day':
      return periods * msPerDay;
    case 'week':
      return periods * 7 * msPerDay;
    case 'month':
      // For months, quarters, and years, we can't use fixed offsets
      // These will be handled differently in createShadowData
      return periods * 30 * msPerDay; // Approximate (used as fallback)
    case 'quarter':
      return periods * 90 * msPerDay; // Approximate (used as fallback)
    case 'year':
      return periods * 365 * msPerDay; // Approximate (used as fallback)
  }
}

/**
 * Apply calendar-aware date offset for month/quarter/year periods
 * IMPORTANT: periods should be ADDED (shift forward in time) to display historical data at current positions
 * Uses UTC methods to avoid timezone-related off-by-one errors
 */
function applyCalendarOffset(date: Date, periods: number, unit: ShadowPeriodUnit): Date {
  const result = new Date(date);

  switch (unit) {
    case 'day':
      result.setUTCDate(result.getUTCDate() + periods);
      break;
    case 'week':
      result.setUTCDate(result.getUTCDate() + (periods * 7));
      break;
    case 'month':
      result.setUTCMonth(result.getUTCMonth() + periods);
      break;
    case 'quarter':
      result.setUTCMonth(result.getUTCMonth() + (periods * 3));
      break;
    case 'year':
      result.setUTCFullYear(result.getUTCFullYear() + periods);
      break;
  }

  return result;
}

/**
 * Get gray color for shadow based on how far back it goes
 * Further back = lighter gray
 */
export function getShadowColor(index: number, total: number): string {
  // Generate shades from #666 (darker) to #ccc (lighter)
  const baseValue = 102; // 0x66
  const maxValue = 204; // 0xcc
  const step = (maxValue - baseValue) / Math.max(total - 1, 1);
  const value = Math.round(baseValue + (index * step));
  const hex = value.toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
}

/**
 * Generate shadow data for all enabled shadows
 */
export function generateShadowsData(
  data: TimeSeriesPoint[],
  shadows: Shadow[],
  referenceDate?: Date // Selection date for day-of-week alignment
): ShadowData[] {
  const enabledShadows = shadows.filter(s => s.enabled);

  return enabledShadows.map((shadow, index) => ({
    shadow,
    data: createShadowData(data, shadow, referenceDate),
    color: getShadowColor(index, enabledShadows.length)
  }));
}

/**
 * Create a default shadow
 */
export function createShadow(
  periods: number,
  unit: ShadowPeriodUnit,
  label?: string
): Shadow {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    periods,
    unit,
    label: label || `${periods} ${unit}${periods > 1 ? 's' : ''} ago`
  };
}

/**
 * Calculate average and standard deviation across shadow periods
 * Groups data by date and computes statistics
 */
export interface AveragedShadowData {
  date: Date;
  mean: number;
  stdDev: number;
}

export function calculateShadowAverage(
  shadowsData: ShadowData[]
): AveragedShadowData[] {
  if (shadowsData.length === 0) return [];

  // Group all shadow data points by date
  const dateMap = new Map<number, number[]>();

  shadowsData.forEach(shadowData => {
    shadowData.data.forEach(point => {
      // Normalize to midnight UTC to ensure consistent grouping by day
      const normalizedDate = new Date(point.date);
      normalizedDate.setUTCHours(0, 0, 0, 0);
      const dateKey = normalizedDate.getTime();

      const value = point.numerator / point.denominator;

      if (!isNaN(value) && isFinite(value)) {
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, []);
        }
        dateMap.get(dateKey)!.push(value);
      }
    });
  });

  // Calculate mean and standard deviation for each date
  const results: AveragedShadowData[] = [];

  dateMap.forEach((values, dateKey) => {
    if (values.length === 0) return;

    // Calculate mean
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

    // Calculate standard deviation
    let variance = 0;
    if (values.length > 1) {
      const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
      variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    }
    const stdDev = Math.sqrt(variance);

    results.push({
      date: new Date(dateKey),
      mean,
      stdDev
    });
  });

  // Sort by date
  results.sort((a, b) => a.date.getTime() - b.date.getTime());

  return results;
}
