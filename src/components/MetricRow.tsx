import { useState, memo } from 'react';
import { CompactTimeSeriesChart } from './CompactTimeSeriesChart';
import { ColumnCell, RangeCell, MeanRangeCell, PercentAbsCell } from './ColumnCell';
import { GoalControls } from './GoalControls';
import { ForecastControls } from './ForecastControls';
import type { MetricConfig, GlobalSettings, MetricRowValues } from '../types/appState';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ColorScaling {
  selectionVsShadow: { max: number; min: number };
  selectionVsGoal: { max: number; min: number };
  focusVsShadow: { max: number; min: number };
  focusVsGoal: { max: number; min: number };
  comparisonScales?: Map<string, { max: number; min: number }>;
}

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
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  onMoveGroup?: (direction: 'up' | 'down') => void;
  onMoveMetric?: (direction: 'up' | 'down') => void;
  isEditMode?: boolean;
  colorScaling?: ColorScaling;
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
  onSelectionChange,
  isSelected,
  onSelect,
  isEditMode = false,
  colorScaling
}: MetricRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: metric.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    position: 'relative' as const,
  };

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(metric.series.metadata.name);
  const [showGoalControls, setShowGoalControls] = useState(false);
  const [showForecastControls, setShowForecastControls] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);

  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editedGroup, setEditedGroup] = useState(metric.group || '');
  const [isChartExpanded, setIsChartExpanded] = useState(false);

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

  const handleGroupSave = () => {
    onMetricUpdate({
      ...metric,
      group: editedGroup.trim() || undefined
    });
    setIsEditingGroup(false);
  };

  // Calculate dynamic grid template columns based on comparisons
  const selectionComparisons = globalSettings.comparisons?.filter(c => c.enabled && c.periodType === 'selection') || [];
  const focusComparisons = globalSettings.comparisons?.filter(c => c.enabled && c.periodType === 'focus') || [];

  const gridTemplateColumns = [
    isEditMode ? '30px' : null,
    '20px',  // Group index
    '74px',  // Group name with checkbox
    '20px',  // Metric index
    '273px', // Metric name & description
    `${chartWidth / 3}px`,  // Chart column 1
    `${chartWidth / 3}px`,  // Chart column 2
    `${chartWidth / 3}px`,  // Chart column 3
    '100px', // Selection Mean/Range
    ...selectionComparisons.map(() => '100px'), // Dynamic selection comparisons
    '100px', // Focus Mean/Range
    ...focusComparisons.map(() => '100px') // Dynamic focus comparisons
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns,
        minWidth: 'fit-content'
      }}
      className={`py-1 border-b border-gray-200 hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
    >
        {/* Drag Handle */}
        {isEditMode && (
          <div
            className="flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 border-r border-gray-300"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </div>
        )}

        {/* Group Index (Compact) */}
        <div className="px-1 border-r border-gray-300 flex items-center justify-center bg-gray-50">
          <div className="text-xs text-gray-500 font-mono w-full text-center">
            {metric.groupIndex !== undefined ? metric.groupIndex + 1 : ''}
          </div>
        </div>

        {/* Group with Selection */}
        <div className="px-1.5 border-r border-gray-300 flex items-center gap-2">
          {isEditMode && (
            <input
              type="checkbox"
              checked={isSelected || false}
              onChange={(e) => onSelect && onSelect(e.target.checked)}
              className="flex-shrink-0"
            />
          )}
          <div className="flex-grow min-w-0 flex items-center justify-center">
            {isEditingGroup ? (
              <input
                type="text"
                value={editedGroup}
                onChange={(e) => setEditedGroup(e.target.value)}
                onBlur={handleGroupSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGroupSave();
                  if (e.key === 'Escape') {
                    setEditedGroup(metric.group || '');
                    setIsEditingGroup(false);
                  }
                }}
                autoFocus
                className="w-full text-xs border border-blue-500 rounded px-1"
              />
            ) : (
              <div
                className={`text-xs text-gray-600 rounded px-1 w-full text-center truncate ${isEditMode ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                onDoubleClick={() => isEditMode && setIsEditingGroup(true)}
                title={isEditMode ? (metric.group || "Double-click to set group") : (metric.group || '-')}
              >
                {metric.group || '-'}
              </div>
            )}
          </div>
        </div>

        {/* Metric Index (Compact) */}
        <div className="px-1 border-r border-gray-300 flex items-center justify-center bg-gray-50">
          <div className="text-xs text-gray-500 font-mono w-full text-center">
            {metric.metricIndex !== undefined ? metric.metricIndex + 1 : ''}
          </div>
        </div>
        {/* Name & Description */}
        <div className="px-1.5 border-r border-gray-300">
          <div className="flex items-center justify-between gap-2">
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
                className="flex-1 text-sm font-medium border border-blue-500 rounded px-1"
              />
            ) : (
              <div
                className="flex-1 text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100 rounded leading-tight text-left"
                onDoubleClick={() => setIsEditingName(true)}
                title="Double-click to edit"
              >
                {metric.series.metadata.name}
              </div>
            )}

            {/* Edit Menu Button */}
            <div className="relative flex-shrink-0 -mt-1">
              <button
                onClick={() => setShowActionMenu(!showActionMenu)}
                className="text-xs font-bold text-black hover:text-gray-700"
                title="Actions"
              >
                ⋮
              </button>

              {/* Action Menu Dropdown */}
              {showActionMenu && (
                <div className="absolute right-0 top-8 bg-white border border-gray-300 rounded shadow-lg z-30 min-w-[150px]">
                  <button
                    onClick={() => {
                      onExpand();
                      setShowActionMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <span>⤢</span>
                    <span>View Details</span>
                  </button>
                  <button
                    onClick={() => {
                      onRemove();
                      setShowActionMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-gray-200"
                  >
                    <span>×</span>
                    <span>Remove</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1 leading-tight text-left">{metric.series.metadata.description}</div>

          {/* Forecast and Goals buttons (shown when expanded) */}
          {isChartExpanded && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  setShowForecastControls(!showForecastControls);
                  if (!showForecastControls && !metric.forecast?.enabled) {
                    onMetricUpdate({
                      ...metric,
                      forecast: {
                        ...metric.forecast,
                        enabled: true,
                        horizon: 90,
                        seasonal: 'none',
                        showConfidenceIntervals: true,
                        confidenceLevel: 95
                      }
                    });
                  }
                }}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Forecast
              </button>
              <button
                onClick={() => {
                  setShowGoalControls(!showGoalControls);
                  if (!showGoalControls && !metric.goalsEnabled) {
                    onMetricUpdate({ ...metric, goalsEnabled: true });
                  }
                }}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Goals
              </button>
            </div>
          )}

          {/* Goal Controls Modal */}
          {showGoalControls && (
            <div className="absolute z-20 bg-white border border-gray-300 rounded-lg p-4 shadow-lg mt-2" style={{ width: '312px' }}>
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
            <div className="absolute z-20 bg-white border border-gray-300 rounded-lg p-4 shadow-lg mt-2" style={{ width: '312px' }}>
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

        {/* Compact Chart - spans Aggregation, Shadow, and Range columns */}
        <div className="border-r border-gray-300 relative my-[1px] mx-[4px]" style={{ gridColumn: 'span 3', height: isChartExpanded ? '400px' : '60px' }}>
          <CompactTimeSeriesChart
            series={metric.series}
            aggregationConfig={globalSettings.aggregation}
            shadows={globalSettings.shadows}
            averageShadows={globalSettings.averageShadows}
            forecastConfig={metric.forecast}
            focusPeriod={globalSettings.focusPeriod}
            goals={isChartExpanded && metric.goalsEnabled ? metric.goals : []}
            xDomain={xDomain}
            width={chartWidth - 8}
            height={isChartExpanded ? 380 : 58}
            showXAxis={isChartExpanded}
            selectionDate={selectionDate}
            currentHoverDate={currentHoverDate}
            onHover={onHover}
            onClick={onSelectionChange}
          />
          {/* Expand in Grid Icon */}
          <button
            onClick={() => setIsChartExpanded(!isChartExpanded)}
            className="absolute top-1 left-1 text-xs font-bold text-black bg-gray-100 hover:bg-gray-200 px-1 py-0.5 rounded"
            title={isChartExpanded ? "Collapse Chart" : "Expand in Grid"}
          >
            {isChartExpanded ? '⤡' : '⤢'}
          </button>
        </div>

        {/* Selection Columns */}
        <MeanRangeCell
          mean={rowValues.selectionValue}
          min={rowValues.selectionRange?.min}
          max={rowValues.selectionRange?.max}
          precision={precision}
        />

        {/* Dynamic Selection Comparisons */}
        {globalSettings.comparisons?.filter(c => c.enabled && c.periodType === 'selection').sort((a, b) => a.order - b.order).map(comparison => {
          const result = rowValues.comparisons?.get(comparison.id);
          const scaling = colorScaling?.comparisonScales?.get(comparison.id);

          return (
            <PercentAbsCell
              key={comparison.id}
              percentValue={result?.percentDifference}
              absValue={result?.absoluteDifference}
              precision={precision}
              colorCode
              showSign
              isEmpty={result === undefined}
              scaledColorPct={result?.percentDifference}
              maxPositivePct={scaling?.max}
              maxNegativePct={scaling?.min}
              isExtreme={
                result?.percentDifference !== undefined && scaling && (
                  result.percentDifference === scaling.max ||
                  result.percentDifference === scaling.min
                )
              }
            />
          );
        })}

        {/* Focus Period Columns */}
        <MeanRangeCell
          mean={rowValues.focusPeriodMean}
          min={rowValues.focusPeriodRange?.min}
          max={rowValues.focusPeriodRange?.max}
          precision={precision}
        />

        {/* Dynamic Focus Comparisons */}
        {globalSettings.comparisons?.filter(c => c.enabled && c.periodType === 'focus').sort((a, b) => a.order - b.order).map(comparison => {
          const result = rowValues.comparisons?.get(comparison.id);
          const scaling = colorScaling?.comparisonScales?.get(comparison.id);

          return (
            <PercentAbsCell
              key={comparison.id}
              percentValue={result?.percentDifference}
              absValue={result?.absoluteDifference}
              precision={precision}
              colorCode
              showSign
              isEmpty={result === undefined}
              scaledColorPct={result?.percentDifference}
              maxPositivePct={scaling?.max}
              maxNegativePct={scaling?.min}
              isExtreme={
                result?.percentDifference !== undefined && scaling && (
                  result.percentDifference === scaling.max ||
                  result.percentDifference === scaling.min
                )
              }
            />
          );
        })}
    </div>
  );
});
