export interface ForecastConfig {
  enabled: boolean;
  type?: 'auto' | 'manual'; // Auto uses algorithms, manual uses target value
  startDate?: Date; // Date at which the forecast begins (defaults to day after last data point)
  horizon: number; // Number of periods to forecast
  targetValue?: number; // For manual forecast: the end target value
  interpolation?: 'linear' | 'exponential'; // How to interpolate between current and target
  alpha?: number; // Level smoothing parameter (0-1)
  beta?: number; // Trend smoothing parameter (0-1)
  gamma?: number; // Seasonal smoothing parameter (0-1)
  seasonLength?: number; // Number of periods in a season (e.g., 7 for weekly)
  seasonal: 'additive' | 'multiplicative' | 'none';
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
  method: 'simple' | 'double' | 'triple'; // Simple ES, Holt (double), Holt-Winters (triple)
}
