/**
 * Core data types for Bialy time series application
 */

export interface TimeSeriesPoint {
  date: Date;
  numerator: number;
  denominator: number;
}

export interface SeriesMetadata {
  name: string;
  description: string;
  uploadDate: Date;
  numeratorLabel: string;
  denominatorLabel: string;
}

export interface Series {
  id: string;
  data: TimeSeriesPoint[];
  metadata: SeriesMetadata;
  filePath?: string; // Optional path to CSV file in Supabase Storage
}

/**
 * CSV parsing types
 */
export interface CSVRow {
  date: string;
  numerator: string;
  denominator: string;
}

export interface MultiMetricCSVRow {
  date: string;
  metric_name: string;
  numerator: string;
  denominator: string;
}

export type CSVFormat = 'single' | 'multi';

export interface CSVValidationError {
  type: 'column_count' | 'header' | 'date_format' | 'numeric' | 'denominator_invalid';
  message: string;
  row?: number;
}

export interface CSVValidationResult {
  valid: boolean;
  errors: CSVValidationError[];
  warnings?: string[];
}
