import type { AppState, MetricConfig, GlobalSettings } from '../types/appState';
import type { ForecastSnapshot } from '../types/forecast';

const APP_STATE_KEY = 'bialy-app-state';
const STATE_VERSION = 1;

interface SerializedAppState {
  version: number;
  metrics: MetricConfig[];
  globalSettings: GlobalSettings;
  viewMode: 'grid' | 'single-metric';
  expandedMetricId?: string;
  savedAt: string;
}

/**
 * Save app state to localStorage
 */
export function saveAppState(state: Partial<AppState>): void {
  try {
    const serialized: SerializedAppState = {
      version: STATE_VERSION,
      metrics: state.metrics || [],
      globalSettings: state.globalSettings || {
        aggregation: undefined,
        shadows: [],
        averageShadows: false,
        comparisons: []
      },
      viewMode: state.viewMode || 'grid',
      expandedMetricId: state.expandedMetricId,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(APP_STATE_KEY, JSON.stringify(serialized));
    console.log('App state saved to localStorage');
  } catch (error) {
    console.error('Failed to save app state to localStorage:', error);
  }
}

/**
 * Load app state from localStorage
 */
export function loadAppState(): Partial<AppState> | null {
  try {
    const stored = localStorage.getItem(APP_STATE_KEY);
    if (!stored) {
      return null;
    }

    const parsed: SerializedAppState = JSON.parse(stored);

    // Check version compatibility
    if (parsed.version !== STATE_VERSION) {
      console.warn('App state version mismatch, ignoring saved state');
      return null;
    }

    // Deserialize dates in global settings
    const globalSettings = deserializeGlobalSettings(parsed.globalSettings);

    // Deserialize dates in metrics (series data, forecast snapshots, etc.)
    const metrics = parsed.metrics.map(deserializeMetric);

    return {
      metrics,
      globalSettings,
      viewMode: parsed.viewMode,
      expandedMetricId: parsed.expandedMetricId
    };
  } catch (error) {
    console.error('Failed to load app state from localStorage:', error);
    return null;
  }
}

/**
 * Clear app state from localStorage
 */
export function clearAppState(): void {
  try {
    localStorage.removeItem(APP_STATE_KEY);
    console.log('App state cleared from localStorage');
  } catch (error) {
    console.error('Failed to clear app state from localStorage:', error);
  }
}

/**
 * Deserialize global settings (convert ISO strings back to Dates)
 */
function deserializeGlobalSettings(settings: GlobalSettings): GlobalSettings {
  const deserialized = { ...settings };

  // Deserialize focus period dates
  if (deserialized.focusPeriod?.startDate) {
    deserialized.focusPeriod.startDate = new Date(deserialized.focusPeriod.startDate);
  }
  if (deserialized.focusPeriod?.endDate) {
    deserialized.focusPeriod.endDate = new Date(deserialized.focusPeriod.endDate);
  }

  // Deserialize date range
  if (deserialized.dateRange?.startDate) {
    deserialized.dateRange.startDate = new Date(deserialized.dateRange.startDate);
  }
  if (deserialized.dateRange?.endDate) {
    deserialized.dateRange.endDate = new Date(deserialized.dateRange.endDate);
  }

  // Deserialize annotation dates
  if (deserialized.annotations) {
    // Old hardcoded colors to remove (migration to new pale purple defaults)
    const oldColors = ['#3b82f6', '#ef4444', '#fb923c', '#10b981', '#8b5cf6'];

    deserialized.annotations = deserialized.annotations.map(annotation => {
      const updated = {
        ...annotation,
        date: annotation.date ? new Date(annotation.date) : undefined,
        startDate: annotation.startDate ? new Date(annotation.startDate) : undefined,
        endDate: annotation.endDate ? new Date(annotation.endDate) : undefined
      };

      // Remove old hardcoded colors so new defaults apply
      if (updated.color && oldColors.includes(updated.color)) {
        delete updated.color;
      }

      return updated;
    });
  }

  return deserialized;
}

/**
 * Deserialize a metric (convert ISO strings back to Dates)
 */
function deserializeMetric(metric: MetricConfig): MetricConfig {
  const deserialized = { ...metric };

  // Deserialize series data points
  if (deserialized.series?.data) {
    deserialized.series.data = deserialized.series.data.map(point => ({
      ...point,
      date: new Date(point.date)
    }));
  }

  // Deserialize forecast config dates
  if (deserialized.forecast?.startDate) {
    deserialized.forecast.startDate = new Date(deserialized.forecast.startDate);
  }

  // Deserialize forecast snapshot
  if (deserialized.forecastSnapshot) {
    deserialized.forecastSnapshot = deserializeForecastSnapshot(deserialized.forecastSnapshot);
  }

  // Deserialize goal dates
  if (deserialized.goals) {
    deserialized.goals = deserialized.goals.map(goal => ({
      ...goal,
      startDate: goal.startDate ? new Date(goal.startDate) : undefined,
      endDate: goal.endDate ? new Date(goal.endDate) : undefined
    }));
  }

  // Deserialize annotation dates (metric-specific)
  if (deserialized.annotations) {
    // Old hardcoded colors to remove (migration to new pale purple defaults)
    const oldColors = ['#3b82f6', '#ef4444', '#fb923c', '#10b981', '#8b5cf6'];

    deserialized.annotations = deserialized.annotations.map(annotation => {
      const updated = {
        ...annotation,
        date: annotation.date ? new Date(annotation.date) : undefined,
        startDate: annotation.startDate ? new Date(annotation.startDate) : undefined,
        endDate: annotation.endDate ? new Date(annotation.endDate) : undefined
      };

      // Remove old hardcoded colors so new defaults apply
      if (updated.color && oldColors.includes(updated.color)) {
        delete updated.color;
      }

      return updated;
    });
  }

  return deserialized;
}

/**
 * Deserialize forecast snapshot (convert ISO strings back to Dates)
 */
function deserializeForecastSnapshot(snapshot: ForecastSnapshot): ForecastSnapshot {
  return {
    ...snapshot,
    generatedAt: snapshot.generatedAt, // Keep as string for now
    config: {
      ...snapshot.config,
      startDate: snapshot.config.startDate ? new Date(snapshot.config.startDate) : undefined
    },
    values: snapshot.values.map(point => ({
      date: point.date, // Keep as string in snapshot
      value: point.value
    }))
  };
}

/**
 * Create a forecast snapshot from a ForecastResult
 */
export function createForecastSnapshot(
  forecastResult: { forecast: Array<{ date: Date; value: number }>; confidenceIntervals?: { upper: number[]; lower: number[] }; parameters: { alpha: number; beta: number; gamma?: number }; method: 'simple' | 'double' | 'triple' },
  config: any
): ForecastSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    config: config,
    values: forecastResult.forecast.map(point => ({
      date: point.date.toISOString(),
      value: point.value
    })),
    confidenceIntervals: forecastResult.confidenceIntervals,
    parameters: forecastResult.parameters,
    method: forecastResult.method
  };
}

/**
 * Check if a forecast snapshot is still valid based on its config
 * Returns true if snapshot matches current config and isn't too old
 */
export function isForecastSnapshotValid(
  snapshot: ForecastSnapshot | undefined,
  currentConfig: any,
  maxAgeHours: number = 24
): boolean {
  if (!snapshot) return false;

  // Check age
  const generatedAt = new Date(snapshot.generatedAt);
  const ageMs = Date.now() - generatedAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours > maxAgeHours) {
    console.log(`Forecast snapshot is too old (${ageHours.toFixed(1)} hours)`);
    return false;
  }

  // Check if config matches (key parameters only)
  if (snapshot.config.horizon !== currentConfig.horizon) return false;
  if (snapshot.config.seasonal !== currentConfig.seasonal) return false;
  if (snapshot.config.type !== currentConfig.type) return false;
  if (snapshot.config.targetValue !== currentConfig.targetValue) return false;

  return true;
}
