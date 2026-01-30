import type { Series } from './series';
import type { AggregationConfig } from '../utils/aggregation';
import type { Shadow } from './shadow';
import type { Goal } from './goal';
import type { ForecastConfig, ForecastSnapshot } from './forecast';
import type { FocusPeriod } from './focusPeriod';
import type { DateRange } from '../components/RangeControls';
import type { ComparisonConfig, ComparisonResult } from './comparison';
import type { Annotation } from './annotation';
import type { AnomalyConfig, AnomalySnapshot } from './anomaly';

/**
 * Column widths for resizable columns in MetricGrid
 */
export interface ColumnWidths {
  dragHandle: number;
  groupIndex: number;
  group: number;
  metricIndex: number;
  name: number;
  chart: number;
  selectionMean: number;
  comparison: number;
  focusMean: number;
}

/**
 * Global settings applied to all metrics
 */
export interface GlobalSettings {
  aggregation?: AggregationConfig;
  shadows?: Shadow[];
  shadowsEnabled?: boolean;
  averageShadows?: boolean;
  focusPeriod?: FocusPeriod;
  dateRange?: DateRange;
  comparisons?: ComparisonConfig[];
  annotations?: Annotation[]; // Global annotations displayed on all metrics
  annotationsEnabled?: boolean; // Master toggle for all annotations
  selectionDate?: Date; // Locked selection date for calculations (dashed line in charts)
  rowHeight?: number; // Row height for metric grid (default 60px)
  columnWidths?: ColumnWidths; // Column widths for resizable columns
}

/**
 * Display mode for metric values
 * - 'ratio': Show as percentage (numerator / denominator) - default
 * - 'sum': Show total numerator sum (useful for quantities like revenue, exits, etc.)
 */
export type DisplayMode = 'ratio' | 'sum';

/**
 * Individual metric configuration with local settings
 */
export interface MetricConfig {
  id: string;
  series: Series;
  order: number;
  displayMode?: DisplayMode; // How to display values (ratio or sum). Default: 'ratio'
  goals?: Goal[];
  goalsEnabled?: boolean;
  forecast?: ForecastConfig;
  forecastSnapshot?: ForecastSnapshot; // Cached forecast values
  anomalyDetection?: AnomalyConfig; // Anomaly detection configuration
  anomalySnapshot?: AnomalySnapshot; // Cached anomaly detection results
  annotations?: Annotation[]; // Metric-specific annotations (supplement global)
  annotationsEnabled?: boolean; // Toggle for metric-specific annotations
  group?: string;
  groupIndex?: number;
  metricIndex?: number;
}

/**
 * UI state for grid view
 */
export interface GridUIState {
  currentHoverDate?: Date;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  xDomain?: [Date, Date]; // Shared x-axis domain for all charts
}

/**
 * View mode
 */
export type ViewMode = 'grid' | 'single-metric';

/**
 * Complete application state
 */
export interface AppState {
  globalSettings: GlobalSettings;
  metrics: MetricConfig[];
  uiState: GridUIState;
  viewMode: ViewMode;
  expandedMetricId?: string;
}

/**
 * Column value types for sorting and display
 */
export interface MetricRowValues {
  // Selection columns
  selectionValue?: number;
  selectionRange?: { min: number; max: number };

  // Legacy comparison values (kept for backward compatibility during migration)
  selectionVsShadowAbs?: number;
  selectionVsShadowPct?: number;
  selectionVsGoalAbs?: number;
  selectionVsGoalPct?: number;

  // Focus period columns
  focusPeriodMean?: number;
  focusPeriodRange?: { min: number; max: number };

  // Legacy comparison values (kept for backward compatibility during migration)
  focusPeriodVsShadowAbs?: number;
  focusPeriodVsShadowPct?: number;
  focusPeriodVsGoalAbs?: number;
  focusPeriodVsGoalPct?: number;

  // Dynamic comparison results
  comparisons?: Map<string, ComparisonResult>;

  // Shadow and goal metadata (legacy)
  shadowValue?: number;
  shadowLabel?: string;
  goalValue?: number;
  goalLabel?: string;

  // Forecast indicator
  isForecast?: boolean;
}

/**
 * Column definitions for grid
 */
export type ColumnKey =
  | 'select'
  | 'name'
  | 'group'
  | 'groupIndex'
  | 'metricIndex'
  | 'selectionValue'
  | 'selectionPoint'
  | 'selectionVsShadowAbs'
  | 'selectionVsShadowPct'
  | 'selectionVsGoalAbs'
  | 'selectionVsGoalPct'
  | 'focusMean'
  | 'focusRange'
  | 'focusVsShadowAbs'
  | 'focusVsShadowPct'
  | 'focusVsGoalAbs'
  | 'focusVsGoalPct';

export interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  width: number;
  sortable: boolean;
}
