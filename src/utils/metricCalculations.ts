import type { Series } from '../types/series';
import type { AggregationConfig } from './aggregation';
import type { Shadow } from '../types/shadow';
import type { Goal } from '../types/goal';
import type { FocusPeriod } from '../types/focusPeriod';
import type { MetricRowValues } from '../types/appState';
import { applyAggregation } from './aggregation';
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

  // Find current point
  const dateTime = currentDate.getTime();
  const currentPoint = displayData.find(p => {
    const diff = Math.abs(p.date.getTime() - dateTime);
    return diff < 24 * 60 * 60 * 1000; // 1 day tolerance
  });

  if (!currentPoint) return {};

  const selectionValue = currentPoint.value;

  // Find raw point if aggregation enabled
  let selectionPointValue: number | undefined;
  if (aggregationConfig?.enabled) {
    const rawPoint = dataWithValues.find(p => p.date.getTime() === currentPoint.date.getTime());
    selectionPointValue = rawPoint?.value;
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
    selectionPointValue,
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
