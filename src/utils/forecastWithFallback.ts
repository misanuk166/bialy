/**
 * Forecast generation with API fallback
 * Tries StatsForecast API first, falls back to client-side Holt-Winters
 */

import type { ForecastConfig, ForecastResult } from '../types/forecast';
import { generateForecast as clientSideForecast } from './forecasting';
import { generateForecast as apiForecast } from '../services/forecastApi';

export interface ForecastGenerationResult {
  result: ForecastResult | null;
  usingAPI: boolean;
  modelUsed?: string;
  computationTime?: number;
  error?: string;
}

/**
 * Generate forecast with automatic fallback
 *
 * 1. Try API forecast (StatsForecast - more accurate, faster)
 * 2. If API fails, fall back to client-side (Holt-Winters - still good)
 *
 * Supports out-of-sample forecasting: if startDate is before the last data point,
 * we filter training data to only include points before startDate, enabling
 * forecast validation against actual data.
 */
export async function generateForecastWithFallback(
  data: Array<{ date: Date; value: number }>,
  config: ForecastConfig
): Promise<ForecastGenerationResult> {

  // Filter training data if startDate is specified and before last data point
  let trainingData = data;
  const lastDataDate = data[data.length - 1]?.date;

  if (config.startDate && lastDataDate && config.startDate < lastDataDate) {
    console.log(`[Forecast] Out-of-sample mode: training on data before ${config.startDate.toISOString()}`);
    trainingData = data.filter(point => point.date < config.startDate!);

    if (trainingData.length < 2) {
      console.warn('[Forecast] Insufficient training data before startDate');
      return {
        result: null,
        usingAPI: false,
        error: 'Insufficient training data before forecast start date'
      };
    }
  }

  // Try API first
  try {
    console.log('[Forecast] Attempting API forecast...');
    const startTime = performance.now();

    const apiResult = await apiForecast(trainingData, config);

    if (apiResult) {
      const endTime = performance.now();
      const computationTime = endTime - startTime;

      console.log(`[Forecast] API forecast successful (${computationTime.toFixed(0)}ms)`);

      return {
        result: apiResult,
        usingAPI: true,
        modelUsed: apiResult.method, // Will be 'AutoARIMA', 'AutoETS', etc from API
        computationTime
      };
    }
  } catch (error) {
    console.warn('[Forecast] API forecast failed:', error);
  }

  // Fallback to client-side
  console.log('[Forecast] Using client-side forecast (Holt-Winters)');
  const startTime = performance.now();

  // Build client-side config with Holt-Winters defaults
  const clientConfig = {
    ...config,
    type: 'auto' as const,
    seasonal: 'none' as const, // Use simple exponential smoothing for fallback
  };

  const clientResult = clientSideForecast(trainingData, clientConfig);

  const endTime = performance.now();
  const computationTime = endTime - startTime;

  if (clientResult) {
    console.log(`[Forecast] Client-side forecast successful (${computationTime.toFixed(0)}ms)`);
  }

  return {
    result: clientResult,
    usingAPI: false,
    modelUsed: clientResult?.method ? `Holt-Winters (${clientResult.method})` : undefined,
    computationTime,
    error: !clientResult ? 'Forecast generation failed' : undefined
  };
}
