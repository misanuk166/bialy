/**
 * Forecast generation with API fallback
 * Tries StatsForecast API first, falls back to client-side Holt-Winters
 */

import type { TimeSeriesPoint } from '../types/series';
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
 */
export async function generateForecastWithFallback(
  data: TimeSeriesPoint[],
  config: ForecastConfig
): Promise<ForecastGenerationResult> {

  // Try API first
  try {
    console.log('[Forecast] Attempting API forecast...');
    const startTime = performance.now();

    const apiResult = await apiForecast(data, config);

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

  const clientResult = clientSideForecast(data, config);

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
