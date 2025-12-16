/**
 * Type of comparison target
 */
export type ComparisonType = 'shadow' | 'goal' | 'forecast';

/**
 * Period type that the comparison applies to
 */
export type ComparisonPeriodType = 'selection' | 'focus';

/**
 * Configuration for a single comparison column
 */
export interface ComparisonConfig {
  id: string;
  label: string;
  type: ComparisonType;
  periodType: ComparisonPeriodType;

  // Index to select which shadow/goal/forecast when multiple exist
  // undefined means use the first one or average (for shadows with averageShadows enabled)
  targetIndex?: number;

  // Display order in the grid
  order: number;

  // Whether this comparison is enabled
  enabled: boolean;
}

/**
 * Result of a comparison calculation
 */
export interface ComparisonResult {
  comparisonId: string;
  absoluteDifference?: number;
  percentDifference?: number;
  targetValue?: number;
  targetLabel?: string;
}

/**
 * Default comparison configurations for backward compatibility
 */
export const DEFAULT_SELECTION_COMPARISONS: ComparisonConfig[] = [
  {
    id: 'selection-vs-shadow',
    label: 'vs Shadow',
    type: 'shadow',
    periodType: 'selection',
    order: 0,
    enabled: true
  },
  {
    id: 'selection-vs-goal',
    label: 'vs Goal',
    type: 'goal',
    periodType: 'selection',
    order: 1,
    enabled: true
  }
];

export const DEFAULT_FOCUS_COMPARISONS: ComparisonConfig[] = [
  {
    id: 'focus-vs-shadow',
    label: 'vs Shadow',
    type: 'shadow',
    periodType: 'focus',
    order: 0,
    enabled: true
  },
  {
    id: 'focus-vs-goal',
    label: 'vs Goal',
    type: 'goal',
    periodType: 'focus',
    order: 1,
    enabled: true
  }
];
