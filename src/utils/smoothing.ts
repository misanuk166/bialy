import type { TimeSeriesPoint } from '../types/series';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';

export type TimeUnit = 'days' | 'weeks' | 'months' | 'years';

export interface SmoothingConfig {
  enabled: boolean;
  period: number;
  unit: TimeUnit;
}

/**
 * Calculate rolling average for time series data
 * For rate metrics (numerator/denominator), we sum numerators and denominators
 * separately, then divide for the proper average rate
 */
export function calculateRollingAverage(
  data: TimeSeriesPoint[],
  period: number,
  unit: TimeUnit
): TimeSeriesPoint[] {
  if (data.length === 0 || period <= 0) return [];

  const result: TimeSeriesPoint[] = [];

  // Function to get the date N units before a given date
  const getDateBefore = (date: Date, n: number): Date => {
    switch (unit) {
      case 'days':
        return addDays(date, -n);
      case 'weeks':
        return addWeeks(date, -n);
      case 'months':
        return addMonths(date, -n);
      case 'years':
        return addYears(date, -n);
    }
  };

  // For each point, calculate the rolling average
  for (let i = 0; i < data.length; i++) {
    const currentDate = data[i].date;
    const startDate = getDateBefore(currentDate, period - 1);

    // Find all points within the rolling window
    let sumNumerator = 0;
    let sumDenominator = 0;
    let count = 0;

    for (let j = 0; j <= i; j++) {
      if (data[j].date >= startDate && data[j].date <= currentDate) {
        sumNumerator += data[j].numerator;
        sumDenominator += data[j].denominator;
        count++;
      }
    }

    // Only add point if we have data in the window
    if (count > 0) {
      result.push({
        date: currentDate,
        numerator: sumNumerator,
        denominator: sumDenominator
      });
    }
  }

  return result;
}

/**
 * Get human-readable label for smoothing period
 */
export function getSmoothingLabel(config: SmoothingConfig): string {
  if (!config.enabled) return 'No smoothing';
  return `${config.period}-${config.unit} rolling average`;
}
