export interface ForecastConfig {
  enabled: boolean;
  model: 'auto' | 'arima' | 'ets' | 'theta'; // StatsForecast model selection
  startDate?: Date; // Date at which the forecast begins (defaults to day after last data point)
  horizon: number; // Number of periods to forecast
  seasonLength?: number; // Number of periods in a season (e.g., 7 for weekly, 30 for monthly, 365 for yearly)
  showConfidenceIntervals: boolean;
  confidenceLevel: number; // e.g., 95 for 95% confidence
}

export interface ForecastPoint {
  date: Date;
  value: number;
}

export interface ForecastResult {
  forecast: ForecastPoint[];
  confidenceIntervals?: {
    upper: number[];
    lower: number[];
  };
  parameters: {
    alpha: number;
    beta: number;
    gamma?: number;
  };
  method: string; // Model name (e.g., 'AutoARIMA', 'AutoETS', 'simple', 'double', 'triple')
}

/**
 * Snapshot of a generated forecast for persistence
 * Stores pre-computed forecast values to avoid regeneration
 */
export interface ForecastSnapshot {
  generatedAt: string; // ISO date string
  config: ForecastConfig; // The config used to generate this snapshot
  values: Array<{
    date: string; // ISO date string
    value: number;
  }>;
  confidenceIntervals?: {
    upper: number[];
    lower: number[];
  };
  parameters: {
    alpha: number;
    beta: number;
    gamma?: number;
  };
  method: string; // Model name (e.g., 'AutoARIMA', 'AutoETS', 'simple', 'double', 'triple')
}
