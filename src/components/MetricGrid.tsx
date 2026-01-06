import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MetricRow } from './MetricRow';
import { ColumnResizeHandle } from './ColumnResizeHandle';
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
import { SelectionPeriodModal } from './SelectionPeriodModal';
import { AggregateControls } from './AggregateControls';
import { ShadowControls } from './ShadowControls';
import { RangeControls, type DateRange } from './RangeControls';
import { ComparisonControls } from './ComparisonControls';
import { AnnotationControls } from './AnnotationControls';
import { ForecastControls } from './ForecastControls';
import type { MetricConfig, GlobalSettings, ColumnKey } from '../types/appState';
import type { FocusPeriod } from '../types/focusPeriod';
import type { AggregationConfig } from '../utils/aggregation';
import type { Shadow } from '../types/shadow';
import type { ComparisonConfig } from '../types/comparison';
import type { Annotation } from '../types/annotation';
import type { ForecastConfig } from '../types/forecast';
import type { Goal } from '../types/goal';
import { calculateMetricRowValues, calculateComparisons } from '../utils/metricCalculations';
import { normalizeSelectionDate } from '../utils/aggregation';
import { calculateDateRange } from '../utils/dateRange';
import { updateComparisonLabelsForShadows } from '../utils/shadowLabels';

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
  onDateRangeChange: (range: DateRange) => void;
  onComparisonsChange: (comparisons: ComparisonConfig[]) => void;
  onForecastInclusionChange: (selectionIncludes: boolean, focusIncludes: boolean) => void;
  onAnnotationsChange: (annotations: Annotation[], annotationsEnabled: boolean) => void;
  onAddMetric: () => void;
  onClearAllMetrics: () => void;
}

const getColumnDefinitions = (comparisons?: ComparisonConfig[]) => {
  const baseColumns = [
    { key: 'groupIndex' as ColumnKey, label: '', sortable: true },
    { key: 'group' as ColumnKey, label: 'Group', sortable: true },
    { key: 'metricIndex' as ColumnKey, label: '', sortable: true },
    { key: 'name' as ColumnKey, label: 'Metric', sortable: true },
  ];

  const selectionColumns = [
    { key: 'selectionValue' as ColumnKey, label: 'Mean / Range', sortable: true },
  ];

  const focusColumns = [
    { key: 'focusMean' as ColumnKey, label: 'Mean / Range', sortable: true },
  ];

  // Add dynamic comparison columns
  const selectionComparisons = comparisons?.filter(c => c.enabled && c.periodType === 'selection').sort((a, b) => a.order - b.order) || [];
  const focusComparisons = comparisons?.filter(c => c.enabled && c.periodType === 'focus').sort((a, b) => a.order - b.order) || [];

  const selectionComparisonColumns = selectionComparisons.map(c => ({
    key: `comparison-${c.id}` as ColumnKey,
    label: c.label,
    sortable: true,
    comparisonId: c.id
  }));

  const focusComparisonColumns = focusComparisons.map(c => ({
    key: `comparison-${c.id}` as ColumnKey,
    label: c.label,
    sortable: true,
    comparisonId: c.id
  }));

  return [
    ...baseColumns,
    ...selectionColumns,
    ...selectionComparisonColumns,
    ...focusColumns,
    ...focusComparisonColumns
  ];
};

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
  onDateRangeChange,
  onComparisonsChange,
  onForecastInclusionChange,
  onAnnotationsChange,
  onAddMetric,
  onClearAllMetrics
}: MetricGridProps) {
  const [selectionDate, setSelectionDate] = useState<Date | null>(null); // Locked selection for calculations
  const [currentHoverDate, setCurrentHoverDate] = useState<Date | null>(null); // For chart hover only
  const [sortColumn, setSortColumn] = useState<ColumnKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [xDomain, setXDomain] = useState<[Date, Date] | null>(null);
  const [showSelectionPeriodModal, setShowSelectionPeriodModal] = useState(false);
  const [showFocusPeriodModal, setShowFocusPeriodModal] = useState(false);
  const [showAggregationModal, setShowAggregationModal] = useState(false);
  const [showShadowModal, setShowShadowModal] = useState(false);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [comparisonModalPeriodType, setComparisonModalPeriodType] = useState<'selection' | 'focus' | null>(null);
  const [showForecastAllModal, setShowForecastAllModal] = useState(false);
  const [forecastAllConfig, setForecastAllConfig] = useState<ForecastConfig | null>(null);
  const [showGoalsAllModal, setShowGoalsAllModal] = useState(false);
  const [goalsAllStartDate, setGoalsAllStartDate] = useState<Date | null>(null);
  const [goalsAllEndType, setGoalsAllEndType] = useState<'EOQ' | 'EOY'>('EOQ');
  const [goalsAllLiftPercent, setGoalsAllLiftPercent] = useState(10);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedMetricIds, setSelectedMetricIds] = useState<Set<string>>(new Set());
  const [isEditingGroupSet, setIsEditingGroupSet] = useState(false);
  const [groupSetInputValue, setGroupSetInputValue] = useState('');

  // Column widths for resizable columns
  const [columnWidths, setColumnWidths] = useState({
    dragHandle: 30,
    groupIndex: 20,
    group: 74,
    metricIndex: 20,
    name: 273,
    chart: 390,
    selectionMean: 100,
    focusMean: 100,
    comparison: 100
  });

  const selectionPeriodEditButtonRef = useRef<HTMLButtonElement>(null);
  const focusPeriodEditButtonRef = useRef<HTMLButtonElement>(null);
  const aggregationEditButtonRef = useRef<HTMLButtonElement>(null);
  const shadowEditButtonRef = useRef<HTMLButtonElement>(null);
  const annotationEditButtonRef = useRef<HTMLButtonElement>(null);
  const rangeEditButtonRef = useRef<HTMLButtonElement>(null);
  const comparisonEditButtonRef = useRef<HTMLButtonElement>(null);
  const groupSetInputRef = useRef<HTMLInputElement>(null);
  const aggregationPopupRef = useRef<HTMLDivElement>(null);
  const shadowPopupRef = useRef<HTMLDivElement>(null);
  const annotationPopupRef = useRef<HTMLDivElement>(null);
  const rangePopupRef = useRef<HTMLDivElement>(null);
  const comparisonPopupRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Update comparison labels when shadows change
  useEffect(() => {
    if (!globalSettings.shadows || globalSettings.shadows.length === 0) return;
    if (!globalSettings.comparisons || globalSettings.comparisons.length === 0) return;

    const updatedComparisons = updateComparisonLabelsForShadows(
      globalSettings.comparisons,
      globalSettings.shadows
    );

    // Only update if labels actually changed
    const hasChanged = updatedComparisons.some((comp, idx) =>
      comp.label !== globalSettings.comparisons?.[idx]?.label
    );

    if (hasChanged) {
      onComparisonsChange(updatedComparisons);
    }
  }, [globalSettings.shadows]); // Only watch shadows, not comparisons to avoid loops

  // Calculate initial x-domain from all metrics and set initial selection
  useEffect(() => {
    if (metrics.length === 0) return;

    const allDates: Date[] = [];
    metrics.forEach(m => {
      m.series.data.forEach(d => allDates.push(d.date));

      // Include forecast extent if forecast is enabled
      if (m.forecast?.enabled && m.forecast.horizon > 0) {
        const lastDataDate = m.series.data[m.series.data.length - 1]?.date;
        if (lastDataDate) {
          // Calculate forecast end date (horizon is in days)
          const forecastEndDate = new Date(lastDataDate);
          forecastEndDate.setDate(forecastEndDate.getDate() + m.forecast.horizon);
          allDates.push(forecastEndDate);
        }
      }
    });

    if (allDates.length > 0) {
      const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
      const dataExtent: [Date, Date] = [minDate, maxDate];

      // Apply date range filter if set
      const filteredRange = calculateDateRange(globalSettings.dateRange, dataExtent);
      if (filteredRange) {
        setXDomain(filteredRange);
      } else {
        setXDomain(dataExtent);
      }

      // Set initial selection to most recent date in the filtered range (locked)
      if (!selectionDate) {
        const mostRecentDate = filteredRange ? filteredRange[1] : maxDate;
        setSelectionDate(mostRecentDate);
      }
    }
  }, [metrics, selectionDate, globalSettings.dateRange]);

  // Close modals on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (aggregationPopupRef.current && !aggregationPopupRef.current.contains(event.target as Node)) {
        setShowAggregationModal(false);
      }
      if (shadowPopupRef.current && !shadowPopupRef.current.contains(event.target as Node)) {
        setShowShadowModal(false);
      }
      if (annotationPopupRef.current && !annotationPopupRef.current.contains(event.target as Node)) {
        setShowAnnotationModal(false);
      }
      if (rangePopupRef.current && !rangePopupRef.current.contains(event.target as Node)) {
        setShowRangeModal(false);
      }
      if (comparisonPopupRef.current && !comparisonPopupRef.current.contains(event.target as Node)) {
        setShowComparisonModal(false);
        setComparisonModalPeriodType(null);
      }
    };

    if (showAggregationModal || showShadowModal || showAnnotationModal || showRangeModal || showComparisonModal) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAggregationModal, showShadowModal, showAnnotationModal, showRangeModal, showComparisonModal]);

  // Note: Selection Period and Focus Period modals handle their own click-outside logic

  // Calculate row values for all metrics using locked selection date
  const metricsWithValues = useMemo(() => {
    return metrics.map(metric => {
      const baseValues = calculateMetricRowValues(
        metric.series,
        selectionDate,
        globalSettings.aggregation,
        globalSettings.shadows,
        globalSettings.averageShadows,
        metric.goals,
        globalSettings.focusPeriod,
        metric.forecast,
        metric.forecastSnapshot,
        globalSettings.selectionIncludesForecast
      );

      // Calculate dynamic comparisons
      const comparisons = calculateComparisons(
        metric.series,
        selectionDate,
        baseValues?.selectionValue,
        baseValues?.focusPeriodMean,
        globalSettings.aggregation,
        globalSettings.shadows,
        globalSettings.averageShadows,
        metric.goals,
        metric.forecast,
        metric.forecastSnapshot,
        globalSettings.comparisons,
        globalSettings.selectionIncludesForecast,
        globalSettings.focusIncludesForecast,
        globalSettings.focusPeriod
      );

      return {
        metric,
        values: {
          ...baseValues,
          comparisons
        }
      };
    });
  }, [metrics, selectionDate, globalSettings]);

  // Calculate min/max percentage values for gradient scaling (per comparison)
  const colorScaling = useMemo(() => {
    // Collect all unique comparison IDs
    const comparisonIds = new Set<string>();
    if (globalSettings.comparisons) {
      globalSettings.comparisons.forEach(c => {
        if (c.enabled) comparisonIds.add(c.id);
      });
    }

    // Build map of comparison ID -> percentage values
    const pctValuesByComparison = new Map<string, number[]>();
    comparisonIds.forEach(id => pctValuesByComparison.set(id, []));

    // Also keep legacy values for backward compatibility
    const legacyPctValues = {
      selectionVsShadow: [] as number[],
      selectionVsGoal: [] as number[],
      focusVsShadow: [] as number[],
      focusVsGoal: [] as number[]
    };

    metricsWithValues.forEach(({ values }) => {
      // Collect from dynamic comparisons
      if (values.comparisons) {
        values.comparisons.forEach((result, comparisonId) => {
          if (result.percentDifference !== undefined) {
            const arr = pctValuesByComparison.get(comparisonId);
            if (arr) arr.push(result.percentDifference);
          }
        });
      }

      // Collect legacy values
      if (values.selectionVsShadowPct !== undefined) {
        legacyPctValues.selectionVsShadow.push(values.selectionVsShadowPct);
      }
      if (values.selectionVsGoalPct !== undefined) {
        legacyPctValues.selectionVsGoal.push(values.selectionVsGoalPct);
      }
      if (values.focusPeriodVsShadowPct !== undefined) {
        legacyPctValues.focusVsShadow.push(values.focusPeriodVsShadowPct);
      }
      if (values.focusPeriodVsGoalPct !== undefined) {
        legacyPctValues.focusVsGoal.push(values.focusPeriodVsGoalPct);
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

    // Calculate scales for each comparison
    const comparisonScales = new Map<string, { max: number; min: number }>();
    pctValuesByComparison.forEach((values, comparisonId) => {
      comparisonScales.set(comparisonId, getMinMax(values));
    });

    // Calculate legacy scales
    const legacyScales = {
      selectionVsShadow: getMinMax(legacyPctValues.selectionVsShadow),
      selectionVsGoal: getMinMax(legacyPctValues.selectionVsGoal),
      focusVsShadow: getMinMax(legacyPctValues.focusVsShadow),
      focusVsGoal: getMinMax(legacyPctValues.focusVsGoal)
    };

    return {
      // Legacy structure for backward compatibility
      ...legacyScales,
      extremes: {
        selectionVsShadow: legacyScales.selectionVsShadow,
        selectionVsGoal: legacyScales.selectionVsGoal,
        focusVsShadow: legacyScales.focusVsShadow,
        focusVsGoal: legacyScales.focusVsGoal
      },
      // New dynamic comparison scales
      comparisonScales
    };
  }, [metricsWithValues, globalSettings.comparisons]);

  // Sort metrics
  const sortedMetrics = useMemo(() => {
    if (!sortColumn) return metricsWithValues;

    const sorted = [...metricsWithValues].sort((a, b) => {
      let aVal: number | string | undefined;
      let bVal: number | string | undefined;

      // Check if this is a dynamic comparison column
      if (sortColumn.startsWith('comparison-')) {
        const comparisonId = sortColumn.replace('comparison-', '');
        aVal = a.values.comparisons?.get(comparisonId)?.percentDifference;
        bVal = b.values.comparisons?.get(comparisonId)?.percentDifference;
      } else {
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
          case 'selectionVsShadowPct':
            aVal = a.values.selectionVsShadowPct;
            bVal = b.values.selectionVsShadowPct;
            break;
          case 'selectionVsGoalPct':
            aVal = a.values.selectionVsGoalPct;
            bVal = b.values.selectionVsGoalPct;
            break;
          case 'focusMean':
            aVal = a.values.focusPeriodMean;
            bVal = b.values.focusPeriodMean;
            break;
          case 'focusVsShadowPct':
            aVal = a.values.focusPeriodVsShadowPct;
            bVal = b.values.focusPeriodVsShadowPct;
            break;
          case 'focusVsGoalPct':
            aVal = a.values.focusPeriodVsGoalPct;
            bVal = b.values.focusPeriodVsGoalPct;
            break;
        }
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

  // Generate the selection label based on aggregation settings
  const getSelectionLabel = useMemo(() => {
    const agg = globalSettings.aggregation;

    if (!agg || !agg.enabled) {
      return 'Selection:';
    }

    if (agg.mode === 'groupBy') {
      switch (agg.groupByPeriod) {
        case 'week':
          return 'Week of:';
        case 'month':
          return 'Month of:';
        case 'quarter':
          return 'Quarter of:';
        case 'year':
          return 'Year:';
        default:
          return 'Selection:';
      }
    }

    if (agg.mode === 'smoothing') {
      const periodStr = `${agg.period}-${agg.unit}`;
      return `${periodStr} ending on:`;
    }

    return 'Selection:';
  }, [globalSettings.aggregation]);

  // Generate the range label based on date range settings
  const getRangeLabel = useMemo(() => {
    const range = globalSettings.dateRange;

    if (!range || range.preset === 'all') {
      return 'All Data';
    }

    if (range.preset === 'custom' && range.startDate && range.endDate) {
      const start = range.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const end = range.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${start} - ${end}`;
    }

    if (range.preset === 'QTD') {
      return 'Current Quarter';
    }

    if (range.preset === 'YTD') {
      return 'Current Year';
    }

    return 'Range';
  }, [globalSettings.dateRange]);

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

  const handleColumnResize = useCallback((columnKey: string, newWidth: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [columnKey]: newWidth
    }));
  }, []);

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

  // Get column definitions based on comparisons
  const columnDefinitions = getColumnDefinitions(globalSettings.comparisons);

  // Calculate dynamic grid template columns
  const selectionComparisons = globalSettings.comparisons?.filter(c => c.enabled && c.periodType === 'selection') || [];
  const focusComparisons = globalSettings.comparisons?.filter(c => c.enabled && c.periodType === 'focus') || [];

  const groupHeaderGridTemplate = [
    isEditMode ? `${columnWidths.dragHandle}px` : null,
    `${columnWidths.groupIndex}px`,  // Group index
    `${columnWidths.group}px`,  // Group name
    `${columnWidths.metricIndex}px`,  // Metric index
    `${columnWidths.name}px`, // Metric name
    `${columnWidths.chart}px`, // Chart
    `${columnWidths.selectionMean}px`, // Selection Mean/Range
    ...selectionComparisons.map(() => `${columnWidths.comparison}px`), // Selection comparisons
    `${columnWidths.focusMean}px`, // Focus Mean/Range
    ...focusComparisons.map(() => `${columnWidths.comparison}px`) // Focus comparisons
  ].filter(Boolean).join(' ');

  const columnHeaderGridTemplate = [
    isEditMode ? `${columnWidths.dragHandle}px` : null,
    `${columnWidths.groupIndex}px`,  // Group index
    `${columnWidths.group}px`,  // Group name
    `${columnWidths.metricIndex}px`,  // Metric index
    `${columnWidths.name}px`, // Metric name
    `${columnWidths.chart / 3}px`, // Chart column 1 (Aggregation)
    `${columnWidths.chart / 3}px`, // Chart column 2 (Shadow)
    `${columnWidths.chart / 3}px`, // Chart column 3 (Annotations)
    `${columnWidths.selectionMean}px`, // Selection Mean/Range
    ...selectionComparisons.map(() => `${columnWidths.comparison}px`), // Selection comparisons
    `${columnWidths.focusMean}px`, // Focus Mean/Range
    ...focusComparisons.map(() => `${columnWidths.comparison}px`) // Focus comparisons
  ].filter(Boolean).join(' ');

  return (
    <div className="w-full">
      {/* Column Headers - Sticky wrapper */}
      <div className="sticky top-0 bg-white border-b-2 border-gray-300 z-50 shadow-sm overflow-x-auto">
        <div className="w-full">
          {/* Group Headers Row */}
          <div className="grid py-1 border-b border-gray-200" style={{
            gridTemplateColumns: groupHeaderGridTemplate,
            minWidth: 'fit-content'
          }}>
          {/* Metrics label - Spans Drag Handle (if visible), Grp Idx, Group, Mtr Idx, and Name columns */}
          <div className="px-1.5 text-sm font-bold text-gray-800 border-r border-gray-300 flex items-center justify-between relative" style={{ gridColumn: isEditMode ? 'span 5' : 'span 4' }}>
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
              <button
                onClick={() => {
                  // Calculate default forecast config
                  const today = new Date();
                  const currentQuarter = Math.floor(today.getMonth() / 3);
                  const quarterStartDate = new Date(today.getFullYear(), currentQuarter * 3, 1);
                  const endOfQuarterMonth = (currentQuarter + 1) * 3 - 1;
                  const endOfQuarter = new Date(today.getFullYear(), endOfQuarterMonth + 1, 0);
                  const diffTime = endOfQuarter.getTime() - quarterStartDate.getTime();
                  const daysToEOQ = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                  setForecastAllConfig({
                    enabled: true,
                    startDate: quarterStartDate,
                    horizon: daysToEOQ,
                    seasonal: 'none',
                    showConfidenceIntervals: true,
                    confidenceLevel: 95,
                    type: 'auto'
                  });
                  setShowForecastAllModal(true);
                }}
                className="px-2 py-0.5 text-xs font-medium rounded border text-gray-600 bg-gray-100 border-gray-300 hover:bg-gray-200"
                title="Apply forecast to all metrics"
              >
                Forecast All
              </button>
              <button
                onClick={() => {
                  // Calculate default start date (first day of current quarter based on max date)
                  let maxDate = new Date();
                  if (dataExtent && dataExtent[1]) {
                    maxDate = dataExtent[1];
                  }
                  const currentQuarter = Math.floor(maxDate.getMonth() / 3);
                  const quarterStartDate = new Date(maxDate.getFullYear(), currentQuarter * 3, 1);

                  setGoalsAllStartDate(quarterStartDate);
                  setGoalsAllEndType('EOQ');
                  setGoalsAllLiftPercent(10);
                  setShowGoalsAllModal(true);
                }}
                className="px-2 py-0.5 text-xs font-medium rounded border text-gray-600 bg-gray-100 border-gray-300 hover:bg-gray-200"
                title="Set goals for all metrics"
              >
                Set Goals for All
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
            <ColumnResizeHandle
              columnKey="name"
              onResize={handleColumnResize}
              currentWidth={columnWidths.name}
              minWidth={100}
            />
          </div>
          {/* Range with Edit button */}
          <div className="px-1.5 text-sm font-bold text-gray-800 text-center border-r border-gray-300 flex items-center justify-center gap-1 relative">
            <span>{getRangeLabel}</span>
            <button
              ref={rangeEditButtonRef}
              onClick={() => setShowRangeModal(true)}
              className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
              title="Edit range"
            >
              Edit
            </button>
            <ColumnResizeHandle
              columnKey="chart"
              onResize={handleColumnResize}
              currentWidth={columnWidths.chart}
              minWidth={200}
            />
          </div>
          {/* Selection Group */}
          <div className="px-1.5 text-sm font-bold text-gray-800 text-center border-r border-gray-300 flex items-center justify-center gap-2 relative" style={{ gridColumn: `span ${1 + selectionComparisons.length}` }}>
            <span>
              {getSelectionLabel} {displaySelectionDate ? displaySelectionDate.toLocaleDateString() : '—'}
            </span>
            <button
              ref={comparisonEditButtonRef}
              onClick={() => {
                setComparisonModalPeriodType('selection');
                setShowComparisonModal(true);
              }}
              className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
              title="Manage comparisons"
            >
              Edit
            </button>
            <ColumnResizeHandle
              columnKey="selectionMean"
              onResize={handleColumnResize}
              currentWidth={columnWidths.selectionMean}
              minWidth={80}
            />
          </div>
          {/* Focus Period Group */}
          <div className="px-1.5 text-sm font-bold text-gray-800 text-center flex items-center justify-center gap-2 relative" style={{ gridColumn: `span ${1 + focusComparisons.length}` }}>
            <span>
              {globalSettings.focusPeriod?.enabled && globalSettings.focusPeriod.label
                ? globalSettings.focusPeriod.label
                : 'Focus Period'}
            </span>
            <button
              onClick={() => {
                setComparisonModalPeriodType('focus');
                setShowComparisonModal(true);
              }}
              className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
              title="Manage comparisons"
            >
              Edit
            </button>
            <ColumnResizeHandle
              columnKey="focusMean"
              onResize={handleColumnResize}
              currentWidth={columnWidths.focusMean}
              minWidth={80}
            />
          </div>
        </div>

        {/* Column Headers Row */}
        <div className="grid py-1" style={{
          gridTemplateColumns: columnHeaderGridTemplate,
          minWidth: 'fit-content'
        }}>
          {/* Drag Handle Header Placeholder */}
          {isEditMode && <div className="border-r border-gray-300"></div>}

          {/* Group Columns */}
          {columnDefinitions.slice(0, 3).map((col) => (
            <div
              key={col.key}
              className={`px-1.5 text-xs font-semibold text-gray-700 text-center border-r border-gray-300 ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''} flex items-center justify-center gap-2 relative`}
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
              {col.key === 'group' && (
                <ColumnResizeHandle
                  columnKey="group"
                  onResize={handleColumnResize}
                  currentWidth={columnWidths.group}
                  minWidth={50}
                />
              )}
            </div>
          ))}
          {/* Metric management buttons */}
          <div className="px-2 border-r border-gray-300 flex items-center gap-1 relative">
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
            <ColumnResizeHandle
              columnKey="name"
              onResize={handleColumnResize}
              currentWidth={columnWidths.name}
              minWidth={100}
            />
          </div>

          {/* Chart Column Sub-headers - these 3 columns share the chart area width equally */}
          {/* Aggregation with Edit button */}
          <div className="px-1.5 text-xs font-semibold text-gray-700 text-center flex items-center justify-center gap-1">
            <span>Aggregation</span>
            <button
              ref={aggregationEditButtonRef}
              onClick={() => {
                // Auto-select "group by" and "week" when opening aggregation modal
                onAggregationChange({
                  ...globalSettings.aggregation,
                  enabled: true,
                  mode: 'groupBy',
                  period: 7,
                  unit: 'days',
                  groupByPeriod: 'week'
                });
                setShowAggregationModal(true);
              }}
              className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
              title="Edit aggregation"
            >
              Edit
            </button>
          </div>

          {/* Shadow with Edit button */}
          <div className="px-1.5 text-xs font-semibold text-gray-700 text-center flex items-center justify-center gap-1">
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

          {/* Annotations with Edit button */}
          <div className="px-1.5 text-xs font-semibold text-gray-700 text-center border-r border-gray-300 flex items-center justify-center gap-1 relative">
            <span>Annotations</span>
            <button
              ref={annotationEditButtonRef}
              onClick={() => setShowAnnotationModal(true)}
              className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
              title="Edit annotations"
            >
              Edit
            </button>
            <ColumnResizeHandle
              columnKey="chart"
              onResize={handleColumnResize}
              currentWidth={columnWidths.chart}
              minWidth={200}
            />
          </div>

          {/* Dynamic column headers (Selection and Focus) */}
          {columnDefinitions.slice(4).map((col, index) => {
            // Calculate if this should have a right border (after last selection comparison, before focus period)
            const selectionCompCount = selectionComparisons.length + 1; // +1 for Mean/Range
            const shouldHaveBorder = index === selectionCompCount - 1;

            // Determine which resize handle to show
            const isSelectionMean = col.key === 'selectionValue';
            const isFocusMean = col.key === 'focusMean';

            return (
              <div
                key={col.key}
                className={`px-1.5 text-xs font-semibold text-gray-700 text-right whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''} ${shouldHaveBorder ? 'border-r border-gray-300' : ''} relative`}
                onClick={() => col.sortable && handleColumnHeaderClick(col.key)}
              >
                {col.label}
                {sortColumn === col.key && (
                  <span className="ml-1">{sortDirection === 'desc' ? '↓' : '↑'}</span>
                )}
                {isSelectionMean && (
                  <ColumnResizeHandle
                    columnKey="selectionMean"
                    onResize={handleColumnResize}
                    currentWidth={columnWidths.selectionMean}
                    minWidth={80}
                  />
                )}
                {isFocusMean && (
                  <ColumnResizeHandle
                    columnKey="focusMean"
                    onResize={handleColumnResize}
                    currentWidth={columnWidths.focusMean}
                    minWidth={80}
                  />
                )}
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {/* Metric Rows */}
      <div className="w-full overflow-x-auto">
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
                chartWidth={columnWidths.chart}
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
                columnWidths={columnWidths}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      </div>

      {/* Selection Period Popup */}
      {showSelectionPeriodModal && selectionDate && (
        <SelectionPeriodModal
          selectionDate={selectionDate}
          includesForecast={globalSettings.selectionIncludesForecast}
          dataExtent={dataExtent}
          onSelectionDateChange={setSelectionDate}
          onIncludesForecastChange={(includesForecast) => {
            onForecastInclusionChange(includesForecast, globalSettings.focusIncludesForecast || false);
          }}
          onClose={() => setShowSelectionPeriodModal(false)}
          anchorElement={selectionPeriodEditButtonRef.current || undefined}
        />
      )}

      {/* Focus Period Popup */}
      {showFocusPeriodModal && (
        <FocusPeriodModal
          focusPeriod={globalSettings.focusPeriod || { enabled: false }}
          includesForecast={globalSettings.focusIncludesForecast}
          dataExtent={dataExtent}
          onSave={onFocusPeriodChange}
          onIncludesForecastChange={(includesForecast) => {
            onForecastInclusionChange(globalSettings.selectionIncludesForecast || false, includesForecast);
          }}
          onClose={() => setShowFocusPeriodModal(false)}
          anchorElement={focusPeriodEditButtonRef.current || undefined}
        />
      )}

      {/* Aggregation Popup */}
      {showAggregationModal && (
        <div
          ref={aggregationPopupRef}
          className="fixed bg-white border border-gray-300 rounded-lg p-4 shadow-xl z-50"
          style={{
            top: aggregationEditButtonRef.current ? aggregationEditButtonRef.current.getBoundingClientRect().bottom + 5 : '50%',
            left: aggregationEditButtonRef.current ? aggregationEditButtonRef.current.getBoundingClientRect().left : '50%',
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
          className="fixed bg-white border border-gray-300 rounded-lg p-4 shadow-xl z-50"
          style={{
            top: shadowEditButtonRef.current ? shadowEditButtonRef.current.getBoundingClientRect().bottom + 5 : '50%',
            left: shadowEditButtonRef.current ? shadowEditButtonRef.current.getBoundingClientRect().left : '50%',
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

      {/* Annotation Popup */}
      {showAnnotationModal && (
        <div
          ref={annotationPopupRef}
          className="fixed bg-white border border-gray-300 rounded-lg p-4 shadow-xl z-50 max-h-[80vh] overflow-y-auto"
          style={{
            top: annotationEditButtonRef.current ? annotationEditButtonRef.current.getBoundingClientRect().bottom + 5 : '50%',
            left: annotationEditButtonRef.current ? annotationEditButtonRef.current.getBoundingClientRect().left : '50%',
            width: '400px'
          }}
        >
          <AnnotationControls
            annotations={globalSettings.annotations || []}
            onChange={(annotations) => onAnnotationsChange(annotations, globalSettings.annotationsEnabled || false)}
            enabled={globalSettings.annotationsEnabled || false}
            onEnabledChange={(enabled) => onAnnotationsChange(globalSettings.annotations || [], enabled)}
          />
          <button
            onClick={() => setShowAnnotationModal(false)}
            className="mt-3 w-full text-xs px-3 py-1.5 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      )}

      {/* Range Popup */}
      {showRangeModal && (
        <div
          ref={rangePopupRef}
          className="fixed bg-white border border-gray-300 rounded-lg p-4 shadow-xl z-50"
          style={{
            top: rangeEditButtonRef.current ? rangeEditButtonRef.current.getBoundingClientRect().bottom + 5 : '50%',
            left: rangeEditButtonRef.current ? rangeEditButtonRef.current.getBoundingClientRect().left : '50%',
            width: '320px'
          }}
        >
          <RangeControls
            range={globalSettings.dateRange || { preset: 'all' }}
            onChange={onDateRangeChange}
            dataExtent={dataExtent}
          />
          <button
            onClick={() => setShowRangeModal(false)}
            className="mt-3 w-full text-xs px-3 py-1.5 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      )}

      {/* Comparison Popup */}
      {showComparisonModal && (
        <div
          ref={comparisonPopupRef}
          className="fixed bg-white border border-gray-300 rounded-lg p-4 shadow-xl z-50"
          style={{
            top: comparisonEditButtonRef.current ? comparisonEditButtonRef.current.getBoundingClientRect().bottom + 5 : '50%',
            left: comparisonEditButtonRef.current ? comparisonEditButtonRef.current.getBoundingClientRect().left : '50%',
            width: '400px',
            maxHeight: '600px',
            overflowY: 'auto'
          }}
        >
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            Manage {comparisonModalPeriodType === 'selection' ? 'Selection' : comparisonModalPeriodType === 'focus' ? 'Focus Period' : ''} Comparisons
          </h3>
          <ComparisonControls
            comparisons={globalSettings.comparisons || []}
            shadows={globalSettings.shadows}
            goals={metrics.flatMap(m => m.goals || [])}
            onChange={onComparisonsChange}
            filterPeriodType={comparisonModalPeriodType || undefined}
            includesForecast={
              comparisonModalPeriodType === 'selection'
                ? globalSettings.selectionIncludesForecast
                : comparisonModalPeriodType === 'focus'
                ? globalSettings.focusIncludesForecast
                : false
            }
            onIncludesForecastChange={(includesForecast) => {
              if (comparisonModalPeriodType === 'selection') {
                onForecastInclusionChange(includesForecast, globalSettings.focusIncludesForecast || false);
              } else if (comparisonModalPeriodType === 'focus') {
                onForecastInclusionChange(globalSettings.selectionIncludesForecast || false, includesForecast);
              }
            }}
            focusPeriod={comparisonModalPeriodType === 'focus' ? globalSettings.focusPeriod : undefined}
            onFocusPeriodChange={comparisonModalPeriodType === 'focus' ? onFocusPeriodChange : undefined}
            dataExtent={dataExtent}
          />
          <button
            onClick={() => {
              setShowComparisonModal(false);
              setComparisonModalPeriodType(null);
            }}
            className="mt-3 w-full text-xs px-3 py-1.5 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      )}

      {/* Forecast All Modal */}
      {showForecastAllModal && forecastAllConfig && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowForecastAllModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Forecast All Metrics</h3>
            <ForecastControls
              config={forecastAllConfig}
              onChange={setForecastAllConfig}
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  // Apply forecast config to all metrics
                  metrics.forEach(metric => {
                    onMetricUpdate({
                      ...metric,
                      forecast: forecastAllConfig
                    });
                  });
                  setShowForecastAllModal(false);
                }}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add Forecasts
              </button>
              <button
                onClick={() => setShowForecastAllModal(false)}
                className="flex-1 px-4 py-2 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goals All Modal */}
      {showGoalsAllModal && goalsAllStartDate && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowGoalsAllModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Set Goals for All Metrics</h3>

            <div className="space-y-4">
              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start of Goal
                </label>
                <input
                  type="date"
                  value={goalsAllStartDate.toISOString().split('T')[0]}
                  onChange={(e) => setGoalsAllStartDate(new Date(e.target.value))}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded"
                />
              </div>

              {/* End Type (EOQ or EOY) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Finish Date
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setGoalsAllEndType('EOQ')}
                    className={`px-3 py-2 text-sm rounded transition-colors ${
                      goalsAllEndType === 'EOQ'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    End of Quarter
                  </button>
                  <button
                    onClick={() => setGoalsAllEndType('EOY')}
                    className={`px-3 py-2 text-sm rounded transition-colors ${
                      goalsAllEndType === 'EOY'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    End of Year
                  </button>
                </div>
              </div>

              {/* Lift Percentage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lift vs. Start
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={goalsAllLiftPercent}
                    onChange={(e) => setGoalsAllLiftPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-600">%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Goal will be {(1 + goalsAllLiftPercent / 100).toFixed(2)}x the value at start date
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => {
                  // Calculate end date based on type
                  const startYear = goalsAllStartDate.getFullYear();
                  const startMonth = goalsAllStartDate.getMonth();
                  let endDate: Date;

                  if (goalsAllEndType === 'EOQ') {
                    // Find which quarter the start date is in
                    const startQuarter = Math.floor(startMonth / 3);
                    // Calculate the last month of that quarter (2, 5, 8, or 11)
                    const endOfQuarterMonth = (startQuarter + 1) * 3 - 1;
                    // Get the last day of that month
                    endDate = new Date(startYear, endOfQuarterMonth + 1, 0);
                  } else {
                    // End of year - December 31
                    endDate = new Date(startYear, 11, 31);
                  }

                  // Apply goal settings to all metrics
                  metrics.forEach(metric => {
                    // Find value at start date (or closest point)
                    const sortedData = [...metric.series.data].sort((a, b) => a.date.getTime() - b.date.getTime());

                    const startPoint = sortedData.find(d => {
                      const diff = Math.abs(d.date.getTime() - goalsAllStartDate.getTime());
                      return diff < 24 * 60 * 60 * 1000; // 1 day tolerance
                    });

                    if (startPoint) {
                      const startValue = startPoint.numerator / startPoint.denominator;
                      const targetValue = startValue * (1 + goalsAllLiftPercent / 100);

                      const goal: Goal = {
                        id: crypto.randomUUID(),
                        enabled: true,
                        type: 'end-of-period',
                        label: `${goalsAllLiftPercent}% Lift (${goalsAllEndType})`,
                        startDate: new Date(goalsAllStartDate),
                        endDate: new Date(endDate),
                        endValue: targetValue
                      };

                      onMetricUpdate({
                        ...metric,
                        goals: [goal],
                        goalsEnabled: true
                      });
                    }
                  });
                  setShowGoalsAllModal(false);
                }}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Set Goals
              </button>
              <button
                onClick={() => setShowGoalsAllModal(false)}
                className="flex-1 px-4 py-2 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
