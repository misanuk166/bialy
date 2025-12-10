import type { Series } from './series';
import type { AggregationConfig } from '../utils/aggregation';
import type { Shadow } from './shadow';
import type { Goal } from './goal';
import type { ForecastConfig } from './forecast';
import type { FocusPeriod } from './focusPeriod';
import type { DateRange } from '../components/RangeControls';

/**
 * Global settings applied to all metrics
 */
export interface GlobalSettings {
  aggregation?: AggregationConfig;
  shadows?: Shadow[];
  averageShadows?: boolean;
  focusPeriod?: FocusPeriod;
  dateRange?: DateRange;
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
  selectionVsShadowAbs?: number;
  selectionVsShadowPct?: number;
  selectionVsGoalAbs?: number;
  selectionVsGoalPct?: number;

  // Focus period columns
  focusPeriodMean?: number;
  focusPeriodRange?: { min: number; max: number };
  focusPeriodVsShadowAbs?: number;
  focusPeriodVsShadowPct?: number;
  focusPeriodVsGoalAbs?: number;
  focusPeriodVsGoalPct?: number;

  // Shadow and goal metadata
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
