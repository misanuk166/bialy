export interface Viewport {
  startDate: Date | null;  // null means use series min
  endDate: Date | null;    // null means use series max
}

export type ZoomPreset = 'all' | 'year' | 'quarter' | 'month' | 'week';
