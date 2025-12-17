import type { Annotation, AnnotationData } from '../types/annotation';

/**
 * Default annotation colors - pale purple spectrum to distinguish from goals and shadows
 */
const DEFAULT_ANNOTATION_COLORS = [
  '#c4b5fd', // violet-300
  '#ddd6fe', // violet-200
  '#d8b4fe', // purple-300
  '#e9d5ff', // purple-200
  '#a78bfa', // violet-400
];

/**
 * Get color for an annotation
 * Uses custom color if specified, otherwise cycles through default colors
 */
export function getAnnotationColor(annotation: Annotation, index: number): string {
  if (annotation.color) {
    return annotation.color;
  }
  return DEFAULT_ANNOTATION_COLORS[index % DEFAULT_ANNOTATION_COLORS.length];
}

/**
 * Create an event annotation (vertical line at specific date)
 */
export function createEventAnnotation(
  date: Date,
  label: string,
  options?: {
    description?: string;
    color?: string;
    style?: 'solid' | 'dashed';
    position?: 'top' | 'bottom' | 'middle';
  }
): Annotation {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    type: 'event',
    label,
    description: options?.description,
    date: new Date(date),
    color: options?.color,
    style: options?.style || 'solid',
    position: options?.position || 'top',
  };
}

/**
 * Create a range annotation (shaded time period)
 */
export function createRangeAnnotation(
  startDate: Date,
  endDate: Date,
  label: string,
  options?: {
    description?: string;
    color?: string;
    opacity?: number;
  }
): Annotation {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    type: 'range',
    label,
    description: options?.description,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    color: options?.color,
    opacity: options?.opacity || 0.2,
  };
}

/**
 * Create a point annotation (specific date + value marker)
 */
export function createPointAnnotation(
  date: Date,
  value: number,
  label: string,
  options?: {
    description?: string;
    color?: string;
    position?: 'top' | 'bottom' | 'middle';
  }
): Annotation {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    type: 'point',
    label,
    description: options?.description,
    date: new Date(date),
    value,
    color: options?.color,
    position: options?.position || 'top',
  };
}

/**
 * Filter annotations to only those within a specific date range
 * Useful for performance optimization - only render visible annotations
 */
export function filterAnnotationsByDateRange(
  annotations: Annotation[],
  startDate: Date,
  endDate: Date
): Annotation[] {
  return annotations.filter(annotation => {
    if (!annotation.enabled) return false;

    switch (annotation.type) {
      case 'event':
      case 'point':
        // Check if single date is within range
        if (!annotation.date) return false;
        return annotation.date >= startDate && annotation.date <= endDate;

      case 'range':
        // Check if range overlaps with visible range
        if (!annotation.startDate || !annotation.endDate) return false;
        return !(annotation.endDate < startDate || annotation.startDate > endDate);

      default:
        return false;
    }
  });
}

/**
 * Generate annotation data for rendering
 * Converts raw annotations into display-ready format
 */
export function generateAnnotationData(
  annotations: Annotation[],
  dateRange?: [Date, Date]
): AnnotationData[] {
  // Filter by date range if provided
  let filteredAnnotations = annotations.filter(a => a.enabled);
  if (dateRange) {
    filteredAnnotations = filterAnnotationsByDateRange(
      filteredAnnotations,
      dateRange[0],
      dateRange[1]
    );
  }

  return filteredAnnotations.map((annotation, index) => ({
    annotation,
    color: getAnnotationColor(annotation, index),
    displayLabel: annotation.label,
    visible: true,
  }));
}

/**
 * Detect if annotation labels might overlap
 * Returns groups of potentially overlapping annotations
 */
export function detectAnnotationOverlap(
  annotations: Annotation[],
  dateScale: (date: Date) => number,
  minPixelDistance: number = 50
): number[][] {
  const eventAnnotations = annotations
    .map((a, idx) => ({ annotation: a, index: idx }))
    .filter(({ annotation }) =>
      (annotation.type === 'event' || annotation.type === 'point') &&
      annotation.date
    )
    .sort((a, b) => {
      const dateA = a.annotation.date!.getTime();
      const dateB = b.annotation.date!.getTime();
      return dateA - dateB;
    });

  const overlappingGroups: number[][] = [];
  let currentGroup: number[] = [];

  for (let i = 0; i < eventAnnotations.length; i++) {
    const current = eventAnnotations[i];
    const currentX = dateScale(current.annotation.date!);

    if (currentGroup.length === 0) {
      currentGroup.push(current.index);
    } else {
      const prevIndex = currentGroup[currentGroup.length - 1];
      const prevAnnotation = annotations[prevIndex];
      const prevX = dateScale(prevAnnotation.date!);

      if (Math.abs(currentX - prevX) < minPixelDistance) {
        currentGroup.push(current.index);
      } else {
        if (currentGroup.length > 1) {
          overlappingGroups.push([...currentGroup]);
        }
        currentGroup = [current.index];
      }
    }
  }

  if (currentGroup.length > 1) {
    overlappingGroups.push(currentGroup);
  }

  return overlappingGroups;
}

/**
 * Merge global and metric-specific annotations
 * Global annotations are shown on all metrics, metric-specific supplement them
 */
export function mergeAnnotations(
  globalAnnotations: Annotation[] = [],
  metricAnnotations: Annotation[] = []
): Annotation[] {
  return [...globalAnnotations, ...metricAnnotations];
}

/**
 * Validate annotation data
 * Returns validation errors if any
 */
export function validateAnnotation(annotation: Partial<Annotation>): string[] {
  const errors: string[] = [];

  if (!annotation.label || annotation.label.trim() === '') {
    errors.push('Label is required');
  }

  if (!annotation.type) {
    errors.push('Type is required');
  }

  switch (annotation.type) {
    case 'event':
      if (!annotation.date) {
        errors.push('Date is required for event annotations');
      }
      break;

    case 'range':
      if (!annotation.startDate || !annotation.endDate) {
        errors.push('Start date and end date are required for range annotations');
      } else if (annotation.startDate >= annotation.endDate) {
        errors.push('End date must be after start date');
      }
      break;

    case 'point':
      if (!annotation.date) {
        errors.push('Date is required for point annotations');
      }
      if (annotation.value === undefined || annotation.value === null) {
        errors.push('Value is required for point annotations');
      }
      break;
  }

  return errors;
}

/**
 * Sort annotations by date (for consistent rendering order)
 */
export function sortAnnotations(annotations: Annotation[]): Annotation[] {
  return [...annotations].sort((a, b) => {
    const dateA = a.type === 'range' ? a.startDate : a.date;
    const dateB = b.type === 'range' ? b.startDate : b.date;

    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    return dateA.getTime() - dateB.getTime();
  });
}
