import type { Series } from './series';
import type { AggregationConfig } from '../utils/aggregation';
import type { Shadow } from './shadow';
import type { Goal } from './goal';
import type { ForecastConfig, ForecastSnapshot } from './forecast';
import type { FocusPeriod } from './focusPeriod';
import type { DateRange } from '../components/RangeControls';
import type { ComparisonConfig, ComparisonResult } from './comparison';
import type { Annotation } from './annotation';

/**
 * Global settings applied to all metrics
 */
export interface GlobalSettings {
  aggregation?: AggregationConfig;
  shadows?: Shadow[];
  averageShadows?: boolean;
  focusPeriod?: FocusPeriod;
  dateRange?: DateRange;
  comparisons?: ComparisonConfig[];
  selectionIncludesForecast?: boolean;
  focusIncludesForecast?: boolean;
  annotations?: Annotation[]; // Global annotations displayed on all metrics
  annotationsEnabled?: boolean; // Master toggle for all annotations
}

/**
 * Individual metric configuration with local settings
 */
export interface MetricConfig {
  id: string;
  series: Series;
  order: number;
  goals?: Goal[];
  goalsEnabled?: boolean;
  forecast?: ForecastConfig;
  forecastSnapshot?: ForecastSnapshot; // Cached forecast values
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
