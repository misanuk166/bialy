/**
 * Anomaly detection types and interfaces
 */

export type AnomalySensitivity = 'low' | 'medium' | 'high';
export type AnomalySeverity = 'low' | 'medium' | 'high';

/**
 * Anomaly detection configuration
 */
export interface AnomalyConfig {
  enabled: boolean;
  sensitivity: AnomalySensitivity;
  showConfidenceBands: boolean;
  seasonLength?: number; // Optional: auto-detect if not provided
}

/**
 * Expected range for a data point
 */
export interface ExpectedRange {
  lower: number;
  upper: number;
}

/**
 * Single anomalous point
 */
export interface AnomalyPoint {
  date: Date;
  value: number;
  severity: AnomalySeverity;
  expectedRange: ExpectedRange;
  deviation: number; // Deviation in standard deviations
}

/**
 * Confidence band for visualization
 */
export interface ConfidenceBand {
  date: Date;
  lower: number;
  upper: number;
}

/**
 * Anomaly detection result
 */
export interface AnomalyResult {
  anomalies: AnomalyPoint[];
  totalPoints: number;
  anomalyCount: number;
  anomalyRate: number; // 0-1
  confidenceBands?: ConfidenceBand[];
  modelUsed: string;
  sensitivity: AnomalySensitivity;
  computationTimeMs: number;
}

/**
 * Cached anomaly detection results (for persistence)
 */
export interface AnomalySnapshot {
  detectedAt: string; // ISO date string
  config: AnomalyConfig; // Config used for detection
  result: {
    anomalies: Array<{
      date: string; // ISO date string
      value: number;
      severity: AnomalySeverity;
      expectedRange: ExpectedRange;
      deviation: number;
    }>;
    totalPoints: number;
    anomalyCount: number;
    anomalyRate: number;
    confidenceBands?: Array<{
      date: string;
      lower: number;
      upper: number;
    }>;
    modelUsed: string;
    sensitivity: AnomalySensitivity;
    computationTimeMs: number;
  };
}
