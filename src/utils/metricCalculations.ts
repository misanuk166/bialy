import type { Series } from '../types/series';
import type { AggregationConfig } from './aggregation';
import type { Shadow } from '../types/shadow';
import type { Goal } from '../types/goal';
import type { FocusPeriod } from '../types/focusPeriod';
import type { ForecastConfig, ForecastSnapshot } from '../types/forecast';
import type { MetricRowValues } from '../types/appState';
import type { ComparisonConfig, ComparisonResult } from '../types/comparison';
import { applyAggregation, normalizeSelectionDate } from './aggregation';
import { generateShadowsData, calculateShadowAverage } from './shadows';
import { generateGoalsData } from './goals';

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
  forecastSnapshot?: ForecastSnapshot
): MetricRowValues {
  if (!currentDate) return {};

  // Prepare data
  const dataWithValues = series.data.map(d => ({
    date: d.date,
    value: d.numerator / d.denominator
  }));

  // Calculate precision (currently unused but may be needed for future enhancements)
  // const dataPrecision = Math.max(...dataWithValues.slice(0, 100).map(d => getDecimalPrecision(d.value)));

  // Apply aggregation
  let displayData = dataWithValues;
  if (aggregationConfig?.enabled) {
    const aggregated = applyAggregation(series.data, aggregationConfig);
    displayData = aggregated.map(d => ({
      date: d.date,
      value: d.numerator / d.denominator
    }));
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
      periodStart = new Date(aggregatedPointDate);
      periodEnd = new Date(aggregatedPointDate);

      switch (aggregationConfig.groupByPeriod) {
        case 'week':
          periodStart.setDate(periodStart.getDate() - 6);
          break;
        case 'month':
          periodStart.setMonth(periodStart.getMonth(), 1);
          break;
        case 'quarter':
          const quarter = Math.floor(periodStart.getMonth() / 3);
          periodStart.setMonth(quarter * 3, 1);
          break;
        case 'year':
          periodStart.setMonth(0, 1);
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
      selectionRange = {
        min: Math.min(...values),
        max: Math.max(...values)
      };
    } else {
      // Fallback to aggregated value
      selectionValue = currentPoint.value;
    }
  } else if (isForecastPoint) {
    // No aggregation: just use the forecast point value
    selectionValue = currentPoint.value;
  } else if (aggregationConfig?.enabled) {
    // For aggregated data, calculate mean and range from all raw points in the aggregated period
    // Find the aggregated period boundaries
    const aggregatedPointDate = currentPoint.date;

    // Determine the period start based on aggregation mode
    let periodStart: Date;
    let periodEnd: Date = new Date(aggregatedPointDate);

    if (aggregationConfig.mode === 'groupBy') {
      // For group-by, the aggregated point represents a period
      // Use the normalized date as the period end and calculate start based on grouping
      periodStart = new Date(aggregatedPointDate);
      periodEnd = new Date(aggregatedPointDate);

      switch (aggregationConfig.groupByPeriod) {
        case 'week':
          periodStart.setDate(periodStart.getDate() - 6);
          break;
        case 'month':
          periodStart.setMonth(periodStart.getMonth(), 1);
          break;
        case 'quarter':
          const quarter = Math.floor(periodStart.getMonth() / 3);
          periodStart.setMonth(quarter * 3, 1);
          break;
        case 'year':
          periodStart.setMonth(0, 1);
          break;
      }
    } else {
      // For smoothing, use the window size
      periodStart = new Date(aggregatedPointDate);
      const periodDays = aggregationConfig.period;
      periodStart.setDate(periodStart.getDate() - periodDays + 1);
    }

    // Find all raw data points within this period
    const periodData = dataWithValues.filter(d =>
      d.date >= periodStart && d.date <= periodEnd
    );

    if (periodData.length > 0) {
      const values = periodData.map(d => d.value);
      selectionValue = values.reduce((sum, v) => sum + v, 0) / values.length;
      selectionRange = {
        min: Math.min(...values),
        max: Math.max(...values)
      };
    } else {
      selectionValue = currentPoint.value;
    }
  } else {
    // No aggregation: just use the point value
    selectionValue = currentPoint.value;
  }

  // Calculate shadow values
  let shadowValue: number | undefined;
  let shadowLabel: string | undefined;
  if (shadows && shadows.length > 0) {
    const shadowsData = generateShadowsData(series.data, shadows);
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
        value: d.numerator / d.denominator
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
        value: d.numerator / d.denominator
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

  // Calculate focus period values
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
      const values = focusData.map(d => d.value);
      focusPeriodMean = values.reduce((sum, v) => sum + v, 0) / values.length;
      focusPeriodRange = {
        min: Math.min(...values),
        max: Math.max(...values)
      };

      // Calculate shadow comparison for focus period
      if (shadowValue !== undefined) {
        focusPeriodVsShadowAbs = focusPeriodMean - shadowValue;
        focusPeriodVsShadowPct = (focusPeriodVsShadowAbs / shadowValue) * 100;
      }

      // Calculate goal comparison for focus period
      if (goalValue !== undefined) {
        focusPeriodVsGoalAbs = focusPeriodMean - goalValue;
        focusPeriodVsGoalPct = (focusPeriodVsGoalAbs / goalValue) * 100;
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
  displayData: Array<{ date: Date; value: number }>,
  aggregationConfig: AggregationConfig | undefined,
  currentDate: Date,
  seriesData: any
): ComparisonResult | null {
  const dateTime = currentDate.getTime();

  let targetValue: number | undefined;
  let targetLabel: string | undefined;

  // Calculate target value based on comparison type
  switch (comparison.type) {
    case 'shadow': {
      if (!shadows || shadows.length === 0) return null;

      const shadowsData = generateShadowsData(seriesData, shadows);
      const aggregatedShadowsData = aggregationConfig?.enabled
        ? shadowsData.map(sd => ({
            shadow: sd.shadow,
            data: applyAggregation(sd.data, aggregationConfig),
            color: sd.color
          }))
        : shadowsData;

      if (comparison.targetIndex !== undefined && comparison.targetIndex < aggregatedShadowsData.length) {
        // Use specific shadow
        const shadowData = aggregatedShadowsData[comparison.targetIndex];
        const shadowDataWithValues = shadowData.data.map(d => ({
          date: d.date,
          value: d.numerator / d.denominator
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
          value: d.numerator / d.denominator
        }));
        const shadowPoint = shadowDataWithValues.find(p => {
          const diff = Math.abs(p.date.getTime() - dateTime);
          return diff < 24 * 60 * 60 * 1000;
        });
        targetValue = shadowPoint?.value;
        targetLabel = shadowData.shadow.label;
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
        value: d.numerator / d.denominator
      }));

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

      targetLabel = goalData.goal.label;
      break;
    }

    case 'forecast': {
      if (!forecastConfig || !forecastConfig.enabled || !forecastSnapshot) return null;

      // Use forecast snapshot (only use pre-computed forecasts)
      const forecastValues = forecastSnapshot.values;

      // Find forecast value at the current date
      const forecastPoint = forecastValues.find(f => {
        const fDate = new Date(f.date);
        const diff = Math.abs(fDate.getTime() - dateTime);
        return diff < 24 * 60 * 60 * 1000; // 1 day tolerance
      });

      if (!forecastPoint) return null;

      targetValue = forecastPoint.value;
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
  selectionIncludesForecast?: boolean,
  focusIncludesForecast?: boolean
): Map<string, ComparisonResult> {
  const results = new Map<string, ComparisonResult>();

  if (!comparisons || comparisons.length === 0 || !currentDate) {
    return results;
  }

  // Prepare display data
  const dataWithValues = series.data.map(d => ({
    date: d.date,
    value: d.numerator / d.denominator
  }));

  let displayData = dataWithValues;
  if (aggregationConfig?.enabled) {
    const aggregated = applyAggregation(series.data, aggregationConfig);
    displayData = aggregated.map(d => ({
      date: d.date,
      value: d.numerator / d.denominator
    }));
  }

  const normalizedDate = normalizeSelectionDate(currentDate, aggregationConfig);

  // Calculate each comparison
  for (const comparison of comparisons) {
    if (!comparison.enabled) continue;

    // Skip forecast comparisons if not included for this period type
    if (comparison.type === 'forecast') {
      const includesForecast = comparison.periodType === 'selection'
        ? selectionIncludesForecast
        : focusIncludesForecast;
      if (!includesForecast) continue;
    }

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
      series.data
    );

    if (result) {
      results.set(comparison.id, result);
    }
  }

  return results;
}
