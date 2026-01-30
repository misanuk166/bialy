/**
 * API client for StatsForecast backend
 * Handles forecasting and anomaly detection
 */

import type { TimeSeriesPoint } from '../types/series';
import type { ForecastConfig, ForecastResult, ForecastPoint } from '../types/forecast';
import type { AnomalyConfig, AnomalyResult, AnomalyPoint, ConfidenceBand } from '../types/anomaly';

// Get API URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Backend API request/response types
 */
interface BackendDataPoint {
  date: string;
  value: number;
}

interface BackendForecastRequest {
  data: BackendDataPoint[];
  horizon: number;
  model: 'auto' | 'arima' | 'ets' | 'theta';
  seasonLength?: number;
  confidenceLevels: number[];
}

interface BackendForecastResponse {
  forecast: Array<{ date: string; value: number }>;
  confidenceIntervals: Record<string, number[]>;
  modelUsed: string;
  metrics: {
    aic?: number;
    bic?: number;
    mape?: number;
    computation_time_ms: number;
  };
}

interface BackendAnomalyRequest {
  data: BackendDataPoint[];
  sensitivity: 'low' | 'medium' | 'high';
  seasonLength?: number;
  showConfidenceBands: boolean;
}

interface BackendAnomalyResponse {
  anomalies: Array<{
    date: string;
    value: number;
    severity: 'low' | 'medium' | 'high';
    expectedRange: { lower: number; upper: number };
    deviation: number;
  }>;
  totalPoints: number;
  anomalyCount: number;
  anomalyRate: number;
  confidenceBands?: Array<{ date: string; lower: number; upper: number }>;
  modelUsed: string;
  sensitivity: string;
  computationTimeMs: number;
}

/**
 * Generate forecast using StatsForecast backend
 */
export async function generateForecast(
  data: Array<{ date: Date; value: number }>,
  config: ForecastConfig
): Promise<ForecastResult | null> {
  try {
    // Transform data to backend format
    const backendData: BackendDataPoint[] = data.map(point => ({
      date: point.date.toISOString().split('T')[0], // YYYY-MM-DD
      value: point.value
    }));

    // Build request
    const request: BackendForecastRequest = {
      data: backendData,
      horizon: config.horizon,
      model: config.model, // Use model directly from config
      seasonLength: config.seasonLength,
      confidenceLevels: config.showConfidenceIntervals ? [config.confidenceLevel] : []
    };

    // Call API
    const response = await fetch(`${API_BASE_URL}/api/v1/forecast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Forecast failed: ${response.status}`);
    }

    const result: BackendForecastResponse = await response.json();

    // Transform response to frontend format
    const forecast: ForecastPoint[] = result.forecast.map(point => ({
      date: new Date(point.date),
      value: point.value
    }));

    // Extract confidence intervals
    let confidenceIntervals: { upper: number[]; lower: number[] } | undefined;
    if (config.showConfidenceIntervals) {
      const level = config.confidenceLevel;
      const upperKey = `upper_${level}`;
      const lowerKey = `lower_${level}`;

      if (result.confidenceIntervals[upperKey] && result.confidenceIntervals[lowerKey]) {
        confidenceIntervals = {
          upper: result.confidenceIntervals[upperKey],
          lower: result.confidenceIntervals[lowerKey]
        };
      }
    }

    return {
      forecast,
      confidenceIntervals,
      parameters: {
        alpha: 0, // StatsForecast doesn't expose these
        beta: 0
      },
      method: result.modelUsed // Use actual API model name (AutoARIMA, AutoETS, etc.)
    };

  } catch (error) {
    console.error('Forecast API error:', error);
    return null; // Will fall back to client-side forecasting
  }
}

/**
 * Detect anomalies using StatsForecast backend
 */
export async function detectAnomalies(
  data: Array<{ date: Date; value: number }>,
  config: AnomalyConfig
): Promise<AnomalyResult | null> {
  try {
    // Transform data to backend format
    const backendData: BackendDataPoint[] = data.map(point => ({
      date: point.date.toISOString().split('T')[0],
      value: point.value
    }));

    // Build request
    const request: BackendAnomalyRequest = {
      data: backendData,
      sensitivity: config.sensitivity,
      seasonLength: config.seasonLength,
      showConfidenceBands: config.showConfidenceBands
    };

    // Call API
    const response = await fetch(`${API_BASE_URL}/api/v1/detect-anomalies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Anomaly detection failed: ${response.status}`);
    }

    const result: BackendAnomalyResponse = await response.json();

    // Transform response to frontend format
    const anomalies: AnomalyPoint[] = result.anomalies.map(anomaly => ({
      date: new Date(anomaly.date),
      value: anomaly.value,
      severity: anomaly.severity,
      expectedRange: anomaly.expectedRange,
      deviation: anomaly.deviation
    }));

    const confidenceBands: ConfidenceBand[] | undefined = result.confidenceBands?.map(band => ({
      date: new Date(band.date),
      lower: band.lower,
      upper: band.upper
    }));

    return {
      anomalies,
      totalPoints: result.totalPoints,
      anomalyCount: result.anomalyCount,
      anomalyRate: result.anomalyRate,
      confidenceBands,
      modelUsed: result.modelUsed,
      sensitivity: config.sensitivity,
      computationTimeMs: result.computationTimeMs
    };

  } catch (error) {
    console.error('Anomaly detection API error:', error);
    return null;
  }
}

/**
 * Health check for backend API
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/health`);
    return response.ok;
  } catch {
    return false;
  }
}
