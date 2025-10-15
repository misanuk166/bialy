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

  return data.map(point => ({
    date: new Date(
      point.date.getTime() +
      getTimeOffset(shadow.periods, shadow.unit)
    ),
    numerator: point.numerator,
    denominator: point.denominator
  }));
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
