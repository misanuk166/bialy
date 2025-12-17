/**
 * Annotation types for marking significant dates, events, and ranges on charts
 */

export type AnnotationType = 'event' | 'range' | 'point';
export type AnnotationStyle = 'solid' | 'dashed';
export type AnnotationPosition = 'top' | 'bottom' | 'middle';

/**
 * Core annotation interface
 * - Event: Vertical line marking a specific date (e.g., "Black Friday")
 * - Range: Shaded time period (e.g., "Holiday Season Q4")
 * - Point: Specific date + value marker with callout (e.g., "All-time high")
 */
export interface Annotation {
  id: string;
  enabled: boolean;
  type: AnnotationType;
  label: string;
  description?: string;
  color?: string; // Hex color, defaults to amber/orange if not specified

  // Event annotation fields (vertical line at specific date)
  date?: Date;

  // Range annotation fields (shaded period)
  startDate?: Date;
  endDate?: Date;

  // Point annotation fields (specific date + value)
  value?: number;

  // Visual style options
  style?: AnnotationStyle;
  position?: AnnotationPosition;
  opacity?: number; // 0-1, mainly for range backgrounds
}

/**
 * Processed annotation data ready for rendering
 */
export interface AnnotationData {
  annotation: Annotation;
  color: string;
  // Pre-computed display properties
  displayLabel: string;
  visible: boolean;
}

/**
 * Annotation preset - a collection of related annotations
 * Examples: US Holidays, Shopping Events, Earnings Calendar
 */
export interface AnnotationPreset {
  id: string;
  name: string;
  description: string;
  category: 'holidays' | 'business' | 'financial' | 'custom';
  annotations: Annotation[];
}

/**
 * Parameters for creating a preset (e.g., year range for holidays)
 */
export interface PresetGenerationParams {
  startYear: number;
  endYear: number;
  includeObservedDates?: boolean; // For holidays that shift to weekdays
}
