import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MetricRow } from './MetricRow';
import { SharedXAxis } from './SharedXAxis';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { FocusPeriodModal } from './FocusPeriodModal';
import { AggregateControls } from './AggregateControls';
import { ShadowControls } from './ShadowControls';
import type { MetricConfig, GlobalSettings, ColumnKey } from '../types/appState';
import type { FocusPeriod } from '../types/focusPeriod';
import type { AggregationConfig } from '../utils/aggregation';
import type { Shadow } from '../types/shadow';
import { calculateMetricRowValues } from '../utils/metricCalculations';
import { normalizeSelectionDate } from '../utils/aggregation';

interface MetricGridProps {
  metrics: MetricConfig[];
  globalSettings: GlobalSettings;
  dataExtent?: [Date, Date];
  onMetricsReorder?: (metrics: MetricConfig[]) => void;
  onMetricUpdate: (metric: MetricConfig) => void;
  onMetricRemove: (metricId: string) => void;
  onMetricExpand: (metricId: string) => void;
  onAggregationChange: (config: AggregationConfig) => void;
  onShadowsChange: (shadows: Shadow[], averageShadows: boolean) => void;
  onFocusPeriodChange: (focusPeriod: FocusPeriod) => void;
  onAddMetric: () => void;
  onClearAllMetrics: () => void;
}

const getColumnDefinitions = (shadowLabel?: string, goalLabel?: string) => [
  { key: 'groupIndex' as ColumnKey, label: '', sortable: true },
  { key: 'group' as ColumnKey, label: 'Group', sortable: true },
  { key: 'metricIndex' as ColumnKey, label: '', sortable: true },
  { key: 'name' as ColumnKey, label: 'Metric', sortable: true },
  { key: 'selectionValue' as ColumnKey, label: 'Selection', sortable: true },
  { key: 'selectionPoint' as ColumnKey, label: 'Point', sortable: true },
  { key: 'selectionVsShadowAbs' as ColumnKey, label: shadowLabel ? `vs ${shadowLabel}` : 'vs Shadow', sortable: true },
  { key: 'selectionVsShadowPct' as ColumnKey, label: shadowLabel ? `vs ${shadowLabel} %` : 'vs Shadow %', sortable: true },
  { key: 'selectionVsGoalAbs' as ColumnKey, label: 'vs Goal', sortable: true },
  { key: 'selectionVsGoalPct' as ColumnKey, label: 'vs Goal %', sortable: true },
  { key: 'focusMean' as ColumnKey, label: 'Focus Mean', sortable: true },
  { key: 'focusRange' as ColumnKey, label: 'Focus Range', sortable: false },
  { key: 'focusVsShadowAbs' as ColumnKey, label: shadowLabel ? `vs ${shadowLabel}` : 'vs Shadow', sortable: true },
  { key: 'focusVsShadowPct' as ColumnKey, label: shadowLabel ? `vs ${shadowLabel} %` : 'vs Shadow %', sortable: true },
  { key: 'focusVsGoalAbs' as ColumnKey, label: 'vs Goal', sortable: true },
  { key: 'focusVsGoalPct' as ColumnKey, label: 'vs Goal %', sortable: true },
];

export function MetricGrid({
  metrics,
  globalSettings,
  dataExtent,
  onMetricsReorder,
  onMetricUpdate,
  onMetricRemove,
  onMetricExpand,
  onAggregationChange,
  onShadowsChange,
  onFocusPeriodChange,
  onAddMetric,
  onClearAllMetrics
}: MetricGridProps) {
  const [selectionDate, setSelectionDate] = useState<Date | null>(null); // Locked selection for calculations
  const [currentHoverDate, setCurrentHoverDate] = useState<Date | null>(null); // For chart hover only
  const [isEditingSelection, setIsEditingSelection] = useState(false);
  const [sortColumn, setSortColumn] = useState<ColumnKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [xDomain, setXDomain] = useState<[Date, Date] | null>(null);
  const [showFocusPeriodModal, setShowFocusPeriodModal] = useState(false);
  const [showAggregationModal, setShowAggregationModal] = useState(false);
  const [showShadowModal, setShowShadowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedMetricIds, setSelectedMetricIds] = useState<Set<string>>(new Set());
  const [isEditingGroupSet, setIsEditingGroupSet] = useState(false);
  const [groupSetInputValue, setGroupSetInputValue] = useState('');

  const focusPeriodEditButtonRef = useRef<HTMLButtonElement>(null);
  const aggregationEditButtonRef = useRef<HTMLButtonElement>(null);
  const shadowEditButtonRef = useRef<HTMLButtonElement>(null);
  const groupSetInputRef = useRef<HTMLInputElement>(null);
  const aggregationPopupRef = useRef<HTMLDivElement>(null);
  const shadowPopupRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const chartWidth = 390;
  const marginLeft = 40;

  // Throttled hover handler to improve performance
  const handleHover = useCallback((date: Date | null) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setCurrentHoverDate(date);
    }, 16); // ~60fps
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Calculate initial x-domain from all metrics and set initial selection
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

      // Set initial selection to most recent date (locked)
      if (!selectionDate) {
        setSelectionDate(maxDate);
      }
    }
  }, [metrics, selectionDate]);

  // Close modals on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (aggregationPopupRef.current && !aggregationPopupRef.current.contains(event.target as Node)) {
        setShowAggregationModal(false);
      }
      if (shadowPopupRef.current && !shadowPopupRef.current.contains(event.target as Node)) {
        setShowShadowModal(false);
      }
    };

    if (showAggregationModal || showShadowModal) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAggregationModal, showShadowModal]);

  // Calculate row values for all metrics using locked selection date
  const metricsWithValues = useMemo(() => {
    return metrics.map(metric => ({
      metric,
      values: calculateMetricRowValues(
        metric.series,
        selectionDate,
        globalSettings.aggregation,
        globalSettings.shadows,
        globalSettings.averageShadows,
        metric.goals,
        globalSettings.focusPeriod
      )
    }));
  }, [metrics, selectionDate, globalSettings]);

  // Calculate min/max percentage values for gradient scaling
  const colorScaling = useMemo(() => {
    const pctValues = {
      selectionVsShadow: [] as number[],
      selectionVsGoal: [] as number[],
      focusVsShadow: [] as number[],
      focusVsGoal: [] as number[]
    };

    metricsWithValues.forEach(({ values }) => {
      if (values.selectionVsShadowPct !== undefined) {
        pctValues.selectionVsShadow.push(values.selectionVsShadowPct);
      }
      if (values.selectionVsGoalPct !== undefined) {
        pctValues.selectionVsGoal.push(values.selectionVsGoalPct);
      }
      if (values.focusPeriodVsShadowPct !== undefined) {
        pctValues.focusVsShadow.push(values.focusPeriodVsShadowPct);
      }
      if (values.focusPeriodVsGoalPct !== undefined) {
        pctValues.focusVsGoal.push(values.focusPeriodVsGoalPct);
      }
    });

    const getMinMax = (values: number[]) => {
      if (values.length === 0) return { max: 0, min: 0 };
      const positives = values.filter(v => v > 0);
      const negatives = values.filter(v => v < 0);
      return {
        max: positives.length > 0 ? Math.max(...positives) : 0,
        min: negatives.length > 0 ? Math.min(...negatives) : 0
      };
    };

    const scales = {
      selectionVsShadow: getMinMax(pctValues.selectionVsShadow),
      selectionVsGoal: getMinMax(pctValues.selectionVsGoal),
      focusVsShadow: getMinMax(pctValues.focusVsShadow),
      focusVsGoal: getMinMax(pctValues.focusVsGoal)
    };

    return {
      ...scales,
      // Include the actual extreme values for bold detection
      extremes: {
        selectionVsShadow: scales.selectionVsShadow,
        selectionVsGoal: scales.selectionVsGoal,
        focusVsShadow: scales.focusVsShadow,
        focusVsGoal: scales.focusVsGoal
      }
    };
  }, [metricsWithValues]);

  // Sort metrics
  const sortedMetrics = useMemo(() => {
    if (!sortColumn) return metricsWithValues;

    const sorted = [...metricsWithValues].sort((a, b) => {
      let aVal: number | string | undefined;
      let bVal: number | string | undefined;

      switch (sortColumn) {
        case 'group':
          aVal = a.metric.group || '';
          bVal = b.metric.group || '';
          break;
        case 'groupIndex':
          aVal = a.metric.groupIndex ?? Number.MAX_SAFE_INTEGER;
          bVal = b.metric.groupIndex ?? Number.MAX_SAFE_INTEGER;
          break;
        case 'metricIndex':
          aVal = a.metric.metricIndex ?? Number.MAX_SAFE_INTEGER;
          bVal = b.metric.metricIndex ?? Number.MAX_SAFE_INTEGER;
          break;
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

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }, [metricsWithValues, sortColumn, sortDirection]);

  // Calculate display date (normalized for Group By)
  const displaySelectionDate = useMemo(() => {
    if (!selectionDate) return null;
    return normalizeSelectionDate(selectionDate, globalSettings.aggregation);
  }, [selectionDate, globalSettings.aggregation]);

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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = metrics.findIndex((m) => m.id === active.id);
      const newIndex = metrics.findIndex((m) => m.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newMetrics = arrayMove(metrics, oldIndex, newIndex);

        // Auto-update groupIndex and metricIndex based on new order
        // Group metrics by their group name
        const groupMap = new Map<string | undefined, MetricConfig[]>();

        newMetrics.forEach(metric => {
          const groupKey = metric.group || undefined;
          if (!groupMap.has(groupKey)) {
            groupMap.set(groupKey, []);
          }
          groupMap.get(groupKey)!.push(metric);
        });

        // Assign groupIndex and metricIndex
        const groupNames = Array.from(groupMap.keys());
        const updatedMetrics = newMetrics.map(metric => {
          const groupKey = metric.group || undefined;
          const groupIndex = groupNames.indexOf(groupKey);
          const metricsInGroup = groupMap.get(groupKey)!;
          const metricIndex = metricsInGroup.indexOf(metric);

          return {
            ...metric,
            order: newMetrics.indexOf(metric),
            groupIndex: groupKey !== undefined ? groupIndex : undefined,
            metricIndex: metricIndex
          };
        });

        if (onMetricsReorder) {
          onMetricsReorder(updatedMetrics);
        }
      }
    }
  };

  const handleSelectMetric = (metricId: string, selected: boolean) => {
    const newSelected = new Set(selectedMetricIds);
    if (selected) {
      newSelected.add(metricId);
    } else {
      newSelected.delete(metricId);
    }
    setSelectedMetricIds(newSelected);
  };

  const handleSetGroup = () => {
    if (selectedMetricIds.size === 0) return;

    const groupName = groupSetInputValue.trim() || undefined;

    // Determine groupIndex
    let targetGroupIndex: number | undefined;
    let nextMetricIndex = 0;

    if (groupName) {
      // Check if group exists
      const existingGroupMetric = metrics.find(m => m.group === groupName && !selectedMetricIds.has(m.id));
      if (existingGroupMetric && existingGroupMetric.groupIndex !== undefined) {
        targetGroupIndex = existingGroupMetric.groupIndex;
        // Find max metricIndex in this group
        const groupMetrics = metrics.filter(m => m.group === groupName && !selectedMetricIds.has(m.id));
        const maxMetricIndex = Math.max(...groupMetrics.map(m => m.metricIndex || 0), -1);
        nextMetricIndex = maxMetricIndex + 1;
      } else {
        // New group
        const allGroupIndices = metrics
          .map(m => m.groupIndex)
          .filter((i): i is number => i !== undefined);
        targetGroupIndex = allGroupIndices.length > 0 ? Math.max(...allGroupIndices) + 1 : 0;
        nextMetricIndex = 0;
      }
    } else {
      // Ungrouping - maybe set groupIndex to undefined? 
      // Or keep them at the bottom?
      // For now, let's set groupIndex to undefined if ungrouping.
      targetGroupIndex = undefined;
    }

    const updatedMetrics = metrics.map(m => {
      if (selectedMetricIds.has(m.id)) {
        const update = {
          ...m,
          group: groupName,
          groupIndex: targetGroupIndex,
          metricIndex: targetGroupIndex !== undefined ? nextMetricIndex++ : m.metricIndex // Keep original metric index if ungrouped? Or reset?
        };
        return update;
      }
      return m;
    });

    if (onMetricsReorder) {
      onMetricsReorder(updatedMetrics);
    } else {
      updatedMetrics.forEach(m => {
        if (selectedMetricIds.has(m.id)) {
          onMetricUpdate(m);
        }
      });
    }

    setIsEditingGroupSet(false);
    setGroupSetInputValue('');
    setSelectedMetricIds(new Set());
  };

  const handleMoveGroup = (groupIndex: number | undefined, direction: 'up' | 'down') => {
    if (groupIndex === undefined) return;

    // Get all unique group indices sorted
    const uniqueIndices = Array.from(new Set(metrics.map(m => m.groupIndex).filter((i): i is number => i !== undefined))).sort((a, b) => a - b);
    const currentIndexPos = uniqueIndices.indexOf(groupIndex);

    if (currentIndexPos === -1) return;

    const targetIndexPos = direction === 'up' ? currentIndexPos - 1 : currentIndexPos + 1;
    if (targetIndexPos < 0 || targetIndexPos >= uniqueIndices.length) return;

    const targetGroupIndex = uniqueIndices[targetIndexPos];

    // Swap indices
    const updatedMetrics = metrics.map(m => {
      if (m.groupIndex === groupIndex) {
        return { ...m, groupIndex: targetGroupIndex };
      }
      if (m.groupIndex === targetGroupIndex) {
        return { ...m, groupIndex: groupIndex };
      }
      return m;
    });

    if (onMetricsReorder) onMetricsReorder(updatedMetrics);
  };

  const handleMoveMetric = (metricId: string, direction: 'up' | 'down') => {
    const metric = metrics.find(m => m.id === metricId);
    if (!metric || metric.metricIndex === undefined) return;

    // Find metrics in same group (or no group)
    const sameGroupMetrics = metrics.filter(m => m.groupIndex === metric.groupIndex);
    const sortedGroupMetrics = sameGroupMetrics.sort((a, b) => (a.metricIndex || 0) - (b.metricIndex || 0));

    const currentIndexPos = sortedGroupMetrics.findIndex(m => m.id === metricId);
    if (currentIndexPos === -1) return;

    const targetIndexPos = direction === 'up' ? currentIndexPos - 1 : currentIndexPos + 1;
    if (targetIndexPos < 0 || targetIndexPos >= sortedGroupMetrics.length) return;

    const targetMetric = sortedGroupMetrics[targetIndexPos];

    // Swap metric indices
    const updatedMetrics = metrics.map(m => {
      if (m.id === metricId) {
        return { ...m, metricIndex: targetMetric.metricIndex };
      }
      if (m.id === targetMetric.id) {
        return { ...m, metricIndex: metric.metricIndex };
      }
      return m;
    });

    if (onMetricsReorder) onMetricsReorder(updatedMetrics);
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
        {/* Group Headers Row */}
        <div className="grid py-1 border-b border-gray-200" style={{
          gridTemplateColumns: (isEditMode ? '30px ' : '') + '20px 74px 20px 210px ' + chartWidth + 'px repeat(12, 80px)',
          minWidth: 'fit-content'
        }}>
          {/* Metrics label - Spans Drag Handle (if visible), Grp Idx, Group, Mtr Idx, and Name columns */}
          <div className="px-1.5 text-sm font-bold text-gray-800 border-r border-gray-300 flex items-center justify-between" style={{ gridColumn: isEditMode ? 'span 5' : 'span 4' }}>
            <div className="flex items-center gap-2">
              <span>Metrics</span>
              <button
                onClick={() => {
                  setIsEditMode(!isEditMode);
                  if (isEditMode) {
                    setSelectedMetricIds(new Set()); // Clear selection on exit
                  }
                }}
                className={`px-2 py-0.5 text-xs font-medium rounded border transition-colors ${isEditMode
                  ? 'text-white bg-blue-600 border-blue-600 hover:bg-blue-700'
                  : 'text-gray-600 bg-gray-100 border-gray-300 hover:bg-gray-200'
                  }`}
              >
                {isEditMode ? 'Done' : 'Edit'}
              </button>
            </div>
            {selectedMetricIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-normal text-gray-600">
                  {selectedMetricIds.size} selected
                </span>
                {isEditingGroupSet ? (
                  <div className="flex items-center gap-1">
                    <input
                      ref={groupSetInputRef}
                      type="text"
                      value={groupSetInputValue}
                      onChange={(e) => setGroupSetInputValue(e.target.value)}
                      className="text-xs border border-blue-500 rounded px-1 w-24"
                      placeholder="Group Name"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSetGroup();
                        if (e.key === 'Escape') setIsEditingGroupSet(false);
                      }}
                    />
                    <button onClick={handleSetGroup} className="text-xs px-1 bg-green-500 text-white rounded">✓</button>
                    <button onClick={() => setIsEditingGroupSet(false)} className="text-xs px-1 bg-gray-400 text-white rounded">×</button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setIsEditingGroupSet(true);
                      setTimeout(() => groupSetInputRef.current?.focus(), 0);
                    }}
                    className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 border border-blue-300"
                  >
                    Set Group ({selectedMetricIds.size})
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Chart Group */}
          <div className="px-1.5 text-sm font-bold text-gray-800 text-center border-r border-gray-300">
            Chart
          </div>
          {/* Selection Group */}
          <div className="px-1.5 text-sm font-bold text-gray-800 text-center border-r border-gray-300" style={{ gridColumn: 'span 6' }}>
            {isEditingSelection ? (
              <div className="flex items-center justify-center gap-2">
                <input
                  type="date"
                  value={selectionDate ? selectionDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectionDate(new Date(e.target.value));
                    }
                  }}
                  onBlur={() => setIsEditingSelection(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      setIsEditingSelection(false);
                    }
                  }}
                  min={dataExtent ? dataExtent[0].toISOString().split('T')[0] : undefined}
                  max={dataExtent ? dataExtent[1].toISOString().split('T')[0] : undefined}
                  autoFocus
                  className="text-sm border border-blue-500 rounded px-2 py-1"
                />
              </div>
            ) : (
              <span
                onDoubleClick={() => setIsEditingSelection(true)}
                className="cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
                title="Double-click to edit selection date"
              >
                Selection: {displaySelectionDate ? displaySelectionDate.toLocaleDateString() : '—'}
              </span>
            )}
          </div>
          {/* Focus Period Group */}
          <div className="px-1.5 text-sm font-bold text-gray-800 text-center flex items-center justify-center gap-2" style={{ gridColumn: 'span 6' }}>
            <span>
              {globalSettings.focusPeriod?.enabled && globalSettings.focusPeriod.label
                ? globalSettings.focusPeriod.label
                : 'Focus Period'}
            </span>
            <button
              ref={focusPeriodEditButtonRef}
              onClick={() => setShowFocusPeriodModal(true)}
              className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
              title="Edit focus period"
            >
              Edit
            </button>
          </div>
        </div>

        {/* Column Headers Row */}
        <div className="grid py-1" style={{
          gridTemplateColumns: (isEditMode ? '30px ' : '') + '20px 74px 20px 210px ' + (chartWidth / 2) + 'px ' + (chartWidth / 2) + 'px repeat(12, 80px)',
          minWidth: 'fit-content'
        }}>
          {/* Drag Handle Header Placeholder */}
          {isEditMode && <div className="border-r border-gray-300"></div>}

          {/* Group Columns */}
          {columnDefinitions.slice(0, 3).map((col) => (
            <div
              key={col.key}
              className={`px-1.5 text-xs font-semibold text-gray-700 text-center border-r border-gray-300 ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''} flex items-center justify-center gap-2`}
              onClick={() => col.sortable && handleColumnHeaderClick(col.key)}
            >
              {col.key === 'group' && isEditMode && (
                <input
                  type="checkbox"
                  checked={selectedMetricIds.size > 0 && selectedMetricIds.size === metrics.length}
                  ref={el => {
                    if (el) el.indeterminate = selectedMetricIds.size > 0 && selectedMetricIds.size < metrics.length;
                  }}
                  onChange={(e) => {
                    e.stopPropagation(); // Prevent sorting when clicking checkbox
                    if (e.target.checked) {
                      setSelectedMetricIds(new Set(metrics.map(m => m.id)));
                    } else {
                      setSelectedMetricIds(new Set());
                    }
                  }}
                />
              )}
              {col.label}
              {sortColumn === col.key && (
                <span className="ml-1">{sortDirection === 'desc' ? '↓' : '↑'}</span>
              )}
            </div>
          ))}
          {/* Metric management buttons */}
          <div className="px-2 border-r border-gray-300 flex items-center gap-1">
            <button
              onClick={onAddMetric}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              title="Add Metric"
            >
              + Add
            </button>
            <button
              onClick={onClearAllMetrics}
              className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              title="Clear All Metrics"
            >
              Clear All
            </button>
          </div>

          {/* Aggregation with Edit button */}
          <div className="px-1.5 text-xs font-semibold text-gray-700 text-center flex items-center justify-center gap-1">
            <span>Aggregation</span>
            <button
              ref={aggregationEditButtonRef}
              onClick={() => setShowAggregationModal(true)}
              className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
              title="Edit aggregation"
            >
              Edit
            </button>
          </div>

          {/* Shadow with Edit button */}
          <div className="px-1.5 text-xs font-semibold text-gray-700 text-center border-r border-gray-300 flex items-center justify-center gap-1">
            <span>Shadow</span>
            <button
              ref={shadowEditButtonRef}
              onClick={() => setShowShadowModal(true)}
              className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
              title="Edit shadow"
            >
              Edit
            </button>
          </div>

          {/* Selection column header */}
          <div
            className="px-1.5 text-xs font-semibold text-gray-700 text-right cursor-pointer hover:bg-gray-100"
            onClick={() => handleColumnHeaderClick('selectionValue')}
          >
            Selection
            {sortColumn === 'selectionValue' && (
              <span className="ml-1">{sortDirection === 'desc' ? '↓' : '↑'}</span>
            )}
          </div>

          {columnDefinitions.slice(5).map((col, index) => (
            <div
              key={col.key}
              className={`px-1.5 text-xs font-semibold text-gray-700 text-right ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''} ${index === 4 ? 'border-r border-gray-300' : ''}`}
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedMetrics.map(m => m.metric.id)} // Assuming sortedMetrics is an array of { metric, values }
          strategy={verticalListSortingStrategy}
        >
          <div className="divide-y divide-gray-200 border-b border-gray-200">
            {sortedMetrics.map(({ metric, values }) => ( // Changed back to destructuring to match original data structure
              <MetricRow
                key={metric.id}
                metric={metric}
                globalSettings={globalSettings}
                rowValues={values} // Changed back to 'values' as per original structure
                selectionDate={selectionDate || undefined}
                currentHoverDate={currentHoverDate || undefined}
                xDomain={xDomain}
                chartWidth={chartWidth}
                onMetricUpdate={onMetricUpdate}
                onExpand={() => onMetricExpand(metric.id)}
                onRemove={() => onMetricRemove(metric.id)}
                onHover={handleHover}
                onSelectionChange={setSelectionDate}
                isSelected={selectedMetricIds.has(metric.id)}
                onSelect={(selected) => handleSelectMetric(metric.id, selected)}
                onMoveGroup={(direction) => handleMoveGroup(metric.groupIndex, direction)}
                onMoveMetric={(direction) => handleMoveMetric(metric.id, direction)}
                isEditMode={isEditMode}
                colorScaling={colorScaling}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Focus Period Popup */}
      {showFocusPeriodModal && (
        <FocusPeriodModal
          focusPeriod={globalSettings.focusPeriod || { enabled: false }}
          dataExtent={dataExtent}
          onSave={onFocusPeriodChange}
          onClose={() => setShowFocusPeriodModal(false)}
          anchorElement={focusPeriodEditButtonRef.current || undefined}
        />
      )}

      {/* Aggregation Popup */}
      {showAggregationModal && (
        <div
          ref={aggregationPopupRef}
          className="absolute bg-white border border-gray-300 rounded-lg p-4 shadow-xl z-50"
          style={{
            top: aggregationEditButtonRef.current ? aggregationEditButtonRef.current.offsetTop + aggregationEditButtonRef.current.offsetHeight + 5 : '50%',
            left: aggregationEditButtonRef.current ? aggregationEditButtonRef.current.offsetLeft : '50%',
            width: '300px'
          }}
        >
          <AggregateControls
            config={globalSettings.aggregation || { enabled: true, mode: 'smoothing', period: 7, unit: 'days', groupByPeriod: 'month' }}
            onChange={onAggregationChange}
          />
          <button
            onClick={() => setShowAggregationModal(false)}
            className="mt-3 w-full text-xs px-3 py-1.5 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      )}

      {/* Shadow Popup */}
      {showShadowModal && (
        <div
          ref={shadowPopupRef}
          className="absolute bg-white border border-gray-300 rounded-lg p-4 shadow-xl z-50"
          style={{
            top: shadowEditButtonRef.current ? shadowEditButtonRef.current.offsetTop + shadowEditButtonRef.current.offsetHeight + 5 : '50%',
            left: shadowEditButtonRef.current ? shadowEditButtonRef.current.offsetLeft : '50%',
            width: '320px'
          }}
        >
          <ShadowControls
            shadows={globalSettings.shadows || []}
            averageTogether={globalSettings.averageShadows || false}
            onChange={(shadows) => onShadowsChange(shadows, globalSettings.averageShadows || false)}
            onAverageTogetherChange={(enabled) => onShadowsChange(globalSettings.shadows || [], enabled)}
          />
          <button
            onClick={() => setShowShadowModal(false)}
            className="mt-3 w-full text-xs px-3 py-1.5 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
