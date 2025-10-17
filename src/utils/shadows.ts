import type { TimeSeriesPoint } from '../types/series';
import type { Shadow, ShadowData, ShadowPeriodUnit } from '../types/shadow';

/**
 * Apply temporal transform to create shadow data
 * Shifts dates forward by the specified period so historical data
 * appears aligned with current data on the time axis
 */
export function createShadowData(
  data: TimeSeriesPoint[],
  shadow: Shadow
): TimeSeriesPoint[] {
  if (!shadow.enabled) return [];

  return data.map(point => {
    // Normalize to midnight to avoid time-of-day issues
    const normalizedDate = new Date(point.date);
    normalizedDate.setHours(0, 0, 0, 0);

    return {
      date: new Date(
        normalizedDate.getTime() +
        getTimeOffset(shadow.periods, shadow.unit)
      ),
      numerator: point.numerator,
      denominator: point.denominator
    };
  });
}

/**
 * Get time offset in milliseconds
 */
function getTimeOffset(periods: number, unit: ShadowPeriodUnit): number {
  const msPerDay = 24 * 60 * 60 * 1000;

  switch (unit) {
    case 'day':
      return periods * msPerDay;
    case 'week':
      return periods * 7 * msPerDay;
    case 'month':
      return periods * 30 * msPerDay; // Approximate
    case 'quarter':
      return periods * 90 * msPerDay; // Approximate
    case 'year':
      return periods * 365 * msPerDay; // Approximate
  }
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
  shadows: Shadow[]
): ShadowData[] {
  const enabledShadows = shadows.filter(s => s.enabled);

  return enabledShadows.map((shadow, index) => ({
    shadow,
    data: createShadowData(data, shadow),
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
      // Normalize to midnight to ensure consistent grouping by day
      const normalizedDate = new Date(point.date);
      normalizedDate.setHours(0, 0, 0, 0);
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
