import { useState, memo } from 'react';
import { CompactTimeSeriesChart } from './CompactTimeSeriesChart';
import { ColumnCell, RangeCell } from './ColumnCell';
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

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: (isEditMode ? '30px ' : '') + '20px 74px 20px 210px ' + (chartWidth / 3) + 'px ' + (chartWidth / 3) + 'px ' + (chartWidth / 3) + 'px repeat(12, 80px)',
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
                className="flex-1 text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100 rounded px-1 leading-tight"
                onDoubleClick={() => setIsEditingName(true)}
                title="Double-click to edit"
              >
                {metric.series.metadata.name}
              </div>
            )}

            {/* Edit Menu Button */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowActionMenu(!showActionMenu)}
                className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                title="Actions"
              >
                ⋮
              </button>

              {/* Action Menu Dropdown */}
              {showActionMenu && (
                <div className="absolute right-0 top-8 bg-white border border-gray-300 rounded shadow-lg z-30 min-w-[120px]">
                  <button
                    onClick={() => {
                      onExpand();
                      setShowActionMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <span>⤢</span>
                    <span>Expand</span>
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
          <div className="text-xs text-gray-500 mt-1 leading-tight">{metric.series.metadata.description}</div>

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

        {/* Compact Chart - spans Aggregation, Shadow, and Range columns */}
        <div className="border-r border-gray-300" style={{ gridColumn: 'span 3' }}>
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
        <ColumnCell
          value={rowValues.selectionVsShadowAbs}
          precision={precision}
          colorCode
          showSign
          isEmpty={rowValues.selectionVsShadowAbs === undefined}
          scaledColorPct={rowValues.selectionVsShadowPct}
          maxPositivePct={colorScaling?.selectionVsShadow.max}
          maxNegativePct={colorScaling?.selectionVsShadow.min}
          isExtreme={
            rowValues.selectionVsShadowPct !== undefined && colorScaling && (
              rowValues.selectionVsShadowPct === colorScaling.selectionVsShadow.max ||
              rowValues.selectionVsShadowPct === colorScaling.selectionVsShadow.min
            )
          }
        />
        <ColumnCell
          value={rowValues.selectionVsShadowPct}
          precision={0}
          colorCode
          showSign
          isEmpty={rowValues.selectionVsShadowPct === undefined}
          scaledColorPct={rowValues.selectionVsShadowPct}
          maxPositivePct={colorScaling?.selectionVsShadow.max}
          maxNegativePct={colorScaling?.selectionVsShadow.min}
          isPercentage={true}
          isExtreme={
            rowValues.selectionVsShadowPct !== undefined && colorScaling && (
              rowValues.selectionVsShadowPct === colorScaling.selectionVsShadow.max ||
              rowValues.selectionVsShadowPct === colorScaling.selectionVsShadow.min
            )
          }
        />
        <ColumnCell
          value={rowValues.selectionVsGoalAbs}
          precision={precision}
          colorCode
          showSign
          isEmpty={rowValues.selectionVsGoalAbs === undefined}
          scaledColorPct={rowValues.selectionVsGoalPct}
          maxPositivePct={colorScaling?.selectionVsGoal.max}
          maxNegativePct={colorScaling?.selectionVsGoal.min}
          isExtreme={
            rowValues.selectionVsGoalPct !== undefined && colorScaling && (
              rowValues.selectionVsGoalPct === colorScaling.selectionVsGoal.max ||
              rowValues.selectionVsGoalPct === colorScaling.selectionVsGoal.min
            )
          }
        />
        <ColumnCell
          value={rowValues.selectionVsGoalPct}
          precision={0}
          colorCode
          showSign
          isEmpty={rowValues.selectionVsGoalPct === undefined}
          className="border-r border-gray-300"
          scaledColorPct={rowValues.selectionVsGoalPct}
          maxPositivePct={colorScaling?.selectionVsGoal.max}
          maxNegativePct={colorScaling?.selectionVsGoal.min}
          isPercentage={true}
          isExtreme={
            rowValues.selectionVsGoalPct !== undefined && colorScaling && (
              rowValues.selectionVsGoalPct === colorScaling.selectionVsGoal.max ||
              rowValues.selectionVsGoalPct === colorScaling.selectionVsGoal.min
            )
          }
        />

        {/* Focus Period Columns */}
        <ColumnCell value={rowValues.focusPeriodMean} precision={precision} isEmpty={rowValues.focusPeriodMean === undefined} />
        <RangeCell min={rowValues.focusPeriodRange?.min} max={rowValues.focusPeriodRange?.max} precision={precision} />
        <ColumnCell
          value={rowValues.focusPeriodVsShadowAbs}
          precision={precision}
          colorCode
          showSign
          isEmpty={rowValues.focusPeriodVsShadowAbs === undefined}
          scaledColorPct={rowValues.focusPeriodVsShadowPct}
          maxPositivePct={colorScaling?.focusVsShadow.max}
          maxNegativePct={colorScaling?.focusVsShadow.min}
          isExtreme={
            rowValues.focusPeriodVsShadowPct !== undefined && colorScaling && (
              rowValues.focusPeriodVsShadowPct === colorScaling.focusVsShadow.max ||
              rowValues.focusPeriodVsShadowPct === colorScaling.focusVsShadow.min
            )
          }
        />
        <ColumnCell
          value={rowValues.focusPeriodVsShadowPct}
          precision={0}
          colorCode
          showSign
          isEmpty={rowValues.focusPeriodVsShadowPct === undefined}
          scaledColorPct={rowValues.focusPeriodVsShadowPct}
          maxPositivePct={colorScaling?.focusVsShadow.max}
          maxNegativePct={colorScaling?.focusVsShadow.min}
          isPercentage={true}
          isExtreme={
            rowValues.focusPeriodVsShadowPct !== undefined && colorScaling && (
              rowValues.focusPeriodVsShadowPct === colorScaling.focusVsShadow.max ||
              rowValues.focusPeriodVsShadowPct === colorScaling.focusVsShadow.min
            )
          }
        />
        <ColumnCell
          value={rowValues.focusPeriodVsGoalAbs}
          precision={precision}
          colorCode
          showSign
          isEmpty={rowValues.focusPeriodVsGoalAbs === undefined}
          scaledColorPct={rowValues.focusPeriodVsGoalPct}
          maxPositivePct={colorScaling?.focusVsGoal.max}
          maxNegativePct={colorScaling?.focusVsGoal.min}
          isExtreme={
            rowValues.focusPeriodVsGoalPct !== undefined && colorScaling && (
              rowValues.focusPeriodVsGoalPct === colorScaling.focusVsGoal.max ||
              rowValues.focusPeriodVsGoalPct === colorScaling.focusVsGoal.min
            )
          }
        />
        <ColumnCell
          value={rowValues.focusPeriodVsGoalPct}
          precision={0}
          colorCode
          showSign
          isEmpty={rowValues.focusPeriodVsGoalPct === undefined}
          scaledColorPct={rowValues.focusPeriodVsGoalPct}
          maxPositivePct={colorScaling?.focusVsGoal.max}
          maxNegativePct={colorScaling?.focusVsGoal.min}
          isPercentage={true}
          isExtreme={
            rowValues.focusPeriodVsGoalPct !== undefined && colorScaling && (
              rowValues.focusPeriodVsGoalPct === colorScaling.focusVsGoal.max ||
              rowValues.focusPeriodVsGoalPct === colorScaling.focusVsGoal.min
            )
          }
        />
    </div>
  );
});
