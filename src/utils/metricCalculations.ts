import type { Series } from '../types/series';
import type { AggregationConfig } from './aggregation';
import type { Shadow } from '../types/shadow';
import type { Goal } from '../types/goal';
import type { FocusPeriod } from '../types/focusPeriod';
import type { MetricRowValues } from '../types/appState';
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
  focusPeriod?: FocusPeriod
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

  // Normalize selection date to match aggregation period
  const normalizedDate = normalizeSelectionDate(currentDate, aggregationConfig);

  // Find current point
  const dateTime = normalizedDate.getTime();
  const currentPoint = displayData.find(p => {
    const diff = Math.abs(p.date.getTime() - dateTime);
    return diff < 24 * 60 * 60 * 1000; // 1 day tolerance
  });

  if (!currentPoint) return {};

  // Calculate selection mean and range
  let selectionValue: number;
  let selectionRange: { min: number; max: number } | undefined;

  if (aggregationConfig?.enabled) {
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

  return {
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
}
