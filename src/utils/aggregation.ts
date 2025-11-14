import type { TimeSeriesPoint } from '../types/series';
import { addDays, addWeeks, addMonths, addYears, startOfWeek, startOfMonth, startOfQuarter, startOfYear } from 'date-fns';

export type TimeUnit = 'days' | 'weeks' | 'months' | 'years';
export type GroupByPeriod = 'week' | 'month' | 'quarter' | 'year';
export type AggregationMode = 'smoothing' | 'groupBy';

export interface AggregationConfig {
  enabled: boolean;
  mode: AggregationMode;
  // Smoothing mode settings
  period: number;
  unit: TimeUnit;
  // Group By mode settings
  groupByPeriod: GroupByPeriod;
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
 * Group time series data by period (week, month, quarter, year)
 * Aggregates all data points within each period
 */
export function groupByPeriod(
  data: TimeSeriesPoint[],
  period: GroupByPeriod
): TimeSeriesPoint[] {
  if (data.length === 0) return [];

  // Function to get the start of period for a given date
  const getPeriodStart = (date: Date): Date => {
    switch (period) {
      case 'week':
        return startOfWeek(date, { weekStartsOn: 0 }); // Sunday
      case 'month':
        return startOfMonth(date);
      case 'quarter':
        return startOfQuarter(date);
      case 'year':
        return startOfYear(date);
    }
  };

  // Group data points by period
  const groups = new Map<number, { numerator: number; denominator: number; date: Date }>();

  for (const point of data) {
    const periodStart = getPeriodStart(point.date);
    const periodKey = periodStart.getTime();

    if (!groups.has(periodKey)) {
      groups.set(periodKey, {
        numerator: 0,
        denominator: 0,
        date: periodStart
      });
    }

    const group = groups.get(periodKey)!;
    group.numerator += point.numerator;
    group.denominator += point.denominator;
  }

  // Convert map to array and sort by date
  const result = Array.from(groups.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

  return result;
}

/**
 * Apply aggregation based on config
 */
export function applyAggregation(
  data: TimeSeriesPoint[],
  config: AggregationConfig
): TimeSeriesPoint[] {
  if (!config.enabled) return data;

  if (config.mode === 'smoothing') {
    return calculateRollingAverage(data, config.period, config.unit);
  } else {
    return groupByPeriod(data, config.groupByPeriod);
  }
}

/**
 * Get human-readable label for aggregation
 */
export function getAggregationLabel(config: AggregationConfig): string {
  if (!config.enabled) return 'No aggregation';

  if (config.mode === 'smoothing') {
    return `${config.period}-${config.unit} rolling average`;
  } else {
    return `Grouped by ${config.groupByPeriod}`;
  }
}
