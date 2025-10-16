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
}

/**
 * CSV parsing types
 */
export interface CSVRow {
  date: string;
  numerator: string;
  denominator: string;
}

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
