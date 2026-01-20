import type { TimeSeriesPoint } from './series';

export type ShadowPeriodUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface Shadow {
  id: string;
  enabled: boolean;
  periods: number;
  unit: ShadowPeriodUnit;
  label: string;
  alignDayOfWeek?: boolean; // Align shadow to same day-of-week as current selection
}

export interface ShadowData {
  shadow: Shadow;
  data: TimeSeriesPoint[];
  color: string;
}
