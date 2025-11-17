import { useState, useEffect, useMemo } from 'react';
import { MetricRow } from './MetricRow';
import { SharedXAxis } from './SharedXAxis';
import type { MetricConfig, GlobalSettings, ColumnKey } from '../types/appState';
import { calculateMetricRowValues } from '../utils/metricCalculations';

interface MetricGridProps {
  metrics: MetricConfig[];
  globalSettings: GlobalSettings;
  onMetricsReorder?: (metrics: MetricConfig[]) => void;
  onMetricUpdate: (metric: MetricConfig) => void;
  onMetricRemove: (metricId: string) => void;
  onMetricExpand: (metricId: string) => void;
}

const getColumnDefinitions = (shadowLabel?: string, goalLabel?: string) => [
  { key: 'selectionValue' as ColumnKey, label: 'Selection', sortable: true },
  { key: 'selectionPoint' as ColumnKey, label: 'Point', sortable: true },
  { key: 'selectionVsShadowAbs' as ColumnKey, label: shadowLabel ? `vs ${shadowLabel}` : 'vs Shadow', sortable: true },
  { key: 'selectionVsShadowPct' as ColumnKey, label: shadowLabel ? `vs ${shadowLabel} %` : 'vs Shadow %', sortable: true },
  { key: 'selectionVsGoalAbs' as ColumnKey, label: goalLabel ? `vs ${goalLabel}` : 'vs Goal', sortable: true },
  { key: 'selectionVsGoalPct' as ColumnKey, label: goalLabel ? `vs ${goalLabel} %` : 'vs Goal %', sortable: true },
  { key: 'focusMean' as ColumnKey, label: 'Focus Mean', sortable: true },
  { key: 'focusRange' as ColumnKey, label: 'Focus Range', sortable: false },
  { key: 'focusVsShadowAbs' as ColumnKey, label: shadowLabel ? `vs ${shadowLabel}` : 'vs Shadow', sortable: true },
  { key: 'focusVsShadowPct' as ColumnKey, label: shadowLabel ? `vs ${shadowLabel} %` : 'vs Shadow %', sortable: true },
  { key: 'focusVsGoalAbs' as ColumnKey, label: goalLabel ? `vs ${goalLabel}` : 'vs Goal', sortable: true },
  { key: 'focusVsGoalPct' as ColumnKey, label: goalLabel ? `vs ${goalLabel} %` : 'vs Goal %', sortable: true },
];

export function MetricGrid({
  metrics,
  globalSettings,
  onMetricUpdate,
  onMetricRemove,
  onMetricExpand
}: MetricGridProps) {
  const [currentHoverDate, setCurrentHoverDate] = useState<Date | null>(null);
  const [sortColumn, setSortColumn] = useState<ColumnKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [xDomain, setXDomain] = useState<[Date, Date] | null>(null);

  const chartWidth = 400;
  const marginLeft = 40;

  // Calculate initial x-domain from all metrics
  useEffect(() => {
    if (metrics.length === 0) return;

    const allDates: Date[] = [];
    metrics.forEach(m => {
      m.series.data.forEach(d => allDates.push(d.date));
    });

    if (allDates.length > 0) {
      const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
      setXDomain([minDate, maxDate]);

      // Set initial hover to most recent date
      setCurrentHoverDate(maxDate);
    }
  }, [metrics]);

  // Calculate row values for all metrics
  const metricsWithValues = useMemo(() => {
    return metrics.map(metric => ({
      metric,
      values: calculateMetricRowValues(
        metric.series,
        currentHoverDate,
        globalSettings.aggregation,
        globalSettings.shadows,
        globalSettings.averageShadows,
        metric.goals,
        globalSettings.focusPeriod
      )
    }));
  }, [metrics, currentHoverDate, globalSettings]);

  // Sort metrics
  const sortedMetrics = useMemo(() => {
    if (!sortColumn) return metricsWithValues;

    const sorted = [...metricsWithValues].sort((a, b) => {
      let aVal: number | undefined;
      let bVal: number | undefined;

      switch (sortColumn) {
        case 'selectionValue':
          aVal = a.values.selectionValue;
          bVal = b.values.selectionValue;
          break;
        case 'selectionPoint':
          aVal = a.values.selectionPointValue;
          bVal = b.values.selectionPointValue;
          break;
        case 'selectionVsShadowAbs':
          aVal = a.values.selectionVsShadowAbs;
          bVal = b.values.selectionVsShadowAbs;
          break;
        case 'selectionVsShadowPct':
          aVal = a.values.selectionVsShadowPct;
          bVal = b.values.selectionVsShadowPct;
          break;
        case 'selectionVsGoalAbs':
          aVal = a.values.selectionVsGoalAbs;
          bVal = b.values.selectionVsGoalAbs;
          break;
        case 'selectionVsGoalPct':
          aVal = a.values.selectionVsGoalPct;
          bVal = b.values.selectionVsGoalPct;
          break;
        case 'focusMean':
          aVal = a.values.focusPeriodMean;
          bVal = b.values.focusPeriodMean;
          break;
        case 'focusVsShadowAbs':
          aVal = a.values.focusPeriodVsShadowAbs;
          bVal = b.values.focusPeriodVsShadowAbs;
          break;
        case 'focusVsShadowPct':
          aVal = a.values.focusPeriodVsShadowPct;
          bVal = b.values.focusPeriodVsShadowPct;
          break;
        case 'focusVsGoalAbs':
          aVal = a.values.focusPeriodVsGoalAbs;
          bVal = b.values.focusPeriodVsGoalAbs;
          break;
        case 'focusVsGoalPct':
          aVal = a.values.focusPeriodVsGoalPct;
          bVal = b.values.focusPeriodVsGoalPct;
          break;
      }

      // Handle undefined values
      if (aVal === undefined && bVal === undefined) return 0;
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;

      const comparison = aVal - bVal;
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }, [metricsWithValues, sortColumn, sortDirection]);

  const handleColumnHeaderClick = (columnKey: ColumnKey) => {
    if (sortColumn === columnKey) {
      // Toggle direction or clear
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortColumn(null);
        setSortDirection('desc');
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('desc');
    }
  };

  if (!xDomain) return <div>Loading...</div>;

  // Get shadow and goal labels from first metric for column headers
  const shadowLabel = sortedMetrics.length > 0 ? sortedMetrics[0].values.shadowLabel : undefined;
  const goalLabel = sortedMetrics.length > 0 ? sortedMetrics[0].values.goalLabel : undefined;
  const columnDefinitions = getColumnDefinitions(shadowLabel, goalLabel);

  return (
    <div className="w-full overflow-x-auto">
      {/* Column Headers */}
      <div className="sticky top-0 bg-white border-b-2 border-gray-300 z-10">
        <div className="grid gap-2 py-2" style={{
          gridTemplateColumns: '200px ' + chartWidth + 'px repeat(12, 80px)'
        }}>
          <div className="px-2 text-xs font-semibold text-gray-700">Metric</div>
          <div className="px-2 text-xs font-semibold text-gray-700">Chart</div>
          {columnDefinitions.map(col => (
            <div
              key={col.key}
              className={`px-2 text-xs font-semibold text-gray-700 text-center ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}`}
              onClick={() => col.sortable && handleColumnHeaderClick(col.key)}
            >
              {col.label}
              {sortColumn === col.key && (
                <span className="ml-1">{sortDirection === 'desc' ? '↓' : '↑'}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Metric Rows */}
      <div>
        {sortedMetrics.map(({ metric, values }) => (
          <MetricRow
            key={metric.id}
            metric={metric}
            globalSettings={globalSettings}
            rowValues={values}
            currentHoverDate={currentHoverDate || undefined}
            xDomain={xDomain}
            chartWidth={chartWidth}
            onMetricUpdate={onMetricUpdate}
            onExpand={() => onMetricExpand(metric.id)}
            onRemove={() => onMetricRemove(metric.id)}
            onHover={setCurrentHoverDate}
          />
        ))}
      </div>

      {/* Shared X-Axis */}
      <div className="border-t-2 border-gray-300 mt-2">
        <div style={{ marginLeft: '200px' }}>
          <SharedXAxis xDomain={xDomain} width={chartWidth} marginLeft={marginLeft} />
        </div>
      </div>

      {/* Current Hover Date Display */}
      {currentHoverDate && (
        <div className="text-center text-sm text-gray-600 mt-2">
          {currentHoverDate.toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
