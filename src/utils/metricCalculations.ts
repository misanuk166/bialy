import type { Series } from '../types/series';
import type { AggregationConfig } from './aggregation';
import type { Shadow } from '../types/shadow';
import type { Goal } from '../types/goal';
import type { FocusPeriod } from '../types/focusPeriod';
import type { ForecastConfig, ForecastSnapshot } from '../types/forecast';
import type { MetricRowValues, DisplayMode } from '../types/appState';
import type { ComparisonConfig, ComparisonResult } from '../types/comparison';
import { applyAggregation, normalizeSelectionDate } from './aggregation';
import { generateShadowsData, calculateShadowAverage } from './shadows';
import { generateGoalsData } from './goals';
import { startOfWeek, startOfMonth, startOfQuarter, startOfYear, endOfWeek, endOfMonth, endOfQuarter, endOfYear } from 'date-fns';

// Helper function to determine decimal precision (currently unused)
// function getDecimalPrecision(num: number): number {
//   const str = num.toString();
//   if (!str.includes('.')) return 0;
//   return str.split('.')[1].length;
// }

export function calculateMetricRowValues(
  series: Series,
  currentDate: Date | null,
  aggregationConfig?: AggregationConfig,
  shadows?: Shadow[],
  averageShadows?: boolean,
  goals?: Goal[],
  focusPeriod?: FocusPeriod,
  forecastConfig?: ForecastConfig,
  forecastSnapshot?: ForecastSnapshot,
  displayMode: DisplayMode = 'ratio'
): MetricRowValues {
  // Helper function to calculate value based on display mode
  const getValue = (numerator: number, denominator: number) => {
    return displayMode === 'sum' ? numerator : numerator / denominator;
  };

  // Prepare data (needed for both selection and focus period calculations)
  const dataWithValues = series.data.map(d => ({
    date: d.date,
    value: getValue(d.numerator, d.denominator)
  }));

  // Calculate precision (currently unused but may be needed for future enhancements)
  // const dataPrecision = Math.max(...dataWithValues.slice(0, 100).map(d => getDecimalPrecision(d.value)));

  // Apply aggregation
  let displayData = dataWithValues;
  if (aggregationConfig?.enabled) {
    const aggregated = applyAggregation(series.data, aggregationConfig);
    displayData = aggregated.map(d => ({
      date: d.date,
      value: getValue(d.numerator, d.denominator)
    }));
  }

  // Calculate focus period values (independent of selection date)
  let focusPeriodMean: number | undefined;
  let focusPeriodRange: { min: number; max: number } | undefined;
  let focusPeriodVsShadowAbs: number | undefined;
  let focusPeriodVsShadowPct: number | undefined;
  let focusPeriodVsGoalAbs: number | undefined;
  let focusPeriodVsGoalPct: number | undefined;

  if (focusPeriod?.enabled && focusPeriod.startDate && focusPeriod.endDate) {
    const focusData = displayData.filter(d =>
      d.date >= focusPeriod.startDate! && d.date <= focusPeriod.endDate!
    );

    if (focusData.length > 0) {
      // For SUM mode: sum all values (which are already numerators from getValue)
      // For RATIO mode: calculate mean (weighted average)
      const values = focusData.map(d => d.value);
      if (displayMode === 'sum') {
        focusPeriodMean = values.reduce((sum, v) => sum + v, 0);
      } else {
        focusPeriodMean = values.reduce((sum, v) => sum + v, 0) / values.length;
      }

      let min = Infinity;
      let max = -Infinity;
      for (const value of values) {
        if (value < min) min = value;
        if (value > max) max = value;
      }
      focusPeriodRange = { min, max };

      // DEBUG: Log focus period data
      console.log('[FOCUS PERIOD DATA]', {
        focusPeriodLabel: focusPeriod.label,
        focusPeriodStart: focusPeriod.startDate,
        focusPeriodEnd: focusPeriod.endDate,
        dataPoints: focusData.length,
        mean: focusPeriodMean,
        range: focusPeriodRange,
        displayMode: displayMode,
        firstDate: focusData[0]?.date,
        lastDate: focusData[focusData.length - 1]?.date
      });
    }
  }

  // If no current date selected, return only focus period values
  if (!currentDate) {
    return {
      focusPeriodMean,
      focusPeriodRange
    };
  }

  // Use forecast snapshot (only use pre-computed forecasts)
  let forecastData: Array<{ date: Date; value: number }> = [];
  let rawForecastData: Array<{ date: Date; value: number }> = []; // Keep raw forecast for range calculation
  if (forecastConfig?.enabled && forecastSnapshot) {
    rawForecastData = forecastSnapshot.values.map(v => ({
      date: new Date(v.date),
      value: v.value
    }));
    forecastData = rawForecastData;

    // If aggregation is enabled, apply it to forecast data as well
    if (aggregationConfig?.enabled) {
      // Convert forecast values to TimeSeriesPoint format
      const forecastPoints = forecastData.map(d => ({
        date: d.date,
        numerator: d.value,
        denominator: 1
      }));

      // Apply aggregation
      const aggregatedForecast = applyAggregation(forecastPoints, aggregationConfig);

      // Convert back to value format
      forecastData = aggregatedForecast.map(d => ({
        date: d.date,
        value: d.numerator / d.denominator
      }));
    }
  }

  // Normalize selection date to match aggregation period
  const normalizedDate = normalizeSelectionDate(currentDate, aggregationConfig);

  // Find current point (check both display data and forecast data)
  const dateTime = normalizedDate.getTime();
  let currentPoint = displayData.find(p => {
    const diff = Math.abs(p.date.getTime() - dateTime);
    return diff < 24 * 60 * 60 * 1000; // 1 day tolerance
  });

  // Track if we're using a forecast point and its index
  let isForecastPoint = false;
  let forecastPointIndex = -1;

  // If not found in display data, check forecast data
  if (!currentPoint && forecastData.length > 0) {
    forecastPointIndex = forecastData.findIndex(p => {
      const diff = Math.abs(p.date.getTime() - dateTime);
      return diff < 24 * 60 * 60 * 1000; // 1 day tolerance
    });
    if (forecastPointIndex >= 0) {
      currentPoint = forecastData[forecastPointIndex];
      isForecastPoint = true;
    }
  }

  if (!currentPoint) {
    return {};
  }

  // Calculate selection mean and range
  let selectionValue: number;
  let selectionRange: { min: number; max: number } | undefined;

  // If this is a forecast point, calculate mean/range the same way as actual data
  if (isForecastPoint && aggregationConfig?.enabled) {
    // For aggregated forecast data, calculate mean and range from raw forecast points in the aggregated period
    const aggregatedPointDate = currentPoint.date;

    // Determine the period start based on aggregation mode (same logic as actual data)
    let periodStart: Date;
    let periodEnd: Date = new Date(aggregatedPointDate);

    if (aggregationConfig.mode === 'groupBy') {
      // Use the same date-fns functions as aggregation.ts for consistency
      switch (aggregationConfig.groupByPeriod) {
        case 'week':
          periodStart = startOfWeek(aggregatedPointDate, { weekStartsOn: 0 }); // Sunday
          periodEnd = endOfWeek(aggregatedPointDate, { weekStartsOn: 0 });
          break;
        case 'month':
          periodStart = startOfMonth(aggregatedPointDate);
          periodEnd = endOfMonth(aggregatedPointDate);
          break;
        case 'quarter':
          periodStart = startOfQuarter(aggregatedPointDate);
          periodEnd = endOfQuarter(aggregatedPointDate);
          break;
        case 'year':
          periodStart = startOfYear(aggregatedPointDate);
          periodEnd = endOfYear(aggregatedPointDate);
          break;
      }
    } else {
      // For smoothing, use the window size
      periodStart = new Date(aggregatedPointDate);
      const periodDays = aggregationConfig.period;
      periodStart.setDate(periodStart.getDate() - periodDays + 1);
    }

    // Find all raw forecast points within this period
    const periodForecastData = rawForecastData.filter(d =>
      d.date >= periodStart && d.date <= periodEnd
    );

    if (periodForecastData.length > 0) {
      const values = periodForecastData.map(d => d.value);
      selectionValue = values.reduce((sum, v) => sum + v, 0) / values.length;
      let min = Infinity;
      let max = -Infinity;
      for (const value of values) {
        if (value < min) min = value;
        if (value > max) max = value;
      }
      selectionRange = { min, max };
    } else {
      // Fallback to aggregated value
      selectionValue = currentPoint.value;
    }
  } else if (isForecastPoint) {
    // No aggregation: just use the forecast point value
    selectionValue = currentPoint.value;
    // For consistency, set range to the same value
    selectionRange = {
      min: currentPoint.value,
      max: currentPoint.value
    };
  } else if (aggregationConfig?.enabled) {
    // For aggregated data, calculate mean and range from all raw points in the aggregated period
    // Find the aggregated period boundaries
    const aggregatedPointDate = currentPoint.date;

    // Determine the period start based on aggregation mode
    let periodStart: Date;
    let periodEnd: Date = new Date(aggregatedPointDate);

    if (aggregationConfig.mode === 'groupBy') {
      // Use the same date-fns functions as aggregation.ts for consistency
      switch (aggregationConfig.groupByPeriod) {
        case 'week':
          periodStart = startOfWeek(aggregatedPointDate, { weekStartsOn: 0 }); // Sunday
          periodEnd = endOfWeek(aggregatedPointDate, { weekStartsOn: 0 });
          break;
        case 'month':
          periodStart = startOfMonth(aggregatedPointDate);
          periodEnd = endOfMonth(aggregatedPointDate);
          break;
        case 'quarter':
          periodStart = startOfQuarter(aggregatedPointDate);
          periodEnd = endOfQuarter(aggregatedPointDate);
          break;
        case 'year':
          periodStart = startOfYear(aggregatedPointDate);
          periodEnd = endOfYear(aggregatedPointDate);
          break;
      }
    } else {
      // For smoothing, use the window size
      periodStart = new Date(aggregatedPointDate);
      const periodDays = aggregationConfig.period;
      periodStart.setDate(periodStart.getDate() - periodDays + 1);
    }

    // Find all raw data points within this period
    const periodRawData = series.data.filter(d =>
      d.date >= periodStart && d.date <= periodEnd
    );

    if (periodRawData.length > 0) {
      // For ratio mode: Use weighted average (sum numerators / sum denominators)
      // For sum mode: Sum all numerators in the period
      const totalNumerator = periodRawData.reduce((sum, d) => sum + d.numerator, 0);
      const totalDenominator = periodRawData.reduce((sum, d) => sum + d.denominator, 0);
      selectionValue = displayMode === 'sum'
        ? totalNumerator
        : (totalDenominator > 0 ? totalNumerator / totalDenominator : currentPoint.value);

      // Calculate range from individual values
      const values = periodRawData.map(d => getValue(d.numerator, d.denominator));
      let min = Infinity;
      let max = -Infinity;
      for (const value of values) {
        if (value < min) min = value;
        if (value > max) max = value;
      }
      selectionRange = { min, max };
    } else {
      selectionValue = currentPoint.value;
    }
  } else {
    // No aggregation: just use the point value
    selectionValue = currentPoint.value;
    // For consistency, set range to the same value
    selectionRange = {
      min: currentPoint.value,
      max: currentPoint.value
    };
  }

  // Calculate shadow values
  let shadowValue: number | undefined;
  let shadowLabel: string | undefined;
  if (shadows && shadows.length > 0) {
    const shadowsData = generateShadowsData(series.data, shadows, currentDate || undefined);
    const aggregatedShadowsData = aggregationConfig?.enabled
      ? shadowsData.map(sd => ({
          shadow: sd.shadow,
          data: applyAggregation(sd.data, aggregationConfig),
          color: sd.color
        }))
      : shadowsData;

    if (averageShadows && aggregatedShadowsData.length > 1) {
      const averagedShadowData = calculateShadowAverage(aggregatedShadowsData);
      const shadowPoint = averagedShadowData.find(p => {
        const diff = Math.abs(p.date.getTime() - dateTime);
        return diff < 24 * 60 * 60 * 1000;
      });
      shadowValue = shadowPoint?.mean;
      shadowLabel = `avg of ${shadows.filter(s => s.enabled).length} periods`;
    } else if (aggregatedShadowsData.length > 0) {
      const shadowDataWithValues = aggregatedShadowsData[0].data.map(d => ({
        date: d.date,
        value: getValue(d.numerator, d.denominator)
      }));
      const shadowPoint = shadowDataWithValues.find(p => {
        const diff = Math.abs(p.date.getTime() - dateTime);
        return diff < 24 * 60 * 60 * 1000;
      });
      shadowValue = shadowPoint?.value;
      shadowLabel = aggregatedShadowsData[0].shadow.label;
    }
  }

  // Calculate goal values
  let goalValue: number | undefined;
  let goalLabel: string | undefined;
  if (goals && goals.length > 0) {
    const goalsData = generateGoalsData(series.data, goals);
    const enabledGoals = goalsData.filter(gd => gd.goal.enabled);
    if (enabledGoals.length > 0) {
      const goalData = enabledGoals[0];
      const goalDataWithValues = goalData.data.map(d => ({
        date: d.date,
        value: getValue(d.numerator, d.denominator)
      }));

      if (goalData.goal.type === 'continuous' && goalDataWithValues.length === 2) {
        const startDate = goalDataWithValues[0].date;
        const endDate = goalDataWithValues[1].date;
        if (currentDate >= startDate && currentDate <= endDate) {
          goalValue = goalDataWithValues[0].value;
        }
      } else {
        const goalPoint = goalDataWithValues.find(p => {
          const diff = Math.abs(p.date.getTime() - dateTime);
          return diff < 24 * 60 * 60 * 1000;
        });
        goalValue = goalPoint?.value;
      }

      goalLabel = goalData.goal.label;
    }
  }

  // Calculate shadow and goal comparisons for focus period (independent of selection)
  if (focusPeriodMean !== undefined && focusPeriod?.enabled && focusPeriod.startDate && focusPeriod.endDate) {
    // Calculate average shadow value over the focus period range
    if (shadows && shadows.length > 0) {
      const shadowsData = generateShadowsData(series.data, shadows, currentDate || undefined);
      const aggregatedShadowsData = aggregationConfig?.enabled
        ? shadowsData.map(sd => ({
            shadow: sd.shadow,
            data: applyAggregation(sd.data, aggregationConfig),
            color: sd.color
          }))
        : shadowsData;

      // Get shadow data within focus period and calculate mean
      if (averageShadows && aggregatedShadowsData.length > 1) {
        const averagedShadowData = calculateShadowAverage(aggregatedShadowsData);

        // CRITICAL FIX: Only include shadow data for dates that exist in the current focus period
        const actualFocusData = displayData.filter(d =>
          d.date >= focusPeriod.startDate! && d.date <= focusPeriod.endDate!
        );
        // Use date strings (YYYY-MM-DD) for comparison to avoid timestamp precision issues
        const availableDateStrings = new Set(
          actualFocusData.map(d => d.date.toISOString().split('T')[0])
        );

        const focusShadowData = averagedShadowData.filter(p => {
          const dateStr = p.date.toISOString().split('T')[0];
          return p.date >= focusPeriod.startDate! &&
                 p.date <= focusPeriod.endDate! &&
                 availableDateStrings.has(dateStr);
        });

        if (focusShadowData.length > 0) {
          // For SUM mode: sum all shadow values
          // For RATIO mode: calculate mean
          const focusShadowMean = displayMode === 'sum'
            ? focusShadowData.reduce((sum, p) => sum + p.mean, 0)
            : focusShadowData.reduce((sum, p) => sum + p.mean, 0) / focusShadowData.length;
          focusPeriodVsShadowAbs = focusPeriodMean - focusShadowMean;
          focusPeriodVsShadowPct = (focusPeriodVsShadowAbs / focusShadowMean) * 100;
        }
      } else if (aggregatedShadowsData.length > 0) {
        const shadowDataWithValues = aggregatedShadowsData[0].data.map(d => ({
          date: d.date,
          value: getValue(d.numerator, d.denominator)
        }));

        // CRITICAL FIX: Only include shadow data for dates that exist in the current focus period
        // This ensures we're comparing the same date ranges (e.g., Jan 1-20 vs Jan 1-20 last year)
        // rather than partial current period vs full shadow period
        const actualFocusData = displayData.filter(d =>
          d.date >= focusPeriod.startDate! && d.date <= focusPeriod.endDate!
        );
        // Use date strings (YYYY-MM-DD) for comparison to avoid timestamp precision issues
        const availableDateStrings = new Set(
          actualFocusData.map(d => d.date.toISOString().split('T')[0])
        );

        const focusShadowData = shadowDataWithValues.filter(p => {
          const dateStr = p.date.toISOString().split('T')[0];
          return p.date >= focusPeriod.startDate! &&
                 p.date <= focusPeriod.endDate! &&
                 availableDateStrings.has(dateStr);
        });

        if (focusShadowData.length > 0) {
          // For SUM mode: sum all shadow values
          // For RATIO mode: calculate mean
          const focusShadowMean = displayMode === 'sum'
            ? focusShadowData.reduce((sum, p) => sum + p.value, 0)
            : focusShadowData.reduce((sum, p) => sum + p.value, 0) / focusShadowData.length;
          focusPeriodVsShadowAbs = focusPeriodMean - focusShadowMean;
          focusPeriodVsShadowPct = (focusPeriodVsShadowAbs / focusShadowMean) * 100;

          // DEBUG: Log focus period comparison details
          console.log('[FOCUS PERIOD DEBUG]', {
            focusPeriodLabel: focusPeriod.label,
            focusPeriodStart: focusPeriod.startDate,
            focusPeriodEnd: focusPeriod.endDate,
            currentMean: focusPeriodMean,
            currentDataPoints: actualFocusData.length,
            shadowMean: focusShadowMean,
            shadowDataPoints: focusShadowData.length,
            percentDiff: focusPeriodVsShadowPct,
            shadowLabel: aggregatedShadowsData[0].shadow.label
          });
        }
      }
    }

    // Calculate average goal value over the focus period range
    if (goals && goals.length > 0) {
      const goalsData = generateGoalsData(series.data, goals);
      const enabledGoals = goalsData.filter(gd => gd.goal.enabled);
      if (enabledGoals.length > 0) {
        const goalData = enabledGoals[0];
        const goalDataWithValues = goalData.data.map(d => ({
          date: d.date,
          value: getValue(d.numerator, d.denominator)
        }));

        const focusGoalData = goalDataWithValues.filter(p =>
          p.date >= focusPeriod.startDate! && p.date <= focusPeriod.endDate!
        );
        if (focusGoalData.length > 0) {
          // For SUM mode: sum all goal values
          // For RATIO mode: calculate mean
          const focusGoalMean = displayMode === 'sum'
            ? focusGoalData.reduce((sum, p) => sum + p.value, 0)
            : focusGoalData.reduce((sum, p) => sum + p.value, 0) / focusGoalData.length;
          focusPeriodVsGoalAbs = focusPeriodMean - focusGoalMean;
          focusPeriodVsGoalPct = (focusPeriodVsGoalAbs / focusGoalMean) * 100;
        }
      }
    }
  }

  // Calculate selection comparisons
  const selectionVsShadowAbs = shadowValue !== undefined ? selectionValue - shadowValue : undefined;
  const selectionVsShadowPct = shadowValue !== undefined && selectionVsShadowAbs !== undefined
    ? (selectionVsShadowAbs / shadowValue) * 100
    : undefined;

  const selectionVsGoalAbs = goalValue !== undefined ? selectionValue - goalValue : undefined;
  const selectionVsGoalPct = goalValue !== undefined && selectionVsGoalAbs !== undefined
    ? (selectionVsGoalAbs / goalValue) * 100
    : undefined;

  const result = {
    selectionValue,
    selectionRange,
    selectionVsShadowAbs,
    selectionVsShadowPct,
    selectionVsGoalAbs,
    selectionVsGoalPct,
    focusPeriodMean,
    focusPeriodRange,
    focusPeriodVsShadowAbs,
    focusPeriodVsShadowPct,
    focusPeriodVsGoalAbs,
    focusPeriodVsGoalPct,
    shadowValue,
    shadowLabel,
    goalValue,
    goalLabel
  };
  return result;
}

/**
 * Calculate a single comparison result
 */
function calculateComparison(
  comparison: ComparisonConfig,
  actualValue: number,
  shadows: Shadow[] | undefined,
  averageShadows: boolean | undefined,
  goals: Goal[] | undefined,
  forecastConfig: ForecastConfig | undefined,
  forecastSnapshot: ForecastSnapshot | undefined,
  _displayData: Array<{ date: Date; value: number }>,
  aggregationConfig: AggregationConfig | undefined,
  currentDate: Date,
  seriesData: any,
  focusPeriod: FocusPeriod | undefined,
  displayMode: DisplayMode = 'ratio'
): ComparisonResult | null {
  const dateTime = currentDate.getTime();
  const isFocusPeriodComparison = comparison.periodType === 'focus';

  // Helper function to calculate value based on display mode
  const getValue = (numerator: number, denominator: number) => {
    return displayMode === 'sum' ? numerator : numerator / denominator;
  };

  let targetValue: number | undefined;
  let targetLabel: string | undefined;

  // Calculate target value based on comparison type
  switch (comparison.type) {
    case 'shadow': {
      if (!shadows || shadows.length === 0) return null;

      const shadowsData = generateShadowsData(seriesData, shadows, currentDate || undefined);
      const aggregatedShadowsData = aggregationConfig?.enabled
        ? shadowsData.map(sd => ({
            shadow: sd.shadow,
            data: applyAggregation(sd.data, aggregationConfig),
            color: sd.color
          }))
        : shadowsData;

      if (isFocusPeriodComparison && focusPeriod?.enabled && focusPeriod.startDate && focusPeriod.endDate) {
        // For focus period comparisons, calculate average over the focus period range
        // CRITICAL FIX: Only include shadow data for dates that exist in the current focus period
        const actualFocusData = _displayData.filter(d =>
          d.date >= focusPeriod.startDate! && d.date <= focusPeriod.endDate!
        );
        // Use date strings (YYYY-MM-DD) for comparison to avoid timestamp precision issues
        const availableDateStrings = new Set(
          actualFocusData.map(d => d.date.toISOString().split('T')[0])
        );

        if (comparison.targetIndex !== undefined && comparison.targetIndex < aggregatedShadowsData.length) {
          const shadowData = aggregatedShadowsData[comparison.targetIndex];
          const shadowDataWithValues = shadowData.data.map(d => ({
            date: d.date,
            value: getValue(d.numerator, d.denominator)
          }));
          const focusShadowData = shadowDataWithValues.filter(p => {
            const dateStr = p.date.toISOString().split('T')[0];
            return p.date >= focusPeriod.startDate! &&
                   p.date <= focusPeriod.endDate! &&
                   availableDateStrings.has(dateStr);
          });
          if (focusShadowData.length > 0) {
            // For SUM mode: sum all shadow values
            // For RATIO mode: calculate mean
            targetValue = displayMode === 'sum'
              ? focusShadowData.reduce((sum, p) => sum + p.value, 0)
              : focusShadowData.reduce((sum, p) => sum + p.value, 0) / focusShadowData.length;
          }
          targetLabel = shadowData.shadow.label;
        } else if (averageShadows && aggregatedShadowsData.length > 1) {
          const averagedShadowData = calculateShadowAverage(aggregatedShadowsData);
          const focusShadowData = averagedShadowData.filter(p => {
            const dateStr = p.date.toISOString().split('T')[0];
            return p.date >= focusPeriod.startDate! &&
                   p.date <= focusPeriod.endDate! &&
                   availableDateStrings.has(dateStr);
          });
          if (focusShadowData.length > 0) {
            // For SUM mode: sum all shadow values
            // For RATIO mode: calculate mean
            targetValue = displayMode === 'sum'
              ? focusShadowData.reduce((sum, p) => sum + p.mean, 0)
              : focusShadowData.reduce((sum, p) => sum + p.mean, 0) / focusShadowData.length;
          }
          targetLabel = `avg of ${shadows.filter(s => s.enabled).length} periods`;
        } else if (aggregatedShadowsData.length > 0) {
          const shadowData = aggregatedShadowsData[0];
          const shadowDataWithValues = shadowData.data.map(d => ({
            date: d.date,
            value: getValue(d.numerator, d.denominator)
          }));
          const focusShadowData = shadowDataWithValues.filter(p => {
            const dateStr = p.date.toISOString().split('T')[0];
            return p.date >= focusPeriod.startDate! &&
                   p.date <= focusPeriod.endDate! &&
                   availableDateStrings.has(dateStr);
          });
          if (focusShadowData.length > 0) {
            // For SUM mode: sum all shadow values
            // For RATIO mode: calculate mean
            targetValue = displayMode === 'sum'
              ? focusShadowData.reduce((sum, p) => sum + p.value, 0)
              : focusShadowData.reduce((sum, p) => sum + p.value, 0) / focusShadowData.length;
          }
          targetLabel = shadowData.shadow.label;
        }
      } else {
        // For selection comparisons, find value at specific date
        if (comparison.targetIndex !== undefined && comparison.targetIndex < aggregatedShadowsData.length) {
          // Use specific shadow
          const shadowData = aggregatedShadowsData[comparison.targetIndex];
          const shadowDataWithValues = shadowData.data.map(d => ({
            date: d.date,
            value: getValue(d.numerator, d.denominator)
          }));
          const shadowPoint = shadowDataWithValues.find(p => {
            const diff = Math.abs(p.date.getTime() - dateTime);
            return diff < 24 * 60 * 60 * 1000;
          });
          targetValue = shadowPoint?.value;
          targetLabel = shadowData.shadow.label;
        } else if (averageShadows && aggregatedShadowsData.length > 1) {
          // Use average of all shadows
          const averagedShadowData = calculateShadowAverage(aggregatedShadowsData);
          const shadowPoint = averagedShadowData.find(p => {
            const diff = Math.abs(p.date.getTime() - dateTime);
            return diff < 24 * 60 * 60 * 1000;
          });
          targetValue = shadowPoint?.mean;
          targetLabel = `avg of ${shadows.filter(s => s.enabled).length} periods`;
        } else if (aggregatedShadowsData.length > 0) {
          // Use first shadow
          const shadowData = aggregatedShadowsData[0];
          const shadowDataWithValues = shadowData.data.map(d => ({
            date: d.date,
            value: getValue(d.numerator, d.denominator)
          }));
          const shadowPoint = shadowDataWithValues.find(p => {
            const diff = Math.abs(p.date.getTime() - dateTime);
            return diff < 24 * 60 * 60 * 1000;
          });
          targetValue = shadowPoint?.value;
          targetLabel = shadowData.shadow.label;
        }
      }
      break;
    }

    case 'goal': {
      if (!goals || goals.length === 0) return null;

      const goalsData = generateGoalsData(seriesData, goals);
      const enabledGoals = goalsData.filter(gd => gd.goal.enabled);

      if (enabledGoals.length === 0) return null;

      const goalIndex = comparison.targetIndex !== undefined ? comparison.targetIndex : 0;
      if (goalIndex >= enabledGoals.length) return null;

      const goalData = enabledGoals[goalIndex];
      const goalDataWithValues = goalData.data.map(d => ({
        date: d.date,
        value: getValue(d.numerator, d.denominator)
      }));

      if (isFocusPeriodComparison && focusPeriod?.enabled && focusPeriod.startDate && focusPeriod.endDate) {
        // For focus period comparisons, calculate sum or average over the focus period range
        const focusGoalData = goalDataWithValues.filter(p =>
          p.date >= focusPeriod.startDate! && p.date <= focusPeriod.endDate!
        );
        if (focusGoalData.length > 0) {
          // For SUM mode: sum all goal values
          // For RATIO mode: calculate mean
          targetValue = displayMode === 'sum'
            ? focusGoalData.reduce((sum, p) => sum + p.value, 0)
            : focusGoalData.reduce((sum, p) => sum + p.value, 0) / focusGoalData.length;
        }
      } else {
        // For selection comparisons, find value at specific date
        if (goalData.goal.type === 'continuous' && goalDataWithValues.length === 2) {
          const startDate = goalDataWithValues[0].date;
          const endDate = goalDataWithValues[1].date;
          if (currentDate >= startDate && currentDate <= endDate) {
            targetValue = goalDataWithValues[0].value;
          }
        } else {
          const goalPoint = goalDataWithValues.find(p => {
            const diff = Math.abs(p.date.getTime() - dateTime);
            return diff < 24 * 60 * 60 * 1000;
          });
          targetValue = goalPoint?.value;
        }
      }

      targetLabel = goalData.goal.label;
      break;
    }

    case 'forecast': {
      if (!forecastConfig || !forecastConfig.enabled || !forecastSnapshot) return null;

      // Use forecast snapshot (only use pre-computed forecasts)
      const forecastValues = forecastSnapshot.values;

      if (isFocusPeriodComparison && focusPeriod?.enabled && focusPeriod.startDate && focusPeriod.endDate) {
        // For focus period comparisons, calculate sum or average over the focus period range
        const focusForecastData = forecastValues.filter(f => {
          const fDate = new Date(f.date);
          return fDate >= focusPeriod.startDate! && fDate <= focusPeriod.endDate!;
        });
        if (focusForecastData.length > 0) {
          // For SUM mode: sum all forecast values
          // For RATIO mode: calculate mean
          targetValue = displayMode === 'sum'
            ? focusForecastData.reduce((sum, f) => sum + f.value, 0)
            : focusForecastData.reduce((sum, f) => sum + f.value, 0) / focusForecastData.length;
        }
      } else {
        // For selection comparisons, find forecast value at the current date
        const forecastPoint = forecastValues.find(f => {
          const fDate = new Date(f.date);
          const diff = Math.abs(fDate.getTime() - dateTime);
          return diff < 24 * 60 * 60 * 1000; // 1 day tolerance
        });

        if (!forecastPoint) return null;
        targetValue = forecastPoint.value;
      }

      targetLabel = 'Forecast';
      break;
    }
  }

  if (targetValue === undefined) return null;

  const absoluteDifference = actualValue - targetValue;
  const percentDifference = (absoluteDifference / targetValue) * 100;

  return {
    comparisonId: comparison.id,
    absoluteDifference,
    percentDifference,
    targetValue,
    targetLabel
  };
}

/**
 * Calculate comparison results for all configured comparisons
 */
export function calculateComparisons(
  series: Series,
  currentDate: Date | null,
  selectionValue: number | undefined,
  focusPeriodMean: number | undefined,
  aggregationConfig: AggregationConfig | undefined,
  shadows: Shadow[] | undefined,
  averageShadows: boolean | undefined,
  goals: Goal[] | undefined,
  forecastConfig: ForecastConfig | undefined,
  forecastSnapshot: ForecastSnapshot | undefined,
  comparisons: ComparisonConfig[] | undefined,
  focusPeriod?: FocusPeriod,
  displayMode: DisplayMode = 'ratio'
): Map<string, ComparisonResult> {
  const results = new Map<string, ComparisonResult>();

  if (!comparisons || comparisons.length === 0 || !currentDate) {
    return results;
  }

  // Helper function to calculate value based on display mode
  const getValue = (numerator: number, denominator: number) => {
    return displayMode === 'sum' ? numerator : numerator / denominator;
  };

  // Prepare display data
  const dataWithValues = series.data.map(d => ({
    date: d.date,
    value: getValue(d.numerator, d.denominator)
  }));

  let displayData = dataWithValues;
  if (aggregationConfig?.enabled) {
    const aggregated = applyAggregation(series.data, aggregationConfig);
    displayData = aggregated.map(d => ({
      date: d.date,
      value: getValue(d.numerator, d.denominator)
    }));
  }

  const normalizedDate = normalizeSelectionDate(currentDate, aggregationConfig);

  // Calculate each comparison
  for (const comparison of comparisons) {
    if (!comparison.enabled) continue;

    const actualValue = comparison.periodType === 'selection' ? selectionValue : focusPeriodMean;
    if (actualValue === undefined) continue;

    const result = calculateComparison(
      comparison,
      actualValue,
      shadows,
      averageShadows,
      goals,
      forecastConfig,
      forecastSnapshot,
      displayData,
      aggregationConfig,
      normalizedDate,
      series.data,
      focusPeriod,
      displayMode
    );

    if (result) {
      results.set(comparison.id, result);
    }
  }

  return results;
}
