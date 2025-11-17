import { useState, memo } from 'react';
import { CompactTimeSeriesChart } from './CompactTimeSeriesChart';
import { ColumnCell, RangeCell } from './ColumnCell';
import { GoalControls } from './GoalControls';
import { ForecastControls } from './ForecastControls';
import type { MetricConfig, GlobalSettings, MetricRowValues } from '../types/appState';

interface MetricRowProps {
  metric: MetricConfig;
  globalSettings: GlobalSettings;
  rowValues: MetricRowValues;
  selectionDate?: Date;
  currentHoverDate?: Date;
  xDomain: [Date, Date];
  chartWidth: number;
  precision?: number;
  onMetricUpdate: (metric: MetricConfig) => void;
  onExpand: () => void;
  onRemove: () => void;
  onHover: (date: Date | null) => void;
  onSelectionChange: (date: Date) => void;
}

export const MetricRow = memo(function MetricRow({
  metric,
  globalSettings,
  rowValues,
  selectionDate,
  currentHoverDate,
  xDomain,
  chartWidth,
  precision = 2,
  onMetricUpdate,
  onExpand,
  onRemove,
  onHover,
  onSelectionChange
}: MetricRowProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(metric.series.metadata.name);
  const [showGoalControls, setShowGoalControls] = useState(false);
  const [showForecastControls, setShowForecastControls] = useState(false);

  const handleNameSave = () => {
    if (editedName.trim()) {
      onMetricUpdate({
        ...metric,
        series: {
          ...metric.series,
          metadata: {
            ...metric.series.metadata,
            name: editedName.trim()
          }
        }
      });
    }
    setIsEditingName(false);
  };

  return (
    <div className="grid gap-2 py-2 border-b border-gray-200 hover:bg-gray-50" style={{
      gridTemplateColumns: '200px ' + (chartWidth / 2) + 'px ' + (chartWidth / 2) + 'px repeat(12, 80px)'
    }}>
      {/* Name & Description */}
      <div className="px-2 border-r border-gray-300">
        {isEditingName ? (
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSave();
              if (e.key === 'Escape') {
                setEditedName(metric.series.metadata.name);
                setIsEditingName(false);
              }
            }}
            autoFocus
            className="w-full text-sm font-medium border border-blue-500 rounded px-1"
          />
        ) : (
          <div
            className="text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100 rounded px-1"
            onDoubleClick={() => setIsEditingName(true)}
            title="Double-click to edit"
          >
            {metric.series.metadata.name}
          </div>
        )}
        <div className="text-xs text-gray-500 mt-1">{metric.series.metadata.description}</div>
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => setShowGoalControls(!showGoalControls)}
            className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
            title="Goals"
          >
            G
          </button>
          <button
            onClick={() => setShowForecastControls(!showForecastControls)}
            className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
            title="Forecast"
          >
            F
          </button>
          <button
            onClick={onExpand}
            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            title="Expand"
          >
            ⤢
          </button>
          <button
            onClick={onRemove}
            className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            title="Remove"
          >
            ×
          </button>
        </div>

        {/* Goal Controls Modal */}
        {showGoalControls && (
          <div className="absolute z-20 bg-white border border-gray-300 rounded-lg p-4 shadow-lg mt-2" style={{ width: '250px' }}>
            <GoalControls
              goals={metric.goals || []}
              onChange={(goals) => onMetricUpdate({ ...metric, goals })}
              enabled={metric.goalsEnabled || false}
              onEnabledChange={(enabled) => onMetricUpdate({ ...metric, goalsEnabled: enabled })}
            />
            <button
              onClick={() => setShowGoalControls(false)}
              className="mt-2 text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        )}

        {/* Forecast Controls Modal */}
        {showForecastControls && (
          <div className="absolute z-20 bg-white border border-gray-300 rounded-lg p-4 shadow-lg mt-2" style={{ width: '250px' }}>
            <ForecastControls
              config={metric.forecast || { enabled: false, horizon: 90, seasonal: 'none', showConfidenceIntervals: true, confidenceLevel: 95 }}
              onChange={(config) => onMetricUpdate({ ...metric, forecast: config })}
            />
            <button
              onClick={() => setShowForecastControls(false)}
              className="mt-2 text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Compact Chart - spans both Aggregation and Shadow columns */}
      <div className="border-r border-gray-300" style={{ gridColumn: 'span 2' }}>
        <CompactTimeSeriesChart
          series={metric.series}
          aggregationConfig={globalSettings.aggregation}
          shadows={globalSettings.shadows}
          averageShadows={globalSettings.averageShadows}
          forecastConfig={metric.forecast}
          focusPeriod={globalSettings.focusPeriod}
          xDomain={xDomain}
          width={chartWidth}
          selectionDate={selectionDate}
          currentHoverDate={currentHoverDate}
          onHover={onHover}
          onClick={onSelectionChange}
        />
      </div>

      {/* Selection Columns */}
      <ColumnCell value={rowValues.selectionValue} precision={precision} />
      <ColumnCell value={rowValues.selectionPointValue} precision={precision} isEmpty={!globalSettings.aggregation?.enabled} />
      <ColumnCell value={rowValues.selectionVsShadowAbs} precision={precision} colorCode showSign isEmpty={rowValues.selectionVsShadowAbs === undefined} />
      <ColumnCell value={rowValues.selectionVsShadowPct} precision={1} colorCode showSign isEmpty={rowValues.selectionVsShadowPct === undefined} />
      <ColumnCell value={rowValues.selectionVsGoalAbs} precision={precision} colorCode showSign isEmpty={rowValues.selectionVsGoalAbs === undefined} />
      <ColumnCell value={rowValues.selectionVsGoalPct} precision={1} colorCode showSign isEmpty={rowValues.selectionVsGoalPct === undefined} className="border-r border-gray-300" />

      {/* Focus Period Columns */}
      <ColumnCell value={rowValues.focusPeriodMean} precision={precision} isEmpty={rowValues.focusPeriodMean === undefined} />
      <RangeCell min={rowValues.focusPeriodRange?.min} max={rowValues.focusPeriodRange?.max} precision={precision} />
      <ColumnCell value={rowValues.focusPeriodVsShadowAbs} precision={precision} colorCode showSign isEmpty={rowValues.focusPeriodVsShadowAbs === undefined} />
      <ColumnCell value={rowValues.focusPeriodVsShadowPct} precision={1} colorCode showSign isEmpty={rowValues.focusPeriodVsShadowPct === undefined} />
      <ColumnCell value={rowValues.focusPeriodVsGoalAbs} precision={precision} colorCode showSign isEmpty={rowValues.focusPeriodVsGoalAbs === undefined} />
      <ColumnCell value={rowValues.focusPeriodVsGoalPct} precision={1} colorCode showSign isEmpty={rowValues.focusPeriodVsGoalPct === undefined} />
    </div>
  );
});
