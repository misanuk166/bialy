import type { ForecastConfig, ForecastResult, ForecastPoint } from '../types/forecast';
import { addDays } from 'date-fns';

/**
 * Simple Exponential Smoothing
 * Best for data with no trend or seasonality
 */
function simpleExponentialSmoothing(
  values: number[],
  alpha: number,
  horizon: number
): number[] {
  const smoothed: number[] = [values[0]];

  // Smooth historical data
  for (let i = 1; i < values.length; i++) {
    smoothed[i] = alpha * values[i] + (1 - alpha) * smoothed[i - 1];
  }

  // Forecast future values (constant level)
  const lastSmoothed = smoothed[smoothed.length - 1];
  const forecast: number[] = Array(horizon).fill(lastSmoothed);

  return forecast;
}

/**
 * Double Exponential Smoothing (Holt's Linear Trend)
 * Best for data with trend but no seasonality
 */
function doubleExponentialSmoothing(
  values: number[],
  alpha: number,
  beta: number,
  horizon: number
): number[] {
  const n = values.length;
  const level: number[] = [values[0]];
  const trend: number[] = [values[1] - values[0]];

  // Initialize and smooth historical data
  for (let i = 1; i < n; i++) {
    const prevLevel = level[i - 1];
    const prevTrend = trend[i - 1];

    level[i] = alpha * values[i] + (1 - alpha) * (prevLevel + prevTrend);
    trend[i] = beta * (level[i] - prevLevel) + (1 - beta) * prevTrend;
  }

  // Forecast future values with damped trend
  const forecast: number[] = [];
  const lastLevel = level[n - 1];
  const lastTrend = trend[n - 1];

  // Estimate damping parameter based on historical trend variance
  const phi = estimateTrendDamping(trend);

  console.log(`Holt (Double ES): Estimated phi = ${phi.toFixed(3)} (based on trend stability)`);

  for (let h = 1; h <= horizon; h++) {
    // Apply dampening: trend effect decreases exponentially over time
    const dampedTrendSum = lastTrend * ((1 - Math.pow(phi, h)) / (1 - phi));
    forecast.push(lastLevel + dampedTrendSum);
  }

  return forecast;
}

/**
 * Estimate trend damping parameter based on historical trend variance
 * Returns phi value between 0.5 (high damping) and 0.95 (low damping)
 */
function estimateTrendDamping(trend: number[]): number {
  if (trend.length < 10) return 0.8; // Default if insufficient data

  // Calculate trend changes (how much trend varies period-to-period)
  const trendChanges: number[] = [];
  for (let i = 1; i < trend.length; i++) {
    trendChanges.push(Math.abs(trend[i] - trend[i - 1]));
  }

  // Calculate mean and standard deviation of trend changes
  const meanChange = trendChanges.reduce((a, b) => a + b, 0) / trendChanges.length;
  const variance = trendChanges.reduce((sum, val) => sum + Math.pow(val - meanChange, 2), 0) / trendChanges.length;
  const stdDev = Math.sqrt(variance);

  // Calculate coefficient of variation (CV) - relative variability
  const cv = stdDev / (Math.abs(meanChange) + 0.001); // Add small constant to avoid division by zero

  // Map CV to damping parameter
  // High CV (volatile trend) → low phi (more damping, trend dies quickly)
  // Low CV (stable trend) → high phi (less damping, trend persists longer)
  // CV typically ranges from 0 to 5+ for most time series
  const phi = Math.max(0.5, Math.min(0.95, 1 - (cv / 10)));

  return phi;
}

/**
 * Triple Exponential Smoothing (Holt-Winters)
 * Best for data with trend and seasonality
 */
function tripleExponentialSmoothing(
  values: number[],
  alpha: number,
  beta: number,
  gamma: number,
  seasonLength: number,
  seasonal: 'additive' | 'multiplicative',
  horizon: number
): number[] {
  const n = values.length;

  // Initialize components
  const level: number[] = new Array(n);
  const trend: number[] = new Array(n);
  const season: number[] = new Array(n + horizon);

  // Initialize level and trend
  level[0] = values[0] || 1; // Avoid zero
  trend[0] = seasonLength < n ? (values[seasonLength] - values[0]) / seasonLength : 0;

  // Initialize seasonal components
  if (seasonal === 'additive') {
    // Calculate initial seasonal indices (additive)
    for (let i = 0; i < seasonLength; i++) {
      season[i] = values[i] - level[0];
    }
  } else {
    // Calculate initial seasonal indices (multiplicative)
    const safeLevelInit = level[0] || 1; // Avoid division by zero
    for (let i = 0; i < seasonLength; i++) {
      season[i] = values[i] / safeLevelInit;
    }
  }

  // Apply Holt-Winters equations
  for (let i = 1; i < n; i++) {
    const prevLevel = level[i - 1];
    const prevTrend = trend[i - 1];

    // Only access previous season if we have enough history
    const prevSeason = i >= seasonLength ? season[i - seasonLength] : season[i % seasonLength];

    if (seasonal === 'additive') {
      level[i] = alpha * (values[i] - prevSeason) + (1 - alpha) * (prevLevel + prevTrend);
      trend[i] = beta * (level[i] - prevLevel) + (1 - beta) * prevTrend;
      season[i] = gamma * (values[i] - level[i]) + (1 - gamma) * prevSeason;
    } else {
      const safePrevSeason = prevSeason || 1; // Avoid division by zero
      const safeLevel = level[i - 1] || 1;
      level[i] = alpha * (values[i] / safePrevSeason) + (1 - alpha) * (prevLevel + prevTrend);
      trend[i] = beta * (level[i] - prevLevel) + (1 - beta) * prevTrend;
      const safeLevelCurrent = level[i] || 1;
      season[i] = gamma * (values[i] / safeLevelCurrent) + (1 - gamma) * prevSeason;
    }
  }

  // Forecast future values with damped trend
  const forecast: number[] = [];
  const lastLevel = level[n - 1];
  const lastTrend = trend[n - 1];

  // Estimate damping parameter based on historical trend variance
  const phi = estimateTrendDamping(trend);

  console.log(`Holt-Winters: Estimated phi = ${phi.toFixed(3)} (based on trend stability)`);

  for (let h = 1; h <= horizon; h++) {
    const seasonalIndex = season[n - seasonLength + ((h - 1) % seasonLength)];

    // Apply dampening: trend effect decreases exponentially over time
    const dampedTrendSum = lastTrend * ((1 - Math.pow(phi, h)) / (1 - phi));

    if (seasonal === 'additive') {
      forecast.push(lastLevel + dampedTrendSum + seasonalIndex);
    } else {
      forecast.push((lastLevel + dampedTrendSum) * seasonalIndex);
    }
  }

  return forecast;
}

/**
 * Optimize parameters using simple grid search
 * This is a simplified version - production might use gradient descent
 */
function optimizeParameters(
  _values: number[],
  _seasonLength?: number,
  seasonal?: 'additive' | 'multiplicative' | 'none'
): { alpha: number; beta: number; gamma?: number } {
  // Default parameters based on common practice
  const defaultAlpha = 0.3;
  const defaultBeta = 0.1;
  const defaultGamma = 0.1;

  // For MVP, we'll use default parameters
  // TODO: Implement grid search or gradient descent optimization
  return {
    alpha: defaultAlpha,
    beta: defaultBeta,
    gamma: seasonal !== 'none' ? defaultGamma : undefined
  };
}

/**
 * Calculate simple confidence intervals using residual standard deviation
 */
function calculateConfidenceIntervals(
  forecast: number[],
  values: number[],
  confidenceLevel: number
): { upper: number[]; lower: number[] } {
  // Calculate residuals from a simple forecast (naive: last value)
  const residuals: number[] = [];
  for (let i = 1; i < values.length; i++) {
    residuals.push(values[i] - values[i - 1]);
  }

  // Calculate standard deviation of residuals
  const mean = residuals.reduce((sum, r) => sum + r, 0) / residuals.length;
  const variance = residuals.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / residuals.length;
  const stdDev = Math.sqrt(variance);

  // Z-score for confidence level (approximation)
  const zScores: { [key: number]: number } = {
    90: 1.645,
    95: 1.96,
    99: 2.576
  };
  const z = zScores[confidenceLevel] || 1.96;

  // Calculate intervals (constant width - uncertainty doesn't grow with time)
  const upper: number[] = [];
  const lower: number[] = [];

  // Constant margin based on historical volatility
  const margin = z * stdDev;

  for (let i = 0; i < forecast.length; i++) {
    upper.push(forecast[i] + margin);
    lower.push(forecast[i] - margin);
  }

  return { upper, lower };
}

/**
 * Detect seasonality length automatically
 * Returns the most likely season length or undefined if no seasonality detected
 */
function detectSeasonality(values: number[]): number | undefined {
  // For MVP, we'll use a simple heuristic
  // TODO: Implement autocorrelation-based detection
  // Common seasonal patterns: [7, 12, 24, 30, 52, 365]

  if (values.length < 14) return undefined; // Need at least 2 seasons
  if (values.length >= 365) return 365; // Yearly
  if (values.length >= 52) return 52; // Weekly (if daily data)
  if (values.length >= 30) return 30; // Monthly
  if (values.length >= 12) return 12; // Monthly (if monthly data)
  if (values.length >= 7) return 7; // Weekly

  return undefined;
}

/**
 * Generate manual forecast with target value
 */
function manualForecast(
  startValue: number,
  targetValue: number,
  horizon: number,
  interpolation: 'linear' | 'exponential' = 'linear'
): number[] {
  const forecast: number[] = [];

  if (interpolation === 'linear') {
    // Linear interpolation
    const step = (targetValue - startValue) / horizon;
    for (let h = 1; h <= horizon; h++) {
      forecast.push(startValue + step * h);
    }
  } else {
    // Exponential interpolation (smoother curve)
    const ratio = targetValue / startValue;
    const growth = Math.pow(ratio, 1 / horizon);
    for (let h = 1; h <= horizon; h++) {
      forecast.push(startValue * Math.pow(growth, h));
    }
  }

  return forecast;
}

/**
 * Main forecasting function
 */
export function generateForecast(
  data: Array<{ date: Date; value: number }>,
  config: ForecastConfig
): ForecastResult | null {
  if (!config.enabled || data.length < 2) {
    return null;
  }

  const values = data.map(d => d.value);
  const dates = data.map(d => d.date);

  // Handle manual forecast
  if (config.type === 'manual' && config.targetValue !== undefined) {
    const currentValue = values[values.length - 1];
    const forecastValues = manualForecast(
      currentValue,
      config.targetValue,
      config.horizon,
      config.interpolation || 'linear'
    );

    // Validate forecast values
    const validForecastValues = forecastValues.filter(v => isFinite(v));

    if (validForecastValues.length === 0) {
      console.warn('Manual forecast generated all invalid values');
      return null;
    }

    // Generate forecast dates
    const lastDate = dates[dates.length - 1];
    const forecast: ForecastPoint[] = validForecastValues.map((value, i) => ({
      date: addDays(lastDate, i + 1),
      value
    }));

    // Calculate confidence intervals for manual forecast
    const confidenceIntervals = config.showConfidenceIntervals
      ? calculateConfidenceIntervals(validForecastValues, values, config.confidenceLevel)
      : undefined;

    return {
      forecast,
      confidenceIntervals,
      parameters: { alpha: 0, beta: 0 },
      method: 'simple' // Mark as simple for display purposes
    };
  }

  // Determine forecast method based on configuration
  let forecastValues: number[];
  let method: 'simple' | 'double' | 'triple';
  let seasonLength = config.seasonLength;

  // Auto-detect seasonality if not specified
  if (config.seasonal !== 'none' && !seasonLength) {
    seasonLength = detectSeasonality(values);
  }

  // Optimize parameters if not provided
  const params = {
    alpha: config.alpha ?? optimizeParameters(values, seasonLength, config.seasonal).alpha,
    beta: config.beta ?? optimizeParameters(values, seasonLength, config.seasonal).beta,
    gamma: config.gamma ?? optimizeParameters(values, seasonLength, config.seasonal).gamma
  };

  // Select appropriate method
  if (config.seasonal !== 'none' && seasonLength && seasonLength > 1 && values.length >= seasonLength * 2) {
    // Triple exponential smoothing (Holt-Winters)
    method = 'triple';
    forecastValues = tripleExponentialSmoothing(
      values,
      params.alpha,
      params.beta,
      params.gamma ?? 0.1,
      seasonLength,
      config.seasonal,
      config.horizon
    );
  } else if (values.length >= 4) {
    // Double exponential smoothing (Holt's method)
    method = 'double';
    forecastValues = doubleExponentialSmoothing(
      values,
      params.alpha,
      params.beta,
      config.horizon
    );
  } else {
    // Simple exponential smoothing
    method = 'simple';
    forecastValues = simpleExponentialSmoothing(
      values,
      params.alpha,
      config.horizon
    );
  }

  // Validate forecast values (filter out NaN/Infinity)
  const validForecastValues = forecastValues.filter(v => isFinite(v));

  if (validForecastValues.length === 0) {
    console.warn('Forecast generated all invalid values (NaN/Infinity)');
    return null;
  }

  // Generate forecast dates
  const lastDate = dates[dates.length - 1];
  const forecast: ForecastPoint[] = validForecastValues.map((value, i) => ({
    date: addDays(lastDate, i + 1),
    value
  }));

  // Calculate confidence intervals if requested
  const confidenceIntervals = config.showConfidenceIntervals
    ? calculateConfidenceIntervals(validForecastValues, values, config.confidenceLevel)
    : undefined;

  return {
    forecast,
    confidenceIntervals,
    parameters: params,
    method
  };
}
